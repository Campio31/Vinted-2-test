import { app } from '../state.js';
import { $, LSg, esc, ok, today } from './core.js';
import { cloud, errMsg } from './sync.js';
import { CFG0 } from './settings-core.js';
import { MOIS } from './gamification.js';

/* ---------- classement Monde, Région, Amis (tables du fichier classement-monde-setup.sql) ---------- */
/* Le classement se fait sur les points du mois (publier 1, vendre 3, colis 1, défi réussi 5), jamais sur les euros.
   Il est facultatif : pseudo et région choisis par toi, rien d'autre n'est partagé. */
Object.assign(CFG0, { rang: null });
export const REGIONS = ['Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur', 'Outre-mer', 'Belgique', 'Suisse', 'Luxembourg', 'Canada', 'Autre pays'];
const TR = new Set(['Outre-mer', 'Belgique', 'Suisse', 'Luxembourg', 'Canada', 'Autre pays']);
const regTxt = r => TR.has(r) ? t(r) : r;
const MAXPTS = 5000;

export const rangCfg = () => Object.assign({ on: false, pseudo: '', region: '' }, app.cfg.rang || {});
/** Points du mois : publier 1, vendre 3, colis préparé 1, défi réussi 5 (pièces d'exemple exclues). */
export function ptsMonth(m) {
  const R = app.P.filter(p => !p.ex), has = d => ok(d) && d.startsWith(m);
  const defis = (app.cfg.defis || []).filter(d => d.done && d.done.startsWith(m)).length;
  return Math.min(MAXPTS, R.filter(p => has(p.pub)).length + 3 * R.filter(p => p.statut === 'Vendu' && has(p.dv)).length + R.filter(p => has(p.exp)).length + 5 * defis);
}
const erreur = e => (e && (e.code === '42P01' || e.code === 'PGRST202' || e.code === 'PGRST205' || /schema cache|does not exist/i.test(e.message || ''))) ? t('Classement non installé : exécute classement-monde-setup.sql dans Supabase.') : errMsg(e);

/** Envoie tes points du mois (seulement si tu as rejoint le classement). */
export async function rangPublish(force) {
  const c = rangCfg();
  if (!cloud || !app.user || app.importing || !app.loaded || !c.on || !c.pseudo || !c.region) return;
  const m = today().slice(0, 7), pts = ptsMonth(m), k = app.user.id + ':' + m + ':' + pts + ':' + c.pseudo + ':' + c.region;
  if (!force && localStorage.getItem('rangLast') === k) return;
  let r = await app.sb.from('profils_pub').upsert({ user_id: app.user.id, pseudo: c.pseudo, region: c.region }, { onConflict: 'user_id' });
  if (r.error) throw r.error;
  r = await app.sb.from('scores_mois').upsert({ user_id: app.user.id, mois: m, points: pts }, { onConflict: 'user_id,mois' });
  if (r.error) throw r.error;
  try { localStorage.setItem('rangLast', k); } catch (e) { /* stockage indisponible */ }
}
app.rangPublish = rangPublish;

/* ---- écran ---- */
let tab = 'monde';
export function rangBody() {
  const c = rangCfg(), tabs = [['monde', 'Monde'], ['region', 'Ma région'], ['amis', 'Amis']];
  return `<div class="chips" style="margin-bottom:12px">${tabs.map(([k, l]) => `<button type="button" class="chip sm${tab === k ? ' on' : ''}" data-rg="tab" data-v="${k}">${t(l)}</button>`).join('')}</div>`
    + (tab === 'amis' ? `<div class="card"><h3>${t('Classement entre amis')}</h3><div id="am_in" class="hint">${t('Chargement…')}</div></div>`
      : `<div class="card" id="rg_set">${setupHTML(c)}</div><div id="rg_in" class="hint">${c.on ? t('Chargement…') : ''}</div>`);
}
function setupHTML(c) {
  if (c.on) return `<div class="gh2"><span>${t('Tu participes')}</span><span>${esc(c.pseudo)} · ${esc(regTxt(c.region))}</span></div><div class="gl2">${t('Seuls ton pseudo, ta région et tes points du mois sont partagés, jamais tes prix ni ton stock.')}</div><div class="acts"><button type="button" class="btn sec" data-rg="leave">${t('Quitter le classement')}</button></div>`;
  return `<h3>${t('Rejoindre le classement')}</h3><p class="sub" style="margin:0 0 10px">${t('Facultatif. Tu apparais avec un pseudo et ta région, classé sur tes points du mois : publier 1, vendre 3, colis 1, défi réussi 5. Jamais d\'euros.')}</p>
   <label class="l" for="rg_ps">${t('Ton pseudo')}</label><input type="text" id="rg_ps" maxlength="24" autocomplete="off" value="${esc(c.pseudo || LSg('amisPseudo', ''))}" placeholder="${t('ex. Camille')}">
   <label class="l" for="rg_rg" style="margin-top:10px">${t('Ta région')}</label><select id="rg_rg"><option value="">—</option>${REGIONS.map(r => `<option value="${esc(r)}"${c.region === r ? ' selected' : ''}>${esc(regTxt(r))}</option>`).join('')}</select>
   <div class="acts"><button type="button" class="btn" data-rg="join">${t('Rejoindre')}</button></div>`;
}

/** Après l'affichage : charge la liste (Monde ou région) ou les groupes d'amis. */
export async function rangInit() {
  if (tab === 'amis') return app.amisInit();
  const b = $('rg_in'), c = rangCfg();
  if (!b || !c.on) return;
  if (!cloud || !app.user) { b.textContent = t('Connecte-toi (onglet Réglages) pour voir le classement.'); return; }
  const m = today().slice(0, 7);
  try {
    await rangPublish(true).catch(() => { });
    const r = await app.sb.rpc('classement_public', { p_mois: m, p_region: tab === 'region' ? c.region : null });
    if (r.error) throw r.error;
    if (!$('rg_in')) return;
    const L = r.data || [], med = ['🥇', '🥈', '🥉'];
    $('rg_in').outerHTML = `<div id="rg_in"><p class="sub">${MOIS[+m.slice(5) - 1]} ${m.slice(0, 4)} · ${tab === 'region' ? esc(regTxt(c.region)) : t('Monde')}</p><div class="card">${L.length ? L.map((x, k) => `<div class="rgr${x.moi ? ' me' : ''}${k && L[k - 1].rang + 1 < x.rang ? ' gap' : ''}"><span class="rk">${med[x.rang - 1] || x.rang}</span><span class="nm">${esc(x.pseudo)}${x.moi ? ' ' + t('(toi)') : ''}<small>${esc(regTxt(x.region))}</small></span><b>${x.points} ${t('pts')}</b></div>`).join('') : `<div class="hint">${t('Personne n\'a encore de points ce mois-ci.')}</div>`}</div><div class="hint">${t('Les points se mettent à jour quand les joueurs ouvrent l\'appli. Le classement repart à zéro chaque mois.')}</div></div>`;
  } catch (e) { if ($('rg_in')) $('rg_in').textContent = erreur(e); }
}
/** Touches de l'onglet ; renvoie true si l'écran doit être redessiné, null si ce n'est pas pour nous. */
export async function rangClick(e) {
  const b = e.target.closest('[data-rg]'); if (!b) return null;
  const a = b.dataset.rg;
  if (a === 'tab') { tab = b.dataset.v; return true; }
  if (a === 'join') {
    const ps = ($('rg_ps').value || '').trim(), rg = $('rg_rg').value;
    if (ps.length < 2) { app.toast(t('Choisis un pseudo')); return false; }
    if (!rg) { app.toast(t('Choisis ta région')); return false; }
    app.setCfg({ rang: { on: true, pseudo: ps.slice(0, 24), region: rg } });
    return true;
  }
  if (a === 'leave') {
    app.setCfg({ rang: { on: false, pseudo: rangCfg().pseudo, region: rangCfg().region } });
    if (cloud && app.user) { try { await app.sb.rpc('quitter_classement'); } catch (er) { /* sans serveur, rien à retirer */ } }
    return true;
  }
  return null;
}
