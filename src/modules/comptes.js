import { app } from '../state.js';
import { $, LSg, LSs, esc, num, sold } from './core.js';
import { CFG0 } from './settings-core.js';
import { pfName, pfShow } from './platforms.js';

/* ---------- comptes de vente ---------- */
/* Un compte = un endroit où tu vends : « Vinted pro », « Vinted perso », un compte Leboncoin…
   Chaque compte a sa plateforme, son type (pro ou particulier), sa commission et dit s'il compte pour le chiffre d'affaires à déclarer.
   Sans aucun compte, tout fonctionne comme avant. Avec des comptes :
   - une vente garde son compte (champ `cpt`), choisi à la vente ou proposé d'après la plateforme ;
   - les ventes d'avant (sans `cpt`) sont rattachées au compte principal ;
   - les frais préremplis suivent la commission du compte ;
   - la Ligne fiscale ne compte que les comptes marqués « pour l'URSSAF ». */
Object.assign(CFG0, { comptes: [], cptMain: '' });

export const comptes = () => (Array.isArray(app.cfg.comptes) ? app.cfg.comptes : []);
export const hasComptes = () => comptes().length > 0;
export const compteById = id => (id ? comptes().find(c => c.id === id) || null : null);
const PF = ['Vinted', 'TikTok Live', 'Autre'];
const pfLabel = v => (v === 'Autre' ? t('Autre') : pfShow(v));

/** Compte proposé pour une nouvelle vente sur cette plateforme : le dernier utilisé, parmi ceux de la plateforme. */
export function compteDef(canal) {
  const L = comptes(); if (!L.length) return null;
  const same = L.filter(c => c.pf === canal), pool = same.length ? same : L, last = LSg('lastCompte', '');
  return pool.find(c => c.id === last) || pool[0];
}
/** Compte d'une vente : celui qu'elle porte, sinon (ventes d'avant les comptes) le compte principal. */
export function compteOf(p) {
  const L = comptes(); if (!L.length || !p) return null;
  const c = compteById(p.cpt); if (c) return c;
  const main = compteById(app.cfg.cptMain) || L[0], canal = p.canal || 'Vinted';
  return main.pf === canal ? main : L.find(x => x.pf === canal) || main;
}
export const cptName = p => { const c = compteOf(p); return c ? c.n : ''; };
export const countsForFisc = p => { if (!hasComptes()) return true; const c = compteOf(p); return !c || c.fiscal !== false; };
/** Commission (%) propre au compte, ou null pour garder celle de la plateforme. */
export function cptCom(id, canal) {
  const c = id ? compteById(id) : compteDef(canal);
  return c && c.com !== undefined && c.com !== null && c.com !== '' && !isNaN(+c.com) ? +c.com : null;
}
const comDefaut = pf => (pf === 'Vinted' ? app.cfg.comV : pf === 'TikTok Live' ? app.cfg.comT : 0) || 0;

app.comptes = comptes; app.hasComptes = hasComptes; app.compteDef = compteDef; app.compteOf = compteOf;
app.cptName = cptName; app.countsForFisc = countsForFisc; app.cptCom = cptCom;

/* chaque vente reçoit son compte au moment où elle est faite (tous les chemins de vente passent par app.save) */
const save0 = app.save;
app.save = function (p, ...rest) {
  if (p && hasComptes()) {
    const o = app.P.find(x => x.id === p.id);
    if (sold(p) && !p.cpt && !(o && sold(o))) { const c = compteById(p.stk) || compteDef(p.canal || 'Vinted'); if (c) p = Object.assign({}, p, { cpt: c.id }); }
    else if (!sold(p) && p.cpt) { p = Object.assign({}, p); delete p.cpt; }
  }
  return save0.call(this, p, ...rest);
};

/* ---------- choix du compte dans les fenêtres de vente ---------- */
const mark = (e, id) => { e.dataset.sel = id; e.querySelectorAll('[data-cptc]').forEach(b => b.classList.toggle('on', b.dataset.cptc === id)); };
app.cptField = (id, sel) => !hasComptes() ? '' : `<div class="fld"><span class="l">${t('Compte de vente')}</span><div class="chips sug" id="${id}" data-sel="${esc(sel || '')}">${comptes().map(a => `<button type="button" class="chip sm${a.id === sel ? ' on' : ''}" data-cptc="${esc(a.id)}">${esc(a.n)}</button>`).join('')}</div></div>`;
app.cptSel = id => { const e = $(id); return e ? e.dataset.sel || '' : ''; };
/** La plateforme a changé : si le compte choisi n'est pas de cette plateforme, on passe à celui de la plateforme. */
app.cptFollow = (id, canal) => {
  const e = $(id); if (!e) return '';
  const cur = compteById(e.dataset.sel);
  if (!cur || cur.pf !== canal) { const d = compteDef(canal); if (d && d.pf === canal) mark(e, d.id); }
  return e.dataset.sel;
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cptc]'); if (!b) return;
  const box = b.closest('.chips[data-sel]'), a = compteById(b.dataset.cptc); if (!box || !a) return;
  mark(box, a.id); LSs('lastCompte', a.id);
  const pre = box.id.replace('_cpt', ''), plat = $(pre + '_plat');
  if (plat) {
    plat.value = pfShow(a.pf);
    document.querySelectorAll(`[data-t="${pre}_plat"]`).forEach(c => c.classList.toggle('on', c.dataset.v === a.pf));
  }
  const prix = $(pre === 's' ? 's_prix' : 'e_prix');
  if (prix) prix.dispatchEvent(new Event('input', { bubbles: true }));
});

/* ---------- Réglages : carte « Comptes de vente » ---------- */
const save = (L, extra) => { const f = document.activeElement, c = $('cptc'); if (f && c && c.contains(f)) f.blur(); app.setCfg(Object.assign({ comptes: L }, extra || {})); app.toast(t('Réglage enregistré')); renderComptes(); app.renderAll(); };
const patch = (id, o) => save(comptes().map(c => (c.id === id ? Object.assign({}, c, o) : c)));

function row(a) {
  const id = esc(a.id), ph = String(comDefaut(a.pf)).replace('.', app.DS);
  return `<div class="cpr" data-cid="${id}">
   <div class="row2 fld"><div><label class="l" for="cp_n_${id}">${t('Nom')}</label><input type="text" id="cp_n_${id}" data-cf="n" value="${esc(a.n)}" maxlength="30" autocomplete="off"></div>
    <div><label class="l" for="cp_c_${id}">${t('Commission (%)')}</label><input type="text" inputmode="decimal" id="cp_c_${id}" data-cf="com" value="${a.com === undefined || a.com === null || a.com === '' ? '' : esc(String(a.com).replace('.', app.DS))}" placeholder="${esc(ph)}"></div></div>
   <div class="fld"><span class="l">${t('Plateforme')}</span><div class="chips">${PF.map(v => `<button type="button" class="chip sm${a.pf === v ? ' on' : ''}" data-cpf="${esc(v)}">${esc(pfLabel(v))}</button>`).join('')}</div></div>
   <div class="fld"><span class="l">${t('Type')}</span><div class="chips"><button type="button" class="chip sm${a.k !== 'perso' ? ' on' : ''}" data-ck="pro">${t('Pro')}</button><button type="button" class="chip sm${a.k === 'perso' ? ' on' : ''}" data-ck="perso">${t('Particulier')}</button></div></div>
   <label class="chk"><input type="checkbox" data-cfisc${a.fiscal !== false ? ' checked' : ''}><span>${t('Pris en compte dans mon chiffre d\'affaires à déclarer (URSSAF)')}</span></label>
   <button type="button" class="btn sm sec" data-cdel="1" style="margin-top:8px">${t('Supprimer ce compte')}</button></div>`;
}
export function renderComptes() {
  const c = $('cptc'); if (!c || c.contains(document.activeElement)) return;
  const L = comptes(), main = (compteById(app.cfg.cptMain) || L[0] || {}).id;
  c.innerHTML = `<h3>${t('Comptes de vente')}</h3><p class="sub">${t('Un compte est un endroit où tu vends, par exemple « Vinted pro » et « Vinted perso ». Chaque compte a ses frais, et tu choisis s\'il compte dans ton chiffre d\'affaires à déclarer. Sans compte, tout fonctionne comme avant.')}</p>
   ${L.map(row).join('')}
   ${L.length > 1 ? `<div class="fld"><label class="l" for="cp_main">${t('Compte principal')}</label><select id="cp_main">${L.map(a => `<option value="${esc(a.id)}"${a.id === main ? ' selected' : ''}>${esc(a.n)}</option>`).join('')}</select><div class="hint">${t('Tes ventes déjà enregistrées avant les comptes sont rattachées à ce compte.')}</div></div>` : ''}
   <div class="acts"><button type="button" class="btn sec" id="cp_add">${t('Ajouter un compte')}</button></div>
   <div class="hint">${t('Les ventes faites depuis un compte non coché ne comptent ni dans le chiffre d\'affaires à déclarer ni dans le plafond. Vérifie ce qui s\'applique à ton cas sur autoentrepreneur.urssaf.fr : revendre des pièces achetées pour la revente peut relever d\'une activité professionnelle, même depuis un compte particulier.')}</div>`;
}
app.renderComptes = renderComptes;

const card = $('cptc');
if (card) {
  card.addEventListener('click', e => {
    if (e.target.closest('#cp_add')) {
      const L = comptes(), a = { id: 'c' + Date.now().toString(36), n: L.length ? t('Compte {n}', { n: L.length + 1 }) : pfName(1), pf: 'Vinted', k: 'pro', fiscal: true };
      return save([...L, a], L.length ? null : { cptMain: a.id });
    }
    const r = e.target.closest('[data-cid]'); if (!r) return;
    const id = r.dataset.cid, pf = e.target.closest('[data-cpf]'), k = e.target.closest('[data-ck]');
    if (pf) return patch(id, { pf: pf.dataset.cpf });
    if (k) return patch(id, { k: k.dataset.ck, fiscal: k.dataset.ck !== 'perso' });
    if (e.target.closest('[data-cdel]')) {
      const L = comptes(), a = L.find(x => x.id === id), main = app.cfg.cptMain;
      save(L.filter(x => x.id !== id), main === id ? { cptMain: '' } : null);
      app.toast(t('Compte supprimé : {n}', { n: a.n }), () => save(L, { cptMain: main }));
    }
  });
  card.addEventListener('change', e => {
    if (e.target.id === 'cp_main') return save(comptes(), { cptMain: e.target.value });
    const r = e.target.closest('[data-cid]'); if (!r) return;
    const id = r.dataset.cid;
    if (e.target.matches('[data-cfisc]')) return patch(id, { fiscal: e.target.checked });
    if (e.target.dataset.cf === 'n') { const n = e.target.value.trim().slice(0, 30); if (n) patch(id, { n }); else renderComptes(); return; }
    if (e.target.dataset.cf === 'com') { const v = e.target.value.trim(), x = num(v); patch(id, { com: v === '' || isNaN(x) || x < 0 ? '' : x }); }
  });
}
