import { app } from '../state.js';
import { $, esc, eur, fd, num, today } from './core.js';
import { TI, TOOLS, sheetHead, showSheet } from './tools-index.js';
import { tx } from './storage.js';
import { hydrate, phImg } from './photos.js';
import { compressBlob } from './photo-compress.js';
import * as R from './reception-core.js';

/* ---------- Réceptionner un carton : écrans ---------- */
/* Cinq étapes : carton, constat, écarts, destination, validation. Le brouillon vit dans les réglages synchronisés (cfg.recep) : fermer Max au milieu ne perd rien.
   Les fiches créées sont des fiches Max ordinaires en « Pas Disponible » avec l'indicateur « brouillon » : elles ne sont pas publiables avant d'être complétées. */
TOOLS.splice(Math.max(0, TOOLS.findIndex(x => x.k === 'rappels')), 0,
  { k: 'recep', t: 'Réceptionner un carton', d: 'Compter, signaler les écarts et répartir les pièces d\'un carton, sans ressaisir', i: TI('<path d="M3 8l9-5 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>') });
const openTool0 = app.openTool; app.openTool = k => (k === 'recep' ? openReception() : openTool0(k));

const store = () => (app.cfg.recep && app.cfg.recep.v ? app.cfg.recep : R.emptyStore());
const putStore = s => app.setCfg({ recep: s });
let curId = '', pend = 0, msg = '', result = null;
const STEPS = ['Carton', 'Constat', 'Écarts', 'Destination', 'Validation'];
const GL = k => (k === 'V' ? t('À vérifier') : t('Grade') + ' ' + k);
const ballots = () => { const g = {}; app.P.forEach(p => { if (p.ballot) g[p.ballot] = (g[p.ballot] || 0) + (p.achat || 0); }); return g; };
const n0 = v => (v == null ? '' : String(v));
const fld = (id, label, val, ph, extra) => `<div class="fld"><label class="l" for="${id}">${label}</label><input type="text" inputmode="${extra || 'text'}" id="${id}" value="${esc(n0(val))}" placeholder="${esc(ph || '')}" autocomplete="off"></div>`;
const cur = () => R.find(store(), curId);
const scrollKeep = f => { const s = $('sheet') && $('sheet').firstElementChild, y = s ? s.scrollTop : 0; f(); const s2 = $('sheet') && $('sheet').firstElementChild; if (s2) s2.scrollTop = y; };

/* ---- accueil de l'outil ---- */
function listHTML(st) {
  const dr = st.items.filter(x => x.state === 'draft' || x.state === 'confirming'), done = st.items.filter(x => x.state === 'confirmed');
  const row = x => { const rt = R.receivedTotal(x); return `<button type="button" class="li" data-rc="open" data-id="${esc(x.id)}" style="margin-bottom:8px"><div class="m"><b>${esc(x.ballot || t('Carton sans nom'))}</b><small>${esc(x.supplier || '')}${x.receivedAt ? ' · ' + fd(x.receivedAt) : ''} · ${rt == null ? t('quantité non vérifiée') : t('{n} reçue(s)', { n: rt })}</small></div><div class="p">${x.state === 'confirmed' ? t('Validée') : x.state === 'confirming' ? t('À terminer') : t('Étape {n}/5', { n: x.step })}</div></button>`; };
  return `<p class="sub">${t('Un carton arrive : compte, signale ce qui cloche, puis répartis les pièces entre brouillons de fiches, ballot pour un live, mise de côté ou « à traiter ». Rien n\'est mis en ligne.')}</p>
  <div class="acts" style="margin:0 0 12px"><button type="button" class="btn mint" data-rc="new">${t('Nouveau carton')}</button></div>
  ${dr.length ? `<div class="card"><h3>${t('À reprendre')}</h3>${dr.map(row).join('')}</div>` : ''}
  ${done.length ? `<div class="card"><h3>${t('Déjà validés')}</h3>${done.map(row).join('')}</div>` : ''}`;
}
export function openReception(id) {
  if (id !== undefined) { curId = id; result = null; }
  const st = store(), r = curId && R.find(st, curId);
  if (!r) { curId = ''; showSheet(sheetHead(t('Réceptionner un carton')) + listHTML(st)); $('shc').onclick = onClick; return; }
  const body = r.state === 'confirmed' || result ? doneHTML(r) : [step1, step2, step3, step4, step5][r.step - 1](r, st);
  const dots = `<div class="chips" style="margin-bottom:12px">${STEPS.map((s, i) => `<span class="chip${r.step === i + 1 ? ' on' : ''}" style="pointer-events:none">${i + 1} · ${t(s)}</span>`).join('')}</div>`;
  showSheet(sheetHead(esc(r.ballot || t('Réceptionner un carton'))) + (r.state === 'confirmed' ? '' : dots) + (msg ? `<div class="hint" id="rc_msg" style="color:var(--red);margin-bottom:8px">${esc(msg)}</div>` : '') + body);
  hydrate(); $('shc').onclick = onClick; $('shc').onchange = onChange;
}
const nav = (r, last) => `<div class="acts two" style="margin-top:12px">${r.step > 1 ? `<button type="button" class="btn sec" data-rc="back">${t('Retour')}</button>` : `<button type="button" class="btn sec" data-rc="later">${t('Reprendre plus tard')}</button>`}${last || `<button type="button" class="btn mint" data-rc="next">${t('Suite')}</button>`}</div>${r.step > 1 ? `<div class="acts" style="margin:0"><button type="button" class="btn sec sm" data-rc="later">${t('Reprendre plus tard')}</button></div>` : ''}`;

/* ---- 1 · quel carton ---- */
function step1(r, st) {
  const B = ballots(), names = Object.keys(B), known = r.ballot && B[r.ballot] > 0 ? B[r.ballot] : 0, before = R.priorReceived(st, r.ballot, r.orderRef, r.id), exp = R.expectedTotalOf(r);
  return `<div class="card"><h3>${t('Quel carton viens-tu de recevoir ?')}</h3>
  <div class="fld"><label class="l" for="rc_b">${t('Ballot')}</label><input type="text" id="rc_b" list="rc_bl" value="${esc(r.ballot)}" placeholder="${t('Choisis un ballot ou écris-en un nouveau')}" autocomplete="off"><datalist id="rc_bl">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
  <div class="row2 fld"><div><label class="l" for="rc_s">${t('Fournisseur ou provenance')}</label><input type="text" id="rc_s" value="${esc(r.supplier)}" autocomplete="off"></div><div><label class="l" for="rc_d">${t('Date de réception')}</label><input type="date" id="rc_d" value="${esc(r.receivedAt || today())}"></div></div>
  <div class="row2 fld"><div><label class="l" for="rc_c">${t('Coût livré (€), si connu')}</label><input type="text" inputmode="decimal" id="rc_c" value="${r.costCents == null ? '' : String(r.costCents / 100).replace('.', ',')}" placeholder="${t('non renseigné')}"></div><div><label class="l" for="rc_o">${t('Référence de commande')}</label><input type="text" id="rc_o" value="${esc(r.orderRef)}" autocomplete="off"></div></div>
  ${known ? `<div class="hint">${t('Ce ballot a déjà un coût dans Max : {c} (somme des fiches). Ne le saisis pas une seconde fois si c\'est le même achat.', { c: eur(known) })}</div>` : ''}
  <div class="fld"><label class="l" for="rc_et">${t('Nombre de pièces attendues, si connu')}</label><input type="text" inputmode="numeric" id="rc_et" value="${n0(r.expectedTotal)}" placeholder="${t('non renseigné')}"></div>
  <div class="row3 fld">${R.GRADES.map(g => `<div><label class="l" for="rc_e${g}">${t('Grade {g} attendu', { g })}</label><input type="text" inputmode="numeric" id="rc_e${g}" value="${n0(r.expected[g])}"></div>`).join('')}</div>
  ${before ? `<div class="hint">${t('Déjà reçu sur cette commande : {a}. Quantité restante attendue : {b}.', { a: before, b: exp == null ? t('inconnue') : Math.max(0, exp - before) })}</div>` : ''}
  <div class="hint">${t('Un champ vide veut dire « non renseigné », pas zéro.')}</div></div>${nav(r)}`;
}
/* ---- 2 · qu'as-tu constaté ---- */
function step2(r, st) {
  const g = R.gaps(r, R.priorReceived(st, r.ballot, r.orderRef, r.id)), rt = R.receivedTotal(r);
  const sum = `<div class="hint" id="rc_sum" style="margin-top:8px"><b>${rt == null ? t('Quantité non vérifiée') : t('{n} reçue(s)', { n: rt })}</b>${g.known ? ` · ${t('attendu')} ${g.expected}${g.downgraded ? ' · ' + t('{n} déclassée(s)', { n: g.downgraded }) : ''}${g.missing ? ' · ' + t('{n} manquante(s)', { n: g.missing }) : g.remaining ? ' · ' + t('Quantité restante attendue : {n}', { n: g.remaining }) : ''}${g.over ? ' · ' + t('{n} en trop', { n: g.over }) : ''}` : ''}</div>`;
  const closeWait = g.known && g.remaining > 0 ? `<label class="chk cfr" style="margin-top:8px"><input type="checkbox" id="rc_cw"${r.closeWait ? ' checked' : ''}><span><b>${t('Je clos l\'attente : le reste est manquant')}</b><small>${t('Tant que ce n\'est pas coché, ce qui n\'est pas arrivé reste « attendu ».')}</small></span></label>` : '';
  return `<div class="card"><h3>${t('Qu\'as-tu constaté ?')}</h3>
  <div class="chips" style="margin-bottom:10px"><button type="button" class="chip${r.mode === 'count' ? ' on' : ''}" data-rc="mode" data-v="count">${t('Je compte et je trie')}</button><button type="button" class="chip${r.mode === 'closed' ? ' on' : ''}" data-rc="mode" data-v="closed">${t('Je garde le ballot fermé')}</button></div>
  ${r.mode === 'count' ? `<div class="row2 fld">${R.SLOT_KEYS.map(k => `<div><label class="l" for="rc_n${k}">${GL(k)}</label><input type="text" inputmode="numeric" id="rc_n${k}" value="${n0(r.counts[k])}"></div>`).join('')}</div><div class="hint">${t('Chaque pièce est comptée dans une seule case. « À vérifier » veut dire reçue, pas manquante.')}</div>`
    : `<div class="fld"><label class="l" for="rc_ct">${t('Quantité totale (facultatif)')}</label><input type="text" inputmode="numeric" id="rc_ct" value="${r.unverified ? '' : n0(r.closedTotal)}"${r.unverified ? ' disabled' : ''}></div><label class="chk cfr"><input type="checkbox" id="rc_uv"${r.unverified ? ' checked' : ''}><span><b>${t('Quantité non vérifiée')}</b><small>${t('Max n\'invente ni grades, ni nombre de pièces, ni taux de vente.')}</small></span></label>`}
  ${sum}${closeWait}</div>${nav(r)}`;
}
/* ---- 3 · écarts ---- */
function step3(r) {
  const list = r.issues.map((x, i) => `<div style="padding:8px 0;border-top:1px solid var(--soft)"><div style="display:flex;justify-content:space-between;gap:8px"><b>${t(R.ISSUE_LABEL[x.type])}${x.qty != null ? ' ×' + x.qty : ''}</b><button type="button" class="btn sm sec" data-rc="idel" data-i="${i}">${t('Retirer')}</button></div>${x.note ? `<div class="hint">${esc(x.note)}</div>` : ''}<div>${(x.photos || []).map(id => phImg(id, 'pfi')).join('')}</div></div>`).join('');
  return `<div class="card"><h3>${t('Des écarts à signaler ?')}</h3><p class="sub">${t('Ces écarts décrivent le carton : ils ne retirent rien du stock une seconde fois.')}</p>${list || `<div class="empty" style="padding:10px 6px">${t('Aucun écart signalé.')}</div>`}</div>
  <div class="card"><h3>${t('Ajouter un écart')}</h3><div class="fld"><select id="rc_it">${R.ISSUE_TYPES.map(k => `<option value="${k}">${t(R.ISSUE_LABEL[k])}</option>`).join('')}</select></div>
  <div class="row2 fld"><div><label class="l" for="rc_iq">${t('Quantité')}</label><input type="text" inputmode="numeric" id="rc_iq"></div><div><label class="l" for="rc_in">${t('Note')}</label><input type="text" id="rc_in" autocomplete="off"></div></div>
  <div class="fld"><label class="btn sec" style="cursor:pointer;display:block;text-align:center">${t('Ajouter une photo')}<input type="file" accept="image/*" capture="environment" id="rc_ip" hidden></label><div class="hint" id="rc_pn">${pend ? t('{n} photo(s) en cours d\'enregistrement…', { n: pend }) : ''}</div><div id="rc_pl">${(draftPhotos[curId] || []).map(id => phImg(id, 'pfi')).join('')}</div></div>
  <button type="button" class="btn sm mint" data-rc="iadd">${t('Ajouter cet écart')}</button></div>
  <div class="acts" style="margin:0"><button type="button" class="btn sec" data-rc="sup">${t('Préparer le récap fournisseur')}</button></div>${nav(r)}`;
}
const draftPhotos = {};
/* ---- 4 · où vont les pièces ---- */
function step4(r) {
  const A = R.allocation(r), lbl = { draft: 'Créer les brouillons', ballot: 'Garder en ballot', quarantine: 'Mettre de côté' };
  if (r.mode === 'closed') {
    const a = Object.assign({ ballot: null, quarantine: null }, r.alloc.T), tot = R.receivedTotal(r);
    return `<div class="card"><h3>${t('Où vont les pièces ?')}</h3><p class="sub">${tot == null ? t('Quantité non vérifiée : le ballot peut être préparé pour un live sans chiffre. Pour en détailler une partie, compte d\'abord cette partie.') : t('{n} pièce(s) non triée(s).', { n: tot })}</p>
    <div class="row2 fld"><div><label class="l" for="rc_al_T_ballot">${t(lbl.ballot)}</label><input type="text" inputmode="numeric" id="rc_al_T_ballot" value="${n0(a.ballot)}" placeholder="${tot == null ? t('inconnue') : String(tot)}"${tot == null ? ' disabled' : ''}></div><div><label class="l" for="rc_al_T_quarantine">${t(lbl.quarantine)}</label><input type="text" inputmode="numeric" id="rc_al_T_quarantine" value="${n0(a.quarantine)}"${tot == null ? ' disabled' : ''}></div></div>
    ${tot != null ? `<div class="hint">${t('Laissé à traiter : {n}', { n: A.rows[0].unprocessed })}</div>` : ''}</div>${nav(r)}`;
  }
  const rows = A.rows.filter(x => x.received > 0 || x.k !== 'V').filter(x => x.received > 0).map(x => `<div style="padding:8px 0;border-top:1px solid var(--soft)"><div style="display:flex;justify-content:space-between"><b>${GL(x.k)}</b><span>${t('{n} reçue(s)', { n: x.received })}</span></div>
    <div class="row3 fld">${['draft', 'ballot', 'quarantine'].map(tg => `<div><label class="l" for="rc_al_${x.k}_${tg}">${t(lbl[tg])}</label><input type="text" inputmode="numeric" id="rc_al_${x.k}_${tg}" value="${x[tg] || ''}"></div>`).join('')}</div>
    <div class="hint" style="color:${x.unprocessed < 0 ? 'var(--red)' : 'inherit'}">${x.unprocessed < 0 ? t('Trop de pièces ventilées : {n} en trop.', { n: -x.unprocessed }) : t('Laissé à traiter : {n}', { n: x.unprocessed })}</div></div>`).join('');
  return `<div class="card"><h3>${t('Où vont les pièces ?')}</h3>${rows || `<div class="empty">${t('Compte d\'abord les pièces à l\'étape précédente.')}</div>`}
  <div class="acts" style="margin:8px 0 0"><button type="button" class="btn sm sec" data-rc="alldraft">${t('Tout en brouillons')}</button></div></div>${nav(r)}`;
}
/* ---- 5 · récap ---- */
function step5(r, st) {
  const c = R.recap(r), err = R.validate(r), rr = Object.assign({}, r, { costCents: costOf(st, r) }), uc = R.unitCost(rr, { denominator: denom(st, r) });
  const L = [[c.drafts, 'brouillon(s) prêt(s) à compléter'], [c.ballot, 'pièce(s) en ballot'], [c.quarantine, 'pièce(s) mise(s) de côté'], [c.unprocessed, 'pièce(s) laissée(s) à traiter'], [c.missing, 'pièce(s) manquante(s) signalée(s)'], [c.downgraded, 'pièce(s) déclassée(s)']].filter(x => x[0]);
  const carried = uc != null && costOf(st, r) != null ? Math.max(0, costOf(st, r) / 100 - uc * c.drafts) : null;
  const E = { ballot_manquant: 'Donne un nom de ballot (étape 1).', rien_compte: 'Compte au moins une pièce (étape 2).', ventilation_depasse: 'Une ventilation dépasse ce qui a été reçu (étape 4).', brouillons_sans_tri: 'Impossible de créer des brouillons sans tri.', quantite_inconnue_et_isolees: 'Quantité inconnue : impossible d\'isoler un nombre précis.' };
  return `<div class="card"><h3>${t('Voici ce qui va être enregistré')}</h3>${L.length ? L.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${t(x[1])}</span><b>${x[0]}</b></div>`).join('') : `<div class="hint">${c.unverified ? t('Ballot fermé, quantité non vérifiée : aucune fiche n\'est créée.') : t('Rien à créer.')}</div>`}
  ${uc != null ? `<div class="hint" style="margin-top:8px">${t('Chaque brouillon reçoit {c} de coût (répartition indicative du coût livré, pas un second achat).', { c: eur(uc) })}${carried ? ' ' + t('{c} du coût ne sont portés par aucune fiche tant que le reste n\'est pas détaillé.', { c: eur(carried) }) : ''}</div>` : (c.drafts ? `<div class="hint" style="margin-top:8px">${t('Coût ou quantité inconnus : les brouillons sont créés sans prix d\'achat.')}</div>` : '')}
  ${c.remaining && !r.closeWait ? `<div class="hint">${t('Quantité restante attendue : {n}', { n: c.remaining })}</div>` : ''}</div>
  ${err.length ? `<div class="card" style="border-color:var(--red)">${err.map(e => `<div class="hint" style="color:var(--red)">${t(E[e.code] || 'À corriger')}</div>`).join('')}</div>` : ''}
  ${r.state === 'confirming' ? `<div class="hint">${t('Une validation précédente n\'est pas terminée : {a} sur {b} fiches enregistrées. Relance-la, rien ne sera dupliqué.', { a: (r.created || []).length, b: R.slots(r).length })}</div>` : ''}
  <div class="acts two" style="margin-top:12px"><button type="button" class="btn sec" data-rc="back">${t('Retour')}</button><button type="button" class="btn mint" data-rc="confirm"${err.length ? ' disabled' : ''}>${r.state === 'confirming' ? t('Terminer la validation') : t('Valider la réception')}</button></div>
  <div class="acts" style="margin:0"><button type="button" class="btn sec sm" data-rc="later">${t('Reprendre plus tard')}</button></div>`;
}
function doneHTML(r) {
  const c = R.recap(r), pieces = R.slots(r).map(s => app.P.find(p => p.id === s.pieceId)).filter(Boolean);
  return `<div class="card"><h3>${t('Réception validée')}</h3>${[[c.drafts, 'brouillon(s) prêt(s) à compléter'], [c.ballot, 'pièce(s) en ballot'], [c.quarantine, 'pièce(s) mise(s) de côté'], [c.unprocessed, 'pièce(s) laissée(s) à traiter'], [c.missing, 'pièce(s) manquante(s) signalée(s)']].filter(x => x[0]).map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${t(x[1])}</span><b>${x[0]}</b></div>`).join('') || `<div class="hint">${t('Aucune fiche créée.')}</div>`}</div>
  ${pieces.length ? `<div class="card"><h3>${t('Brouillons à compléter')}</h3>${pieces.slice(0, 40).map(p => `<button type="button" class="li" data-rc="piece" data-id="${esc(p.id)}" style="margin-bottom:6px"><div class="m"><b>${esc(p.code || p.id)}</b><small>${esc([p.grade ? t('Grade') + ' ' + p.grade : '', p.averifier ? t('À vérifier') : ''].filter(Boolean).join(' · '))}</small></div></button>`).join('')}${pieces.length > 40 ? `<div class="hint">${t('… et {n} autre(s).', { n: pieces.length - 40 })}</div>` : ''}</div>` : ''}
  <div class="acts"><button type="button" class="btn sec" data-rc="sup">${t('Voir le récap fournisseur')}</button>${c.ballot !== 0 && app.openLiveco ? `<button type="button" class="btn sec" data-rc="live">${t('Associer à un live')}</button>` : ''}<button type="button" class="btn sec" data-rc="list">${t('Retour aux cartons')}</button></div>`;
}

/* ---- coût : porté une seule fois par la commande ---- */
const costOf = (st, r) => { if (R.find(st, r.id) && typeof r.costCents === 'number') return r.costCents; const o = st.items.find(x => x.id !== r.id && x.state === 'confirmed' && x.ballot === r.ballot && (x.orderRef || '') === (r.orderRef || '') && typeof x.costCents === 'number'); return o ? o.costCents : null; };
const denom = (st, r) => { const before = R.priorReceived(st, r.ballot, r.orderRef, r.id), rt = R.receivedTotal(r), ex = R.expectedTotalOf(r); if (rt == null) return null; return r.closeWait || ex == null ? before + rt : ex; };

/* ---- lecture des champs de l'étape ---- */
function readStep(r) {
  const v = id => ($(id) ? $(id).value : undefined), I = x => R.cl({ v: x }).v, p = {};
  if (r.step === 1 && $('rc_b')) {
    p.ballot = v('rc_b').trim(); p.supplier = v('rc_s').trim(); p.receivedAt = v('rc_d') || today(); p.orderRef = v('rc_o').trim();
    const c = v('rc_c').trim(), n = c === '' ? NaN : num(c); p.costCents = isNaN(n) || n < 0 ? null : Math.round(n * 100);
    const iv = x => { const s = String(x).trim(); if (s === '') return null; const k = Math.floor(num(s)); return isNaN(k) || k < 0 ? null : k; };
    p.expectedTotal = iv(v('rc_et')); p.expected = { A: iv(v('rc_eA')), B: iv(v('rc_eB')), C: iv(v('rc_eC')) };
  }
  if (r.step === 2) {
    const iv = x => { const s = String(x == null ? '' : x).trim(); if (s === '') return null; const k = Math.floor(num(s)); return isNaN(k) || k < 0 ? null : k; };
    if (r.mode === 'count' && $('rc_nA')) p.counts = { A: iv(v('rc_nA')), B: iv(v('rc_nB')), C: iv(v('rc_nC')), V: iv(v('rc_nV')) };
    if (r.mode === 'closed' && $('rc_uv')) { p.unverified = $('rc_uv').checked; p.closedTotal = p.unverified ? null : iv(v('rc_ct')); }
    if ($('rc_cw')) p.closeWait = $('rc_cw').checked;
  }
  if (r.step === 4) {
    const iv = x => { const s = String(x == null ? '' : x).trim(); if (s === '') return null; const k = Math.floor(num(s)); return isNaN(k) || k < 0 ? null : k; }, a = R.cl(r.alloc || {});
    ['A', 'B', 'C', 'V', 'T'].forEach(k => ['draft', 'ballot', 'quarantine'].forEach(tg => { const el = $('rc_al_' + k + '_' + tg); if (el) { a[k] = a[k] || {}; a[k][tg] = iv(el.value); } }));
    p.alloc = a;
  }
  return I(p);
}
function save(r, extra) { const p = Object.assign(readStep(r), extra || {}), res = R.patch(store(), r.id, r.rev, p); if (res.error) { msg = res.error === 'revision' ? t('Ce carton a changé ailleurs : recharge-le avant de continuer.') : t('Ce carton est verrouillé.'); return false; } putStore(res.store); msg = ''; return true; }

function onChange(e) {
  const r = cur(); if (!r || r.state !== 'draft') return;
  if (e.target.id === 'rc_ip') { addPhoto(e.target); return; }
  if (['rc_it', 'rc_iq', 'rc_in'].includes(e.target.id)) return;
  if (save(r)) scrollKeep(() => openReception());
}
async function addPhoto(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return; const id = 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); pend++; if ($('rc_pn')) $('rc_pn').textContent = t('{n} photo(s) en cours d\'enregistrement…', { n: pend });
  try { const b = await compressBlob(f, 1600, .8); await tx('photos', 'readwrite', s => s.put({ id, blob: b })); (draftPhotos[curId] = draftPhotos[curId] || []).push(id); } catch (e) { app.toast(t('Photo illisible')); }
  pend--; if ($('rc_pl')) { $('rc_pl').innerHTML = (draftPhotos[curId] || []).map(x => phImg(x, 'pfi')).join(''); hydrate(); } if ($('rc_pn')) $('rc_pn').textContent = pend ? t('{n} photo(s) en cours d\'enregistrement…', { n: pend }) : '';
}
function supplierSheet() {
  const r = cur(); if (!r) return; const txt = R.supplierText(r, window.t);
  const warn = pend ? `<div class="hint" style="color:var(--red)">${t('{n} photo(s) ne sont pas encore enregistrées : le récap sera généré sans elles.', { n: pend })}</div>` : '';
  showSheet(sheetHead(t('Récap fournisseur')) + `${warn}<div class="card"><pre id="rc_txt" style="white-space:pre-wrap;font:inherit;margin:0">${esc(txt)}</pre></div><div class="hint">${t('Max ne l\'envoie pas : copie-le ou imprime-le.')}</div>
  <div class="acts two"><button type="button" class="btn sec" data-rc="copy">${t('Copier')}</button><button type="button" class="btn sec" data-rc="print">${t('Imprimer')}</button></div><div class="acts"><button type="button" class="btn sec" data-rc="rback">${t('Retour')}</button></div>`);
  $('shc').onclick = onClick;
}
async function confirmReception() {
  const r0 = cur(); if (!r0) return; if (!save(r0)) return openReception();
  let st = store(); const opId = (R.find(st, r0.id).opId) || ('op' + Date.now().toString(36)), b = R.beginConfirm(st, r0.id, opId);
  if (b.error) { msg = b.error === 'invalide' ? t('Complète les points en rouge avant de valider.') : t('Validation impossible.'); return openReception(); }
  st = b.store; putStore(st); const r = R.find(st, r0.id), rr = Object.assign({}, r, { costCents: costOf(st, r) }), uc = R.unitCost(rr, { denominator: denom(st, r) }), made = [], have = [];
  for (const sl of R.slots(r)) {
    if (app.P.some(p => p.id === sl.pieceId)) { have.push(sl.pieceId); continue; }                 /* déjà créée par un essai précédent : on ne recrée pas */
    try { app.save(R.pieceFor(r, sl, uc, Date.now())); made.push(sl.pieceId); } catch (e) { msg = t('La validation s\'est arrêtée : {a} fiche(s) enregistrées sur {b}. Relance-la, rien ne sera dupliqué.', { a: made.length + have.length, b: R.slots(r).length }); putStore(R.markCreated(store(), r.id, made, have)); return openReception(); }
  }
  putStore(R.markCreated(store(), r.id, made, have)); result = { made: made.length, have: have.length }; msg = ''; app.toast(t('Réception validée'));
  openReception();
}
function onClick(e) {
  const b = e.target.closest('[data-rc]'); if (!b) return; const a = b.dataset.rc, r = cur();
  if (a === 'new') { const res = R.newReception(store(), { receivedAt: today() }); putStore(res.store); curId = res.id; result = null; msg = ''; return openReception(); }
  if (a === 'open') { curId = b.dataset.id; result = null; msg = ''; return openReception(); }
  if (a === 'list') { curId = ''; result = null; return openReception(); }
  if (a === 'later') { if (r && r.state === 'draft') save(r); curId = ''; $('sheet').hidden = true; app.toast(t('Brouillon gardé : tu peux le reprendre quand tu veux.')); return; }
  if (a === 'piece') { return app.openSheet(b.dataset.id); }
  if (a === 'live') { return app.openLiveco('conn'); }
  if (a === 'rback') return openReception();
  if (a === 'copy') { const x = $('rc_txt') && $('rc_txt').textContent; try { navigator.clipboard.writeText(x); app.toast(t('Copié')); } catch (err) { app.toast(t('Copie impossible')); } return; }
  if (a === 'print') { const x = $('rc_txt') && $('rc_txt').textContent; return app.printHTML('<div class="rp"><pre style="white-space:pre-wrap;font:inherit">' + esc(x) + '</pre></div>'); }
  if (!r) return;
  if (a === 'sup') { if (r.state === 'draft') save(r); return supplierSheet(); }
  if (r.state !== 'draft' && a !== 'confirm') return;
  if (a === 'next' || a === 'back') { if (!save(r)) return openReception(); const s2 = R.find(store(), r.id), n = Math.min(5, Math.max(1, s2.step + (a === 'next' ? 1 : -1))); putStore(R.patch(store(), r.id, null, { step: n }).store); return openReception(); }
  if (a === 'mode') { if (save(r, { mode: b.dataset.v })) return scrollKeep(() => openReception()); return openReception(); }
  if (a === 'iadd') {
    const q = $('rc_iq').value.trim(), qn = q === '' ? null : Math.floor(num(q)), type = $('rc_it').value, note = $('rc_in').value.trim(), ph = (draftPhotos[curId] || []).slice(); if (pend) return app.toast(t('Attends la fin de l\'enregistrement de la photo.'));
    const issues = r.issues.concat([{ type, qty: qn == null || isNaN(qn) ? null : qn, note, photos: ph }]); draftPhotos[curId] = []; save(r, { issues }); return openReception();
  }
  if (a === 'idel') { const issues = r.issues.filter((x, i) => i !== +b.dataset.i); save(r, { issues }); return openReception(); }
  if (a === 'alldraft') { const al = {}; R.SLOT_KEYS.forEach(k => { const n = R.receivedOf(r, k); if (n > 0) al[k] = { draft: n, ballot: null, quarantine: null }; }); save(r, { alloc: al }); return openReception(); }
  if (a === 'confirm') return confirmReception();
}
app.openReception = openReception;

/* ---------- traductions ---------- */
if (typeof window !== 'undefined' && window.K) {
  const K = window.K;
  [["Réceptionner un carton", "Receive a box", "Ricevere uno scatolone", "Recibir una caja", "Karton annehmen"],
    ["Compter, signaler les écarts et répartir les pièces d'un carton, sans ressaisir", "Count, report gaps and split the pieces of a box, without retyping", "Contare, segnalare le differenze e ripartire i pezzi di uno scatolone, senza riscrivere", "Contar, señalar diferencias y repartir las piezas de una caja, sin reescribir", "Zählen, Abweichungen melden und die Teile eines Kartons verteilen, ohne Neueingabe"],
    ["Carton", "Box", "Scatolone", "Caja", "Karton"], ["Constat", "Check", "Verifica", "Comprobación", "Befund"], ["Écarts", "Gaps", "Differenze", "Diferencias", "Abweichungen"], ["Destination", "Destination", "Destinazione", "Destino", "Ziel"], ["Validation", "Validation", "Convalida", "Validación", "Bestätigung"],
    ["À vérifier", "To check", "Da verificare", "Por comprobar", "Zu prüfen"], ["Grade", "Grade", "Grado", "Grado", "Güteklasse"], ["Carton sans nom", "Unnamed box", "Scatolone senza nome", "Caja sin nombre", "Karton ohne Namen"],
    ["quantité non vérifiée", "quantity not checked", "quantità non verificata", "cantidad no comprobada", "Menge nicht geprüft"], ["Quantité non vérifiée", "Quantity not checked", "Quantità non verificata", "Cantidad no comprobada", "Menge nicht geprüft"],
    ["{n} reçue(s)", "{n} received", "{n} ricevuto/i", "{n} recibido(s)", "{n} erhalten"], ["Validée", "Confirmed", "Convalidata", "Validada", "Bestätigt"], ["À terminer", "To finish", "Da finire", "Por terminar", "Zu beenden"], ["Étape {n}/5", "Step {n}/5", "Passo {n}/5", "Paso {n}/5", "Schritt {n}/5"],
    ["Un carton arrive : compte, signale ce qui cloche, puis répartis les pièces entre brouillons de fiches, ballot pour un live, mise de côté ou « à traiter ». Rien n'est mis en ligne.", "A box arrives: count, report what is wrong, then split the pieces between draft listings, a bale for a live, set aside, or “to process”. Nothing goes online.", "Arriva uno scatolone: conta, segnala cosa non va, poi ripartisci i pezzi tra bozze di schede, balla per un live, da parte o «da trattare». Nulla viene pubblicato.", "Llega una caja: cuenta, señala lo que falla y reparte las piezas entre borradores de fichas, fardo para un live, apartadas o «por tratar». No se publica nada.", "Ein Karton kommt an: zählen, Probleme melden, dann die Teile auf Entwürfe, einen Ballen für ein Live, Beiseite oder „zu bearbeiten“ verteilen. Nichts geht online."],
    ["Nouveau carton", "New box", "Nuovo scatolone", "Nueva caja", "Neuer Karton"], ["À reprendre", "To resume", "Da riprendere", "Por retomar", "Fortsetzen"], ["Déjà validés", "Already confirmed", "Già convalidati", "Ya validados", "Bereits bestätigt"],
    ["Quel carton viens-tu de recevoir ?", "Which box did you just receive?", "Quale scatolone hai appena ricevuto?", "¿Qué caja acabas de recibir?", "Welchen Karton hast du gerade erhalten?"], ["Ballot", "Bale", "Balla", "Fardo", "Ballen"], ["Choisis un ballot ou écris-en un nouveau", "Pick a bale or write a new one", "Scegli una balla o scrivine una nuova", "Elige un fardo o escribe uno nuevo", "Wähle einen Ballen oder schreibe einen neuen"],
    ["Fournisseur ou provenance", "Supplier or origin", "Fornitore o provenienza", "Proveedor u origen", "Lieferant oder Herkunft"], ["Date de réception", "Date received", "Data di ricezione", "Fecha de recepción", "Eingangsdatum"], ["Coût livré (€), si connu", "Delivered cost (€), if known", "Costo consegnato (€), se noto", "Coste entregado (€), si se conoce", "Lieferkosten (€), falls bekannt"], ["non renseigné", "not provided", "non indicato", "no indicado", "nicht angegeben"], ["Référence de commande", "Order reference", "Riferimento ordine", "Referencia de pedido", "Bestellreferenz"],
    ["Ce ballot a déjà un coût dans Max : {c} (somme des fiches). Ne le saisis pas une seconde fois si c'est le même achat.", "This bale already has a cost in Max: {c} (sum of the listings). Do not enter it a second time if it is the same purchase.", "Questa balla ha già un costo in Max: {c} (somma delle schede). Non inserirlo due volte se è lo stesso acquisto.", "Este fardo ya tiene un coste en Max: {c} (suma de las fichas). No lo introduzcas dos veces si es la misma compra.", "Dieser Ballen hat in Max schon Kosten: {c} (Summe der Artikel). Gib sie nicht doppelt ein, wenn es derselbe Einkauf ist."],
    ["Nombre de pièces attendues, si connu", "Expected number of pieces, if known", "Numero di pezzi attesi, se noto", "Número de piezas esperadas, si se conoce", "Erwartete Stückzahl, falls bekannt"], ["Grade {g} attendu", "Expected grade {g}", "Grado {g} atteso", "Grado {g} esperado", "Erwartete Klasse {g}"],
    ["Déjà reçu sur cette commande : {a}. Quantité restante attendue : {b}.", "Already received on this order: {a}. Remaining quantity expected: {b}.", "Già ricevuto su questo ordine: {a}. Quantità residua attesa: {b}.", "Ya recibido en este pedido: {a}. Cantidad restante esperada: {b}.", "Bereits erhalten: {a}. Noch erwartete Menge: {b}."], ["inconnue", "unknown", "sconosciuta", "desconocida", "unbekannt"],
    ["Un champ vide veut dire « non renseigné », pas zéro.", "An empty field means “not provided”, not zero.", "Un campo vuoto significa «non indicato», non zero.", "Un campo vacío significa «no indicado», no cero.", "Ein leeres Feld bedeutet „nicht angegeben“, nicht null."],
    ["Qu'as-tu constaté ?", "What did you find?", "Cosa hai constatato?", "¿Qué has comprobado?", "Was hast du festgestellt?"], ["Je compte et je trie", "I count and sort", "Conto e smisto", "Cuento y clasifico", "Ich zähle und sortiere"], ["Je garde le ballot fermé", "I keep the bale closed", "Tengo la balla chiusa", "Dejo el fardo cerrado", "Ich lasse den Ballen geschlossen"],
    ["Chaque pièce est comptée dans une seule case. « À vérifier » veut dire reçue, pas manquante.", "Each piece is counted in one box only. “To check” means received, not missing.", "Ogni pezzo è contato in una sola casella. «Da verificare» significa ricevuto, non mancante.", "Cada pieza se cuenta en una sola casilla. «Por comprobar» significa recibida, no falta.", "Jedes Teil wird in nur einem Feld gezählt. „Zu prüfen“ heißt erhalten, nicht fehlend."],
    ["Quantité totale (facultatif)", "Total quantity (optional)", "Quantità totale (facoltativo)", "Cantidad total (opcional)", "Gesamtmenge (optional)"], ["Max n'invente ni grades, ni nombre de pièces, ni taux de vente.", "Max invents no grades, piece counts or sell-through rates.", "Max non inventa gradi, numero di pezzi né tassi di vendita.", "Max no inventa grados, número de piezas ni tasas de venta.", "Max erfindet weder Klassen noch Stückzahlen noch Verkaufsquoten."],
    ["attendu", "expected", "atteso", "esperado", "erwartet"], ["{n} déclassée(s)", "{n} downgraded", "{n} declassato/i", "{n} degradada(s)", "{n} herabgestuft"], ["{n} manquante(s)", "{n} missing", "{n} mancante/i", "{n} faltante(s)", "{n} fehlend"], ["Quantité restante attendue : {n}", "Remaining quantity expected: {n}", "Quantità residua attesa: {n}", "Cantidad restante esperada: {n}", "Noch erwartete Menge: {n}"], ["{n} en trop", "{n} extra", "{n} in più", "{n} de más", "{n} zu viel"],
    ["Je clos l'attente : le reste est manquant", "I close the wait: the rest is missing", "Chiudo l'attesa: il resto manca", "Cierro la espera: el resto falta", "Ich schließe das Warten ab: der Rest fehlt"], ["Tant que ce n'est pas coché, ce qui n'est pas arrivé reste « attendu ».", "Until this is ticked, what has not arrived stays “expected”.", "Finché non è spuntato, ciò che non è arrivato resta «atteso».", "Mientras no esté marcado, lo que no ha llegado sigue «esperado».", "Solange das nicht angehakt ist, bleibt Fehlendes „erwartet“."],
    ["Des écarts à signaler ?", "Any gaps to report?", "Differenze da segnalare?", "¿Diferencias que señalar?", "Abweichungen zu melden?"], ["Ces écarts décrivent le carton : ils ne retirent rien du stock une seconde fois.", "These gaps describe the box: they remove nothing from stock a second time.", "Queste differenze descrivono lo scatolone: non tolgono nulla dallo stock una seconda volta.", "Estas diferencias describen la caja: no quitan nada del stock una segunda vez.", "Diese Abweichungen beschreiben den Karton: sie ziehen nichts ein zweites Mal vom Bestand ab."],
    ["Aucun écart signalé.", "No gap reported.", "Nessuna differenza segnalata.", "Ninguna diferencia señalada.", "Keine Abweichung gemeldet."], ["Ajouter un écart", "Add a gap", "Aggiungi una differenza", "Añadir una diferencia", "Abweichung hinzufügen"], ["Quantité", "Quantity", "Quantità", "Cantidad", "Menge"], ["Note", "Note", "Nota", "Nota", "Notiz"], ["Ajouter une photo", "Add a photo", "Aggiungi una foto", "Añadir una foto", "Foto hinzufügen"],
    ["{n} photo(s) en cours d'enregistrement…", "{n} photo(s) being saved…", "{n} foto in salvataggio…", "{n} foto(s) guardándose…", "{n} Foto(s) werden gespeichert…"], ["Ajouter cet écart", "Add this gap", "Aggiungi questa differenza", "Añadir esta diferencia", "Diese Abweichung hinzufügen"], ["Préparer le récap fournisseur", "Prepare the supplier recap", "Prepara il riepilogo per il fornitore", "Preparar el resumen para el proveedor", "Lieferanten-Zusammenfassung erstellen"],
    ["Quantité manquante", "Missing quantity", "Quantità mancante", "Cantidad faltante", "Fehlmenge"], ["Quantité en trop", "Extra quantity", "Quantità in eccesso", "Cantidad de más", "Zu viel geliefert"], ["Grade différent", "Different grade", "Grado diverso", "Grado distinto", "Andere Klasse"], ["Défaut", "Defect", "Difetto", "Defecto", "Mangel"], ["Article différent", "Different item", "Articolo diverso", "Artículo distinto", "Anderer Artikel"], ["Autre", "Other", "Altro", "Otro", "Sonstiges"],
    ["Où vont les pièces ?", "Where do the pieces go?", "Dove vanno i pezzi?", "¿Adónde van las piezas?", "Wohin gehen die Teile?"], ["Créer les brouillons", "Create drafts", "Crea le bozze", "Crear borradores", "Entwürfe anlegen"], ["Garder en ballot", "Keep as a bale", "Tieni come balla", "Mantener en fardo", "Als Ballen behalten"], ["Mettre de côté", "Set aside", "Metti da parte", "Apartar", "Beiseitelegen"],
    ["Quantité non vérifiée : le ballot peut être préparé pour un live sans chiffre. Pour en détailler une partie, compte d'abord cette partie.", "Quantity not checked: the bale can be prepared for a live without a number. To detail part of it, count that part first.", "Quantità non verificata: la balla può essere preparata per un live senza numero. Per dettagliarne una parte, conta prima quella parte.", "Cantidad no comprobada: el fardo puede prepararse para un live sin cifra. Para detallar una parte, cuenta antes esa parte.", "Menge nicht geprüft: Der Ballen kann ohne Zahl für ein Live vorbereitet werden. Um einen Teil zu detaillieren, zähle zuerst diesen Teil."],
    ["{n} pièce(s) non triée(s).", "{n} unsorted piece(s).", "{n} pezzo/i non smistato/i.", "{n} pieza(s) sin clasificar.", "{n} unsortierte(s) Teil(e)."], ["Laissé à traiter : {n}", "Left to process: {n}", "Da trattare: {n}", "Por tratar: {n}", "Zu bearbeiten: {n}"], ["Trop de pièces ventilées : {n} en trop.", "Too many pieces allocated: {n} too many.", "Troppi pezzi ripartiti: {n} in più.", "Demasiadas piezas repartidas: {n} de más.", "Zu viele Teile verteilt: {n} zu viel."],
    ["Compte d'abord les pièces à l'étape précédente.", "Count the pieces in the previous step first.", "Conta prima i pezzi nel passo precedente.", "Cuenta primero las piezas en el paso anterior.", "Zähle zuerst die Teile im vorherigen Schritt."], ["Tout en brouillons", "All as drafts", "Tutto in bozze", "Todo en borradores", "Alles als Entwürfe"],
    ["Voici ce qui va être enregistré", "Here is what will be recorded", "Ecco cosa verrà registrato", "Esto es lo que se registrará", "Das wird gespeichert"], ["brouillon(s) prêt(s) à compléter", "draft(s) ready to complete", "bozza/e da completare", "borrador(es) por completar", "Entwurf/Entwürfe zum Vervollständigen"], ["pièce(s) en ballot", "piece(s) kept as bale", "pezzo/i in balla", "pieza(s) en fardo", "Teil(e) im Ballen"], ["pièce(s) mise(s) de côté", "piece(s) set aside", "pezzo/i messo/i da parte", "pieza(s) apartada(s)", "Teil(e) beiseitegelegt"], ["pièce(s) laissée(s) à traiter", "piece(s) left to process", "pezzo/i da trattare", "pieza(s) por tratar", "Teil(e) zu bearbeiten"], ["pièce(s) manquante(s) signalée(s)", "missing piece(s) reported", "pezzo/i mancante/i segnalato/i", "pieza(s) faltante(s) señalada(s)", "fehlende(s) Teil(e) gemeldet"], ["pièce(s) déclassée(s)", "downgraded piece(s)", "pezzo/i declassato/i", "pieza(s) degradada(s)", "herabgestufte(s) Teil(e)"],
    ["Ballot fermé, quantité non vérifiée : aucune fiche n'est créée.", "Closed bale, quantity not checked: no listing is created.", "Balla chiusa, quantità non verificata: nessuna scheda viene creata.", "Fardo cerrado, cantidad no comprobada: no se crea ninguna ficha.", "Geschlossener Ballen, Menge nicht geprüft: Es wird kein Artikel angelegt."], ["Rien à créer.", "Nothing to create.", "Niente da creare.", "Nada que crear.", "Nichts anzulegen."],
    ["Chaque brouillon reçoit {c} de coût (répartition indicative du coût livré, pas un second achat).", "Each draft gets {c} of cost (indicative split of the delivered cost, not a second purchase).", "Ogni bozza riceve {c} di costo (ripartizione indicativa del costo consegnato, non un secondo acquisto).", "Cada borrador recibe {c} de coste (reparto indicativo del coste entregado, no una segunda compra).", "Jeder Entwurf erhält {c} Kosten (indikative Aufteilung der Lieferkosten, kein zweiter Einkauf)."], ["{c} du coût ne sont portés par aucune fiche tant que le reste n'est pas détaillé.", "{c} of the cost is carried by no listing until the rest is detailed.", "{c} del costo non sono portati da nessuna scheda finché il resto non è dettagliato.", "{c} del coste no lo lleva ninguna ficha hasta detallar el resto.", "{c} der Kosten trägt kein Artikel, bis der Rest detailliert ist."],
    ["Coût ou quantité inconnus : les brouillons sont créés sans prix d'achat.", "Unknown cost or quantity: drafts are created without a purchase price.", "Costo o quantità sconosciuti: le bozze sono create senza prezzo d'acquisto.", "Coste o cantidad desconocidos: los borradores se crean sin precio de compra.", "Kosten oder Menge unbekannt: Entwürfe ohne Einkaufspreis."],
    ["Donne un nom de ballot (étape 1).", "Give the bale a name (step 1).", "Dai un nome alla balla (passo 1).", "Dale un nombre al fardo (paso 1).", "Gib dem Ballen einen Namen (Schritt 1)."], ["Compte au moins une pièce (étape 2).", "Count at least one piece (step 2).", "Conta almeno un pezzo (passo 2).", "Cuenta al menos una pieza (paso 2).", "Zähle mindestens ein Teil (Schritt 2)."], ["Une ventilation dépasse ce qui a été reçu (étape 4).", "An allocation exceeds what was received (step 4).", "Una ripartizione supera quanto ricevuto (passo 4).", "Un reparto supera lo recibido (paso 4).", "Eine Verteilung übersteigt das Erhaltene (Schritt 4)."], ["Impossible de créer des brouillons sans tri.", "Cannot create drafts without sorting.", "Impossibile creare bozze senza smistamento.", "No se pueden crear borradores sin clasificar.", "Ohne Sortierung keine Entwürfe möglich."], ["Quantité inconnue : impossible d'isoler un nombre précis.", "Unknown quantity: cannot set aside an exact number.", "Quantità sconosciuta: impossibile isolare un numero preciso.", "Cantidad desconocida: no se puede apartar un número exacto.", "Unbekannte Menge: genaue Anzahl nicht beiseitelegbar."], ["À corriger", "To fix", "Da correggere", "Por corregir", "Zu korrigieren"],
    ["Une validation précédente n'est pas terminée : {a} sur {b} fiches enregistrées. Relance-la, rien ne sera dupliqué.", "A previous confirmation is not finished: {a} of {b} listings saved. Run it again, nothing will be duplicated.", "Una convalida precedente non è finita: {a} schede su {b} salvate. Rilanciala, nulla verrà duplicato.", "Una validación anterior no ha terminado: {a} de {b} fichas guardadas. Relánzala, nada se duplicará.", "Eine frühere Bestätigung ist nicht beendet: {a} von {b} Artikeln gespeichert. Starte sie erneut, nichts wird doppelt angelegt."], ["Terminer la validation", "Finish confirmation", "Termina la convalida", "Terminar la validación", "Bestätigung beenden"], ["Valider la réception", "Confirm the reception", "Convalida la ricezione", "Validar la recepción", "Eingang bestätigen"],
    ["Retour", "Back", "Indietro", "Atrás", "Zurück"], ["Suite", "Next", "Avanti", "Siguiente", "Weiter"], ["Reprendre plus tard", "Resume later", "Riprendi più tardi", "Retomar más tarde", "Später fortsetzen"],
    ["Réception validée", "Reception confirmed", "Ricezione convalidata", "Recepción validada", "Eingang bestätigt"], ["Aucune fiche créée.", "No listing created.", "Nessuna scheda creata.", "Ninguna ficha creada.", "Kein Artikel angelegt."], ["Brouillons à compléter", "Drafts to complete", "Bozze da completare", "Borradores por completar", "Entwürfe zum Vervollständigen"], ["… et {n} autre(s).", "… and {n} more.", "… e altri {n}.", "… y {n} más.", "… und {n} weitere."], ["Voir le récap fournisseur", "See the supplier recap", "Vedi il riepilogo fornitore", "Ver el resumen del proveedor", "Lieferanten-Zusammenfassung ansehen"], ["Associer à un live", "Link to a live", "Associa a un live", "Asociar a un live", "Einem Live zuordnen"], ["Retour aux cartons", "Back to boxes", "Torna agli scatoloni", "Volver a las cajas", "Zurück zu den Kartons"],
    ["Ce carton a changé ailleurs : recharge-le avant de continuer.", "This box changed elsewhere: reload it before continuing.", "Questo scatolone è cambiato altrove: ricaricalo prima di continuare.", "Esta caja ha cambiado en otro sitio: recárgala antes de continuar.", "Dieser Karton wurde anderswo geändert: lade ihn neu, bevor du weitermachst."], ["Ce carton est verrouillé.", "This box is locked.", "Questo scatolone è bloccato.", "Esta caja está bloqueada.", "Dieser Karton ist gesperrt."],
    ["Photo illisible", "Unreadable photo", "Foto illeggibile", "Foto ilegible", "Foto nicht lesbar"], ["Récap fournisseur", "Supplier recap", "Riepilogo fornitore", "Resumen del proveedor", "Lieferanten-Zusammenfassung"], ["{n} photo(s) ne sont pas encore enregistrées : le récap sera généré sans elles.", "{n} photo(s) are not saved yet: the recap will be generated without them.", "{n} foto non sono ancora salvate: il riepilogo sarà generato senza.", "{n} foto(s) aún no están guardadas: el resumen se generará sin ellas.", "{n} Foto(s) sind noch nicht gespeichert: Die Zusammenfassung entsteht ohne sie."],
    ["Max ne l'envoie pas : copie-le ou imprime-le.", "Max does not send it: copy or print it.", "Max non lo invia: copialo o stampalo.", "Max no lo envía: cópialo o imprímelo.", "Max sendet es nicht: kopiere oder drucke es."], ["Copier", "Copy", "Copia", "Copiar", "Kopieren"], ["Imprimer", "Print", "Stampa", "Imprimir", "Drucken"], ["Copié", "Copied", "Copiato", "Copiado", "Kopiert"], ["Copie impossible", "Copy not possible", "Copia impossibile", "No se puede copiar", "Kopieren nicht möglich"],
    ["Complète les points en rouge avant de valider.", "Fix the points in red before confirming.", "Correggi i punti in rosso prima di convalidare.", "Corrige los puntos en rojo antes de validar.", "Behebe die roten Punkte vor der Bestätigung."], ["Validation impossible.", "Confirmation not possible.", "Convalida impossibile.", "Validación imposible.", "Bestätigung nicht möglich."],
    ["La validation s'est arrêtée : {a} fiche(s) enregistrées sur {b}. Relance-la, rien ne sera dupliqué.", "Confirmation stopped: {a} of {b} listing(s) saved. Run it again, nothing will be duplicated.", "La convalida si è fermata: {a} schede su {b} salvate. Rilanciala, nulla verrà duplicato.", "La validación se detuvo: {a} de {b} ficha(s) guardadas. Relánzala, nada se duplicará.", "Die Bestätigung wurde gestoppt: {a} von {b} Artikel(n) gespeichert. Starte erneut, nichts wird doppelt angelegt."], ["Réception validée", "Reception confirmed", "Ricezione convalidata", "Recepción validada", "Eingang bestätigt"],
    ["Brouillon gardé : tu peux le reprendre quand tu veux.", "Draft kept: resume whenever you like.", "Bozza conservata: puoi riprenderla quando vuoi.", "Borrador guardado: puedes retomarlo cuando quieras.", "Entwurf gespeichert: du kannst jederzeit weitermachen."], ["Attends la fin de l'enregistrement de la photo.", "Wait until the photo is saved.", "Attendi il salvataggio della foto.", "Espera a que se guarde la foto.", "Warte, bis das Foto gespeichert ist."],
    ["Récapitulatif de réception", "Reception summary", "Riepilogo di ricezione", "Resumen de recepción", "Eingangszusammenfassung"], ["Fournisseur", "Supplier", "Fornitore", "Proveedor", "Lieferant"], ["Commande", "Order", "Ordine", "Pedido", "Bestellung"], ["reçue le", "received on", "ricevuto il", "recibido el", "erhalten am"], ["Attendu", "Expected", "Atteso", "Esperado", "Erwartet"], ["reçu", "received", "ricevuto", "recibido", "erhalten"], ["Manquantes", "Missing", "Mancanti", "Faltantes", "Fehlend"], ["Déclassées", "Downgraded", "Declassati", "Degradadas", "Herabgestuft"], ["En trop", "Extra", "In più", "De más", "Zu viel"], ["photo(s)", "photo(s)", "foto", "foto(s)", "Foto(s)"]].forEach(a => K(...a));
}
