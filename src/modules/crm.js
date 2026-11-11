import { app } from '../state.js';
import { $, LSg, LSs, addDays, age, avail, days, esc, eur, eurR, fd, ok, profit, sold, title, today } from './core.js';
import { CFG0 } from './settings-core.js';
import { phImg, hydrate } from './photos.js';
import { catSvg, pastel } from './stock-view.js';
import { isFinal } from './finalisation.js';
import { pseudoKey } from './buyers.js';
import { copyText } from './listing.js';
import { trEv } from './trash-history.js';
import { sheetHead, showSheet } from './tools-index.js';

Object.assign(CFG0, { crm: {} });

/* ---------- Stock en mode CRM (onglet test) ---------- */
/* Deux façons de voir le même stock :
   - le PIPELINE : chaque pièce est dans une colonne selon où elle en est (à publier, en ligne, offre reçue, à expédier, expédié, finalisé) ;
     on la fait avancer (ou reculer) et l'action correspondante est enregistrée ;
   - les ACHETEURS : une fiche par pseudo (achats, total, dernier achat, offres, note, relance à faire), plus un journal d'activité.
   Rien n'est dupliqué : tout est calculé à partir des pièces. Seuls la note et la relance d'un acheteur sont enregistrées (réglages, cfg.crm). */
export const STAGES = [
  ['brouillon', 'À publier', 'Pièces pas encore en ligne'],
  ['ligne', 'En ligne', 'Annonce publiée, en attente d\'acheteur'],
  ['offre', 'Offre reçue', 'Un acheteur négocie ou réserve'],
  ['envoyer', 'À expédier', 'Vendu, colis à préparer'],
  ['expedie', 'Expédié', 'En route, argent pas encore reçu'],
  ['finalise', 'Finalisé', 'Argent reçu, vente terminée'],
];
export function stageOf(p) {
  if (sold(p)) return p.vt && !p.exp ? 'envoyer' : isFinal(p) ? 'finalise' : 'expedie';
  if (!avail(p)) return '';
  if (p.crm === 'offre') return 'offre';
  return ok(p.pub) ? 'ligne' : 'brouillon';
}
const RECENT_FINAL = 30;
const inPipeline = p => { const s = stageOf(p); return !!s && (s !== 'finalise' || (ok(p.dv) && days(p.dv, today()) <= RECENT_FINAL)); };

/* ---- acheteurs ---- */
export function contacts() {
  const o = {}, add = (name, p, kind) => {
    const k = pseudoKey(name); if (!k) return;
    const c = o[k] = o[k] || { k, nom: String(name).replace(/^@+/, ''), achats: [], offres: [], ca: 0, ben: 0, last: '' };
    if (kind === 'sale') { c.achats.push(p); c.ca += p.pv || 0; c.ben += profit(p); if ((p.dv || '') > c.last) c.last = p.dv || ''; } else c.offres.push(p);
  };
  app.P.forEach(p => { if (sold(p) && p.acheteur) add(p.acheteur, p, 'sale'); else if (avail(p) && p.crm === 'offre' && p.offre && p.offre.a) add(p.offre.a, p, 'offer'); });
  const meta = (app.cfg.crm || {}).c || {};
  return Object.values(o).map(c => {
    const m = meta[c.k] || {}, n = new Set(c.achats.map(p => p.lot || p.id)).size;
    return Object.assign(c, { n, note: m.note || '', relance: m.relance || '', tag: n >= 3 ? 'fidele' : n === 1 ? 'nouveau' : n === 2 ? 'revenu' : c.offres.length ? 'offre' : 'prospect' });
  }).sort((a, b) => (b.last || '').localeCompare(a.last || '') || b.n - a.n);
}
const TAGL = { fidele: 'Fidèle', revenu: 'Revenu', nouveau: 'Nouveau', offre: 'Offre en cours', prospect: 'Prospect' };
const setMeta = (k, patch) => { const crm = Object.assign({}, app.cfg.crm), c = Object.assign({}, crm.c); c[k] = Object.assign({}, c[k], patch); crm.c = c; app.setCfg({ crm }); };

/* ---- journal : les derniers événements de toutes les pièces ---- */
export function activity(limit = 20) {
  const ev = [];
  app.P.forEach(p => (p.h || []).forEach(x => ev.push({ t: x.t, e: x.e, p })));
  return ev.sort((a, b) => b.t - a.t).slice(0, limit);
}

/* ---- tâches du jour du CRM ---- */
export function crmTodo() {
  const td = today(), A = app.P.filter(avail);
  return {
    offres: A.filter(p => p.crm === 'offre'),
    envoyer: app.P.filter(p => stageOf(p) === 'envoyer'),
    relances: contacts().filter(c => c.relance && c.relance <= td),
    dormantes: A.filter(p => ok(p.pub) && days(p.pub, td) >= 30 && p.crm !== 'offre'),
  };
}

/* ---- déplacer une pièce d'une colonne à l'autre : l'action est vraiment enregistrée ---- */
export function moveTo(id, target) {
  const p = app.P.find(x => x.id === id); if (!p) return;
  const from = stageOf(p); if (from === target) return;
  const old = Object.assign({}, p), td = today(), q = Object.assign({}, p);
  const undo = () => app.save(old);
  if (sold(p)) {
    if (target === 'envoyer') { delete q.exp; delete q.fin; if (!q.vt) q.vt = Date.now(); }
    else if (target === 'expedie') { q.exp = td; delete q.fin; }
    else if (target === 'finalise') { if (!q.exp) q.exp = td; q.fin = td; }
    else return app.toast(t('Une pièce vendue ne peut revenir qu\'à une étape de la vente'));
    app.save(q); app.toast(t('Déplacé : {s}', { s: t(STAGES.find(s => s[0] === target)[1]) }), undo, 5000); return;
  }
  if (target === 'brouillon') { delete q.pub; delete q.crm; delete q.offre; }
  else if (target === 'ligne') { q.pub = q.pub || td; delete q.crm; delete q.offre; }
  else if (target === 'offre') return openOffer(id);
  else return app.openSheet(id, 'sell');   /* vendu : il faut le prix et l'acheteur */
  app.save(q); app.toast(t('Déplacé : {s}', { s: t(STAGES.find(s => s[0] === target)[1]) }), undo, 5000);
}
function openOffer(id) {
  const p = app.P.find(x => x.id === id); if (!p) return;
  const known = contacts().map(c => c.nom);
  showSheet(sheetHead(t('Offre reçue')) + `<div class="card"><p class="sub" style="margin:0 0 10px">${esc(title(p))}</p>
   <div class="fld"><label class="l" for="of_a">${t('Pseudo de l\'acheteur')}</label><input type="text" id="of_a" list="of_l" autocomplete="off" autocapitalize="none" value="${esc((p.offre || {}).a || '')}"><datalist id="of_l">${known.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
   <div class="fld"><label class="l" for="of_m">${t('Montant proposé (€)')}</label><input type="text" inputmode="decimal" id="of_m" value="${(p.offre || {}).m || ''}"></div></div>
   <div class="acts"><button type="button" class="btn mint" id="of_ok">${t('Enregistrer l\'offre')}</button>${p.crm === 'offre' ? `<button type="button" class="btn sec" id="of_no">${t('Retirer l\'offre')}</button>` : ''}</div>`);
  $('of_ok').onclick = () => {
    const a = $('of_a').value.trim().replace(/^@+/, ''), m = Number(String($('of_m').value).replace(',', '.'));
    if (!a) return app.toast(t('Indique le pseudo de l\'acheteur'));
    const old = Object.assign({}, p);
    app.save(Object.assign({}, p, { crm: 'offre', offre: { a, m: isFinite(m) && m > 0 ? m : 0, d: today() }, h: [...(p.h || []), { t: Date.now(), e: 'Offre de @' + a + (m > 0 ? ' : ' + eur(m) : '') }].slice(-40) }));
    $('sheet').hidden = true; app.toast(t('Offre enregistrée'), () => app.save(old), 5000); draw();
  };
  if ($('of_no')) $('of_no').onclick = () => { const q = Object.assign({}, p); delete q.crm; delete q.offre; app.save(q); $('sheet').hidden = true; draw(); };
}
function openMove(id) {
  const p = app.P.find(x => x.id === id); if (!p) return;
  const cur = stageOf(p), soldP = sold(p);
  const L = STAGES.filter(s => s[0] !== cur && (soldP ? ['envoyer', 'expedie', 'finalise'].includes(s[0]) : !['envoyer', 'expedie', 'finalise'].includes(s[0]) || s[0] === 'envoyer'));
  showSheet(sheetHead(esc(title(p))) + `<p class="sub">${t('Étape actuelle : {s}', { s: t((STAGES.find(s => s[0] === cur) || ['', ''])[1]) })}</p>
   <div class="tools">${L.map(s => `<button type="button" class="tool" data-mv="${s[0]}"><span class="tx"><b>${t(s[1] === 'À expédier' && !soldP ? 'Vendu' : s[1])}</b><small>${t(s[2])}</small></span></button>`).join('')}</div>
   <div class="acts"><button type="button" class="btn sec" data-open="${esc(id)}">${t('Ouvrir la fiche')}</button></div>`);
  $('shc').onclick = e => {
    const mv = e.target.closest('[data-mv]'), op = e.target.closest('[data-open]');
    if (op) return app.openSheet(op.dataset.open);
    if (mv) { $('sheet').hidden = true; moveTo(id, !soldP && mv.dataset.mv === 'envoyer' ? 'vendu' : mv.dataset.mv); draw(); }
  };
}

/* ---- fiche d'un acheteur ---- */
function msgFor(c) {
  const lastP = c.achats.slice().sort((a, b) => (b.dv || '').localeCompare(a.dv || ''))[0];
  return t('Bonjour {n}, merci pour ton achat{p} ! J\'ai de nouvelles pièces en ligne qui pourraient te plaire : n\'hésite pas à passer voir mon dressing. Un lot avec envoi groupé est possible. Belle journée !', { n: '@' + c.nom, p: lastP ? ' (' + title(lastP) + ')' : '' });
}
function openContact(k) {
  const c = contacts().find(x => x.k === k); if (!c) return;
  const td = today();
  showSheet(sheetHead('@' + esc(c.nom)) + `<div class="card"><div class="kpis"><div class="kpi"><b>${c.n}</b><span>${t(c.n > 1 ? 'achats' : 'achat')}</span></div><div class="kpi"><b>${eurR(c.ca)}</b><span>${t('dépensés chez toi')}</span></div><div class="kpi"><b>${eurR(c.ben)}</b><span>${t('de bénéfice')}</span></div></div>
   <p class="sub" style="margin:10px 0 0"><span class="tag">${t(TAGL[c.tag])}</span>${c.last ? ' · ' + t('dernier achat le {d}', { d: fd(c.last) }) : ''}</p></div>
   ${c.offres.length ? `<div class="card"><h3>${t('Offres en cours')}</h3>${c.offres.map(p => `<button type="button" class="li" data-id="${esc(p.id)}" style="margin-top:6px"><div class="m"><b>${esc(title(p))}</b><small>${esc((p.offre || {}).d ? fd(p.offre.d) : '')}</small></div><div class="p">${(p.offre || {}).m ? eur(p.offre.m) : ''}</div></button>`).join('')}</div>` : ''}
   <div class="card"><h3>${t('Achats')}</h3>${c.achats.length ? c.achats.slice().sort((a, b) => (b.dv || '').localeCompare(a.dv || '')).map(p => `<button type="button" class="li" data-id="${esc(p.id)}" style="margin-top:6px"><div class="m"><b>${esc(title(p))}</b><small>${esc([p.taille, p.dv ? fd(p.dv) : ''].filter(Boolean).join(' · '))}</small></div><div class="p">${eur(p.pv)}</div></button>`).join('') : `<div class="hint">${t('Pas encore d\'achat.')}</div>`}</div>
   <div class="card"><h3>${t('Suivi')}</h3>
    <div class="fld"><label class="l" for="ct_n">${t('Note')}</label><textarea id="ct_n" rows="3" placeholder="${esc(t('Goûts, tailles, préférences…'))}">${esc(c.note)}</textarea></div>
    <div class="fld"><label class="l" for="ct_r">${t('À relancer le')}</label><input type="date" id="ct_r" value="${esc(c.relance)}"></div>
    <div class="chips" style="margin:6px 0 10px">${[[3, t('Dans 3 jours')], [7, t('Dans 1 semaine')], [30, t('Dans 1 mois')]].map(([n, l]) => `<button type="button" class="chip sm" data-rl="${n}">${l}</button>`).join('')}<button type="button" class="chip sm" data-rl="0">${t('Aucune')}</button></div>
    <div class="acts two"><button type="button" class="btn sec" id="ct_cp">${t('Copier un message')}</button><button type="button" class="btn mint" id="ct_ok">${t('Enregistrer')}</button></div></div>`);
  const save = () => { setMeta(k, { note: $('ct_n').value.trim(), relance: $('ct_r').value || '' }); };
  $('shc').onclick = e => {
    const r = e.target.closest('[data-rl]'), li = e.target.closest('.li[data-id]');
    if (r) { $('ct_r').value = +r.dataset.rl ? addDays(td, +r.dataset.rl) : ''; return; }
    if (li) return app.openSheet(li.dataset.id);
    if (e.target.closest('#ct_cp')) return copyText(msgFor(c), t('Message'));
    if (e.target.closest('#ct_ok')) { save(); app.toast(t('Enregistré')); $('sheet').hidden = true; draw(); }
  };
}

/* ---- écran ---- */
let sub = LSg('crmSub', 'pipe');
let query = '';
const card = p => {
  const [bg, fg] = pastel(p), st = stageOf(p), off = p.offre;
  const price = sold(p) ? eur(p.pv) : '';
  return `<div class="cxc" draggable="true" data-cid="${esc(p.id)}"><button type="button" class="cxt" data-id="${esc(p.id)}" style="background:${bg};color:${fg}" aria-label="${esc(t('Ouvrir la fiche'))}">${p.photo ? phImg(p.photo) : catSvg(p)}</button>
   <div class="cxb"><b>${esc(title(p))}</b><small>${esc([p.code, p.taille].filter(Boolean).join(' · '))}</small>
   ${st === 'offre' && off ? `<small class="cxo">${esc('@' + off.a)}${off.m ? ' · ' + eur(off.m) : ''}</small>` : ''}${st === 'ligne' && ok(p.pub) ? `<small>${t('en ligne {n} j', { n: days(p.pub, today()) })}</small>` : ''}${sold(p) ? `<small class="cxo">${esc(p.acheteur ? '@' + p.acheteur : '')} ${price}</small>` : ''}</div>
   <button type="button" class="cxm" data-cm="${esc(p.id)}" aria-label="${esc(t('Déplacer'))}">⋯</button></div>`;
};
function pipelineHTML() {
  const L = app.P.filter(inPipeline);
  return `<div class="cxp">${STAGES.map(([k, l, d]) => {
    const C = L.filter(p => stageOf(p) === k).sort((a, b) => (b.entree || '').localeCompare(a.entree || ''));
    return `<section class="cxcol st-${k}" data-stage="${k}"><header><b>${t(l)}</b><span class="cxn">${C.length}</span></header><small class="cxd">${t(d)}</small><div class="cxl">${C.length ? C.slice(0, 40).map(card).join('') : `<div class="cxv">${t('Rien ici')}</div>`}${C.length > 40 ? `<div class="hint">${t('{n} autres dans Stock', { n: C.length - 40 })}</div>` : ''}</div></section>`;
  }).join('')}</div>`;
}
function buyersHTML() {
  const q = query.trim().toLowerCase(), C = contacts().filter(c => !q || c.nom.toLowerCase().includes(q)), td = today();
  return `<div class="srch"><input type="search" id="crm_q" value="${esc(query)}" placeholder="${esc(t('Chercher un acheteur (@pseudo)'))}" autocomplete="off" autocapitalize="none"></div>
   ${C.length ? C.map(c => `<button type="button" class="li cxct" data-ct="${esc(c.k)}"><div class="m"><b>@${esc(c.nom)}</b><small>${esc([tn(c.n, 'achat', 'achats'), c.last ? t('dernier {d}', { d: fd(c.last) }) : '', c.offres.length ? tn(c.offres.length, 'offre', 'offres') : ''].filter(Boolean).join(' · '))}</small></div><div class="p"><span class="tag${c.tag === 'fidele' ? '' : ' x'}">${t(TAGL[c.tag])}</span>${c.relance ? `<small class="${c.relance <= td ? 'cxr' : ''}">${t('relance {d}', { d: fd(c.relance) })}</small>` : `<small>${eurR(c.ca)}</small>`}</div></button>`).join('') : `<div class="empty">${t('Aucun acheteur pour l\'instant. Les acheteurs apparaissent dès qu\'une vente ou une offre porte un pseudo.')}</div>`}`;
}
function activityHTML() {
  const A = activity(25);
  return A.length ? A.map(x => `<button type="button" class="li" data-id="${esc(x.p.id)}" style="margin-bottom:6px"><div class="m"><b>${esc(title(x.p))}</b><small>${esc(trEv(x.e))}</small></div><div class="p"><small>${esc(fd(new Date(x.t).toISOString().slice(0, 10)))}</small></div></button>`).join('') : `<div class="empty">${t('Le journal se remplit au fil des actions sur tes pièces.')}</div>`;
}
function tilesHTML() {
  const T = crmTodo();
  const off = T.offres.reduce((a, p) => a + ((p.offre || {}).m || 0), 0);
  const tile = (n, l, go) => `<button type="button" class="cxk" data-crg="${go}"><b>${n}</b><span>${t(l)}</span></button>`;
  return `<div class="cxks">${tile(T.offres.length + (off ? ' · ' + eurR(off) : ''), 'offres en cours', 'offre')}${tile(T.envoyer.length, 'à expédier', 'envoyer')}${tile(T.relances.length, 'acheteurs à relancer', 'buyers')}${tile(T.dormantes.length, 'annonces dormantes', 'ligne')}</div>`;
}
function draw() {
  const box = $('crm'); if (!box || box.hidden) return;
  box.innerHTML = `<div class="cxh"><span class="tag x">${t('Test')}</span><span class="hint" style="margin:0">${t('Le stock vu comme un CRM : fais avancer tes pièces et suis tes acheteurs.')}</span></div>${tilesHTML()}
   <div class="chips" style="margin:0 0 12px">${[['pipe', 'Pipeline'], ['buyers', 'Acheteurs'], ['log', 'Activité']].map(([k, l]) => `<button type="button" class="chip sm${sub === k ? ' on' : ''}" data-crs="${k}">${t(l)}</button>`).join('')}</div>
   ${sub === 'pipe' ? pipelineHTML() : sub === 'buyers' ? buyersHTML() : activityHTML()}`;
  hydrate();
}
export const crmDraw = draw;
/** Ouvre directement un sous-écran du CRM : 'pipe', 'buyers' ou 'log'. */
export function crmSub(k) { sub = ['pipe', 'buyers', 'log'].includes(k) ? k : 'pipe'; LSs('crmSub', sub); draw(); }
app.crmSub = crmSub;
let mode = LSg('stkMode', 'stock');
function applyMode() {
  const crm = $('crm'); if (!crm) return;
  const on = mode === 'crm';
  crm.hidden = !on;
  ['q', 'flt', 'lst'].forEach(id => { const e = $(id); if (e) { const w = id === 'q' ? e.closest('.srch') : e; if (w) w.hidden = on; } });
  document.querySelectorAll('#smode [data-smode]').forEach(b => b.classList.toggle('on', b.dataset.smode === mode));
  if (on) draw();
}
export function setStockMode(m) { mode = m === 'crm' ? 'crm' : 'stock'; LSs('stkMode', mode); applyMode(); }
app.setStockMode = setStockMode;

const renderList0 = app.renderList;
app.renderList = function () { renderList0.apply(this, arguments); applyMode(); };

const host = $('v-list');
host.addEventListener('click', e => {
  const sm = e.target.closest('[data-smode]'); if (sm) return setStockMode(sm.dataset.smode);
  if (mode !== 'crm' || $('crm').hidden) return;
  const s = e.target.closest('[data-crs]'); if (s) { sub = s.dataset.crs; LSs('crmSub', sub); return draw(); }
  const g = e.target.closest('[data-crg]');
  if (g) { const k = g.dataset.crg; sub = k === 'buyers' ? 'buyers' : 'pipe'; LSs('crmSub', sub); draw(); if (k !== 'buyers') { const c = document.querySelector(`#crm [data-stage="${k}"]`); if (c) c.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' }); } return; }
  const cm = e.target.closest('[data-cm]'); if (cm) return openMove(cm.dataset.cm);
  const ct = e.target.closest('[data-ct]'); if (ct) return openContact(ct.dataset.ct);
  const li = e.target.closest('.cxt[data-id], #crm .li[data-id]'); if (li) return app.openSheet(li.dataset.id);
});
host.addEventListener('input', e => { if (e.target.id === 'crm_q') { query = e.target.value; const pos = e.target.selectionStart; draw(); const i = $('crm_q'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) { /* champ non sélectionnable */ } } } });
/* glisser-déposer sur ordinateur : lâcher la carte sur une colonne la déplace */
host.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.cxc'); if (c && e.dataTransfer) { e.dataTransfer.setData('text/plain', c.dataset.cid); e.dataTransfer.effectAllowed = 'move'; } });
host.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('.cxcol')) e.preventDefault(); });
host.addEventListener('drop', e => { const col = e.target.closest && e.target.closest('.cxcol'); if (!col || !e.dataTransfer) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { const p = app.P.find(x => x.id === id); moveTo(id, !sold(p) && col.dataset.stage === 'envoyer' ? 'vendu' : col.dataset.stage); draw(); } });
