import { app } from '../state.js';
import { $, LSg, LSs, addDays, avail, days, esc, eur, eurR, fd, ok, profit, sold, title, today } from './core.js';
import { CFG0 } from './settings-core.js';
import { phImg, hydrate } from './photos.js';
import { catSvg, pastel } from './stock-view.js';
import { isFinal } from './finalisation.js';
import { pseudoKey } from './buyers.js';
import { copyText } from './listing.js';
import { trEv } from './trash-history.js';
import { sheetHead, showSheet } from './tools-index.js';
import { priceFloor } from './advice.js';
import { openGroupSale } from './group-sale.js';

Object.assign(CFG0, { crm: {} });

/* ---------- Stock en mode CRM ---------- */
/* Deux façons de voir le même stock :
   - le PIPELINE : chaque pièce est dans une colonne selon où elle en est (à publier, en ligne, offre reçue, à expédier, expédié, finalisé, + tes propres étapes) ;
     on la fait avancer (glisser-déposer, menu ⋯ ou sélection groupée) et l'action correspondante est enregistrée ;
   - les ACHETEURS : une fiche par pseudo (achats, total, score, étiquettes, notes datées, relance), un journal d'activité et des chiffres.
   Tout est calculé à partir des pièces. Seuls les réglages du CRM et les infos des acheteurs sont enregistrés (réglages, cfg.crm : synchronisés avec le compte). */
export const STAGES = [
  ['brouillon', 'À publier', 'Pièces pas encore en ligne'],
  ['ligne', 'En ligne', 'Annonce publiée, en attente d\'acheteur'],
  ['offre', 'Offre reçue', 'Un acheteur négocie ou réserve'],
  ['envoyer', 'À expédier', 'Vendu, colis à préparer'],
  ['expedie', 'Expédié', 'En route, argent pas encore reçu'],
  ['finalise', 'Finalisé', 'Argent reçu, vente terminée'],
];
const SOLD_ST = ['envoyer', 'expedie', 'finalise'];
const CRM = () => app.cfg.crm || {};
const setCrm = patch => app.setCfg({ crm: Object.assign({}, CRM(), patch) });

/* ---- étapes : celles de départ (renommables, masquables) + tes étapes perso ---- */
const extras = () => (CRM().x || []).filter(s => s && s.id && s.n);
const extraIds = () => extras().map(s => s.id);
export function stages() {
  const c = CRM(), nm = c.names || {}, hid = c.hide || [];
  return [...STAGES.filter(s => !hid.includes(s[0])).map(s => [s[0], nm[s[0]] || t(s[1]), nm[s[0]] ? '' : t(s[2]), false]), ...extras().map(s => [s.id, s.n, t('Étape perso'), true])];
}
const lbl = id => { const s = stages().find(x => x[0] === id) || STAGES.find(x => x[0] === id); return s ? (s[3] === undefined ? t(s[1]) : s[1]) : id; };
export function baseStage(p) {
  if (sold(p)) return p.vt && !p.exp ? 'envoyer' : isFinal(p) ? 'finalise' : 'expedie';
  if (!avail(p)) return '';
  if (p.crm === 'offre') return 'offre';
  return ok(p.pub) ? 'ligne' : 'brouillon';
}
export function stageOf(p) { const b = baseStage(p); return b && p.crmx && extraIds().includes(p.crmx) && b !== 'finalise' ? p.crmx : b; }
const RECENT_FINAL = 30;
const inPipeline = p => { const s = stageOf(p); return !!s && (s !== 'finalise' || (ok(p.dv) && days(p.dv, today()) <= RECENT_FINAL)); };

/* ---- délais réglables : relances, réservation, colis qui traîne ---- */
export const cadence = () => { const c = CRM(); return { offre: c.dOffre >= 0 ? +c.dOffre : 2, avis: c.dAvis >= 0 ? +c.dAvis : 3, res: c.dRes > 0 ? +c.dRes : 2, slow: c.dSlow > 0 ? +c.dSlow : 7 }; };
const hasOffer = p => p.crm === 'offre' && p.offre && p.offre.d;
export const expired = (p, td = today()) => avail(p) && hasOffer(p) && days(p.offre.d, td) >= cadence().res;
export const slowParcel = (p, td = today()) => stageOf(p) === 'expedie' && ok(p.exp) && days(p.exp, td) >= cadence().slow;

/* ---- acheteurs ---- */
const resolveKey = k => (CRM().al || {})[k] || k;
const keyOf = name => resolveKey(pseudoKey(name));
export function contacts() {
  const o = {}, add = (name, p, kind) => {
    const k = keyOf(name); if (!k) return;
    const c = o[k] = o[k] || { k, nom: String(name).replace(/^@+/, ''), achats: [], offres: [], ca: 0, ben: 0, last: '', first: '' };
    if (kind === 'sale') { c.achats.push(p); c.ca += p.pv || 0; c.ben += profit(p); if ((p.dv || '') > c.last) { c.last = p.dv || ''; c.nom = String(name).replace(/^@+/, ''); } if (p.dv && (!c.first || p.dv < c.first)) c.first = p.dv; } else c.offres.push(p);
  };
  app.P.forEach(p => { if (sold(p) && p.acheteur) add(p.acheteur, p, 'sale'); else if (avail(p) && p.crm === 'offre' && p.offre && p.offre.a) add(p.offre.a, p, 'offer'); });
  const meta = CRM().c || {};
  return Object.values(o).map(c => {
    const m = meta[c.k] || {}, n = new Set(c.achats.map(p => p.lot || p.id)).size;
    const r = Object.assign(c, { n, note: m.note || '', relance: m.relance || '', rt: m.rt || '', tags: m.tags || [], bl: !!m.bl, annul: +m.annul || 0, log: m.log || [], tag: n >= 3 ? 'fidele' : n === 1 ? 'nouveau' : n === 2 ? 'revenu' : c.offres.length ? 'offre' : 'prospect' });
    r.score = score(r);
    return r;
  }).sort((a, b) => (b.last || '').localeCompare(a.last || '') || b.n - a.n);
}
const TAGL = { fidele: 'Fidèle', revenu: 'Revenu', nouveau: 'Nouveau', offre: 'Offre en cours', prospect: 'Prospect' };
export const PRESET_TAGS = ['Régulier', 'Négociateur', 'À relancer', 'VIP'];
const meta = k => (CRM().c || {})[k] || {};
const setMeta = (k, patch) => { const c = Object.assign({}, CRM().c); c[k] = Object.assign({}, c[k], patch); setCrm({ c }); };
/** Score de fiabilité de 0 à 100 : plus d'achats = mieux, chaque annulation coûte, un acheteur bloqué vaut 0. */
export function score(c) { if (c.bl) return 0; return Math.max(0, Math.min(100, 50 + Math.min(30, (c.n || 0) * 10) - (c.annul || 0) * 20 + ((c.n || 0) >= 1 && !(c.annul || 0) ? 10 : 0))); }
export const scoreLabel = s => (s >= 70 ? 'Fiable' : s >= 40 ? 'Correct' : 'À surveiller');
export const isBlocked = name => { const k = keyOf(name); return !!(k && meta(k).bl); };
app.crmBlocked = isBlocked;
/** Relance automatique d'un acheteur après un événement : garde la plus proche si une relance existe déjà. */
const autoRelance = (name, n, rt) => { const k = keyOf(name); if (!k || !(n >= 0)) return; const d = addDays(today(), n), m = meta(k); if (!m.relance || m.relance > d) setMeta(k, { relance: d, rt }); };

/* ---- doublons et fusion ---- */
const lev = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
export function dupes() {
  const C = contacts(), out = [];
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = C[i].k, b = C[j].k;
    if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a) || (Math.abs(a.length - b.length) <= 1 && lev(a, b) <= 1))) out.push(C[i].n >= C[j].n ? [C[i], C[j]] : [C[j], C[i]]);
  }
  return out.slice(0, 5);
}
/** Réunit deux pseudos qui désignent la même personne : « drop » devient un alias de « keep ». */
export function mergeContacts(keep, drop) {
  if (!keep || !drop || keep === drop) return;
  const crm = Object.assign({}, CRM()), al = Object.assign({}, crm.al), c = Object.assign({}, crm.c);
  Object.keys(al).forEach(x => { if (al[x] === drop) al[x] = keep; });
  al[drop] = keep;
  const a = c[keep] || {}, b = c[drop] || {};
  c[keep] = Object.assign({}, b, a, { note: [a.note, b.note].filter(Boolean).join('\n'), tags: [...new Set([...(a.tags || []), ...(b.tags || [])])], annul: (+a.annul || 0) + (+b.annul || 0), bl: !!(a.bl || b.bl), log: [...(a.log || []), ...(b.log || [])], relance: [a.relance, b.relance].filter(Boolean).sort()[0] || '' });
  delete c[drop]; crm.al = al; crm.c = c; app.setCfg({ crm });
}

/* ---- messages : modèles par étape, modifiables ---- */
export const TPL = {
  offre: 'Bonjour {pseudo}, je reviens vers toi pour ton offre sur {piece}. Elle est toujours possible : dis-moi si tu veux finaliser. Belle journée !',
  relance: 'Bonjour {pseudo}, merci pour ton achat ! J\'ai de nouvelles pièces en ligne qui pourraient te plaire : n\'hésite pas à passer voir mon dressing. Un lot avec envoi groupé est possible. Belle journée !',
  envoi: 'Bonjour {pseudo}, ton colis ({piece}) vient de partir ! Tu devrais le recevoir sous quelques jours. Merci encore !',
  avis: 'Bonjour {pseudo}, merci pour ton achat ({piece}) ! Si tout est bon, un petit avis m\'aiderait beaucoup. À bientôt dans mon dressing !',
};
const TPL_L = { offre: 'Offre', relance: 'Relance', envoi: 'Envoi', avis: 'Avis' };
export function message(kind, c, p) {
  const raw = (CRM().tpl || {})[kind], src = raw || t(TPL[kind] || TPL.relance);
  const lastP = p || (c && c.achats.slice().sort((a, b) => (b.dv || '').localeCompare(a.dv || ''))[0]) || (c && c.offres[0]);
  return src.replace(/\{pseudo\}/g, c ? '@' + c.nom : '').replace(/\{piece\}/g, lastP ? title(lastP) : t('ta pièce')).replace(/\{prix\}/g, lastP ? eur(sold(lastP) ? lastP.pv : (lastP.offre || {}).m || lastP.pvise || 0) : '');
}
const buyerOf = p => (sold(p) ? p.acheteur : (p.offre || {}).a) || '';
const contactOf = p => { const n = buyerOf(p), k = n && keyOf(n); return k ? contacts().find(c => c.k === k) || { k, nom: String(n).replace(/^@+/, ''), achats: [], offres: [] } : null; };

/* ---- journal : les derniers événements de toutes les pièces ---- */
let logQ = '', logP = 'all';
export function activity(limit = 20, q = '', period = 'all') {
  const ev = [], s = String(q || '').trim().toLowerCase(), since = period === 'all' ? 0 : Date.now() - (+period) * 864e5;
  app.P.forEach(p => (p.h || []).forEach(x => { if (x.t >= since) ev.push({ t: x.t, e: x.e, p }); }));
  return ev.filter(x => !s || (trEv(x.e) + ' ' + title(x.p) + ' ' + (x.p.code || '') + ' ' + (x.p.acheteur || '')).toLowerCase().includes(s)).sort((a, b) => b.t - a.t).slice(0, limit);
}

/* ---- tâches du jour du CRM ---- */
export function crmTodo() {
  const td = today(), A = app.P.filter(avail);
  return {
    offres: A.filter(p => p.crm === 'offre'),
    expirees: A.filter(p => expired(p, td)),
    envoyer: app.P.filter(p => baseStage(p) === 'envoyer'),
    traine: app.P.filter(p => slowParcel(p, td)),
    relances: contacts().filter(c => c.relance && c.relance <= td),
    dormantes: A.filter(p => ok(p.pub) && days(p.pub, td) >= 30 && p.crm !== 'offre'),
  };
}

/* ---- chiffres : par étape, conversion, délais, argent à recevoir ---- */
const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null);
export function crmStats() {
  const td = today(), L = app.P.filter(inPipeline), S = app.P.filter(sold), published = app.P.filter(p => sold(p) || ok(p.pub));
  const perStage = stages().map(([id, name]) => { const C = L.filter(p => stageOf(p) === id); return { id, name, n: C.length, val: C.reduce((a, p) => a + (sold(p) ? p.pv || 0 : (p.offre && p.offre.m) || p.pvise || 0), 0) }; });
  const gap = (a, b) => S.filter(p => ok(p[a]) && ok(p[b])).map(p => days(p[a], p[b])).filter(x => x >= 0);
  const month = td.slice(0, 7), by = {};
  S.filter(p => (p.dv || '').startsWith(month) && p.acheteur).forEach(p => { const k = keyOf(p.acheteur), b = by[k] = by[k] || { nom: String(p.acheteur).replace(/^@+/, ''), n: 0, ca: 0 }; b.n++; b.ca += p.pv || 0; });
  const enAttente = app.P.filter(p => avail(p) && p.crm === 'offre'), aRecevoir = S.filter(p => !isFinal(p));
  return {
    perStage, rate: published.length ? Math.round(S.length / published.length * 100) : 0, nPub: published.length, nSold: S.length,
    dPub: avg(gap('pub', 'dv')), dExp: avg(gap('dv', 'exp')), dFin: avg(gap('exp', 'fin')),
    offres: { n: enAttente.length, val: enAttente.reduce((a, p) => a + ((p.offre || {}).m || 0), 0) },
    bloque: { n: aRecevoir.length, val: aRecevoir.reduce((a, p) => a + (p.pv || 0), 0) },
    top: Object.values(by).sort((a, b) => b.ca - a.ca).slice(0, 5),
  };
}

/* ---- export CSV ---- */
const csv = rows => '﻿' + rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\r\n');
export const csvBuyers = () => csv([[t('Pseudo'), t('Achats'), t('Dépensé'), t('Bénéfice'), t('Dernier achat'), t('Offres en cours'), t('Score'), t('Étiquettes'), t('Relance'), t('Note')], ...contacts().map(c => [c.nom, c.n, c.ca, Math.round(c.ben * 100) / 100, c.last, c.offres.length, c.score, c.tags.join(', '), c.relance, c.note.replace(/\n/g, ' ')])]);
export const csvLog = () => csv([[t('Date'), t('Pièce'), t('Code'), t('Événement')], ...activity(5000, logQ, logP).map(x => [new Date(x.t).toISOString().slice(0, 10), title(x.p), x.p.code || '', trEv(x.e)])]);
function download(name, text) { try { const u = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); } catch (e) { app.toast(t('Export impossible sur cet appareil')); } }

/* ---- suivi du colis ---- */
const CARR = [['mr', 'Mondial Relay', n => 'https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=' + encodeURIComponent(n)], ['col', 'Colissimo', n => 'https://www.laposte.fr/outils/suivre-vos-envois?code=' + encodeURIComponent(n)], ['vgo', 'Vinted Go', null]];
export const trackUrl = (carr, n) => { const c = CARR.find(x => x[0] === carr); return c && c[2] && n ? c[2](String(n).trim()) : ''; };

/* ---- historique d'une pièce ---- */
const addEv = (p, e) => [...(p.h || []), { t: Date.now(), e }].slice(-40);

/* ---- déplacer une pièce d'une colonne à l'autre : l'action est vraiment enregistrée ---- */
/** Renvoie la pièce telle qu'elle était (pour annuler) ou null si rien n'a bougé. { silent } : pas de message ; { bulk } : pas de fenêtre (déplacement groupé). */
export function moveTo(id, target, o = {}) {
  const p = app.P.find(x => x.id === id); if (!p) return null;
  const base = baseStage(p), td = today(), q = Object.assign({}, p), old = Object.assign({}, p);
  const done = () => { app.save(q); if (!o.silent) app.toast(t('Déplacé : {s}', { s: lbl(target) }), () => app.save(old), 5000); return old; };
  if (extraIds().includes(target)) { if (stageOf(p) === target || !base || base === 'finalise') return null; q.crmx = target; return done(); }
  if (target === base) { if (!p.crmx) return null; delete q.crmx; return done(); }
  delete q.crmx;
  if (sold(p)) {
    if (!SOLD_ST.includes(target)) { if (!o.silent) app.toast(t('Une pièce vendue ne peut revenir qu\'à une étape de la vente')); return null; }
    if (target === 'envoyer') { delete q.exp; delete q.fin; if (!q.vt) q.vt = Date.now(); }
    else {
      /* la vente se remplit toute seule : date et prix, depuis l'offre s'il manque */
      if (!q.dv) q.dv = td;
      if (!(q.pv > 0) && q.offre && q.offre.m > 0) q.pv = q.offre.m;
      if (target === 'expedie') { q.exp = td; delete q.fin; }
      else { if (!q.exp) q.exp = td; q.fin = td; }
    }
    q.h = addEv(q, 'Étape CRM : ' + lbl(target));
    const r = done();
    if (target === 'finalise' && q.acheteur) autoRelance(q.acheteur, cadence().avis, 'avis');
    return r;
  }
  if (target === 'brouillon') { delete q.pub; delete q.crm; delete q.offre; }
  else if (target === 'ligne') { q.pub = q.pub || td; delete q.crm; delete q.offre; }
  else if (target === 'offre') { if (o.bulk) return null; openOffer(id); return null; }
  else { if (o.bulk) return null; app.openSheet(id, 'sell'); return null; }   /* vendu : il faut le prix et l'acheteur */
  return done();
}
/** Remet en ligne les réservations expirées : l'offre est retirée et l'annulation comptée pour l'acheteur. */
export function putBackExpired() {
  const L = app.P.filter(p => expired(p)); if (!L.length) return 0;
  const olds = L.map(p => Object.assign({}, p));
  L.forEach(p => {
    const q = Object.assign({}, p), a = (p.offre || {}).a, k = a && keyOf(a);
    if (k) setMeta(k, { annul: (+meta(k).annul || 0) + 1 });
    q.h = addEv(q, 'Réservation expirée : remise en ligne' + (a ? ' (@' + a + ')' : '')); delete q.crm; delete q.offre; app.save(q);
  });
  app.toast(t('{n} réservation(s) remise(s) en ligne', { n: L.length }), () => olds.forEach(o => app.save(o)), 6000);
  return L.length;
}

/* ---- offre reçue : historique, contre-offre, marge et plancher ---- */
const marginOf = (p, m) => { const f = app.defFrais ? app.defFrais(m, 'Vinted', undefined, p) : 0; return Math.round((m - (typeof p.achat === 'number' ? p.achat : Number(p.achat) || 0) - f) * 100) / 100; };
const money = s => { const m = Number(String(s || '').replace(',', '.')); return isFinite(m) && m > 0 ? m : 0; };
function openOffer(id) {
  const p = app.P.find(x => x.id === id); if (!p) return;
  const known = contacts().map(c => c.nom), hist = p.offres || [];
  showSheet(sheetHead(t('Offre reçue')) + `<div class="card"><p class="sub" style="margin:0 0 10px">${esc(title(p))}</p>
   <div class="fld"><label class="l" for="of_a">${t('Pseudo de l\'acheteur')}</label><input type="text" id="of_a" list="of_l" autocomplete="off" autocapitalize="none" value="${esc((p.offre || {}).a || '')}"><datalist id="of_l">${known.map(n => `<option value="${esc(n)}">`).join('')}</datalist><div id="of_w" class="hint cxwarn" hidden></div></div>
   <div class="fld"><label class="l" for="of_m">${t('Montant proposé (€)')}</label><input type="text" inputmode="decimal" id="of_m" value="${(p.offre || {}).m || ''}"><div id="of_mg" class="hint"></div></div>
   <div class="fld"><label class="l" for="of_c">${t('Ma contre-offre (€)')}</label><input type="text" inputmode="decimal" id="of_c" value="${(p.offre || {}).c || ''}"><div id="of_cg" class="hint"></div></div></div>
   ${hist.length ? `<div class="card"><h3>${t('Historique des offres')}</h3>${hist.slice().reverse().map(x => `<div class="cxh2"><span>${esc(fd(x.d))}</span><b>${t(x.r === 'contre' ? 'Ma contre-offre' : x.r === 'refus' ? 'Refusée' : 'Offre')}</b><span>${x.m ? eur(x.m) : ''}</span></div>`).join('')}</div>` : ''}
   <div class="acts"><button type="button" class="btn mint" id="of_ok">${t('Enregistrer l\'offre')}</button><button type="button" class="btn sec" id="of_cc">${t('Enregistrer ma contre-offre')}</button></div>
   ${p.crm === 'offre' ? `<div class="acts two"><button type="button" class="btn sec" id="of_re">${t('Refuser l\'offre')}</button><button type="button" class="btn sec" id="of_no">${t('Retirer l\'offre')}</button></div>` : ''}`);
  const floor = priceFloor(p);
  const info = () => {
    const m = money($('of_m').value), c = money($('of_c').value), a = $('of_a').value.trim();
    const line = (x, el) => { const g = marginOf(p, x); $(el).innerHTML = x ? `${t('Marge : {g}', { g: (g >= 0 ? '+' : '') + eur(g) })}${x < floor ? ` · <b class="cxwarn">${t('Sous ton plancher ({p})', { p: eur(floor) })}</b>` : ''}` : ''; };
    line(m, 'of_mg'); line(c, 'of_cg');
    const w = $('of_w'); w.hidden = !(a && isBlocked(a)); w.textContent = t('Attention : cet acheteur est sur ta liste noire.');
  };
  ['of_a', 'of_m', 'of_c'].forEach(i => $(i).addEventListener('input', info)); info();
  const commit = (kind) => {
    const a = $('of_a').value.trim().replace(/^@+/, ''), m = money($('of_m').value), c = money($('of_c').value);
    if (!a) return app.toast(t('Indique le pseudo de l\'acheteur'));
    if (kind === 'contre' && !c) return app.toast(t('Indique ta contre-offre'));
    const old = Object.assign({}, p), d = today(), offres = [...(p.offres || [])];
    if (kind === 'offre' && m) offres.push({ r: 'offre', m, d, a }); if (kind === 'contre') offres.push({ r: 'contre', m: c, d, a });
    app.save(Object.assign({}, p, { crm: 'offre', offre: { a, m, d: (p.offre || {}).d || d, c: c || 0 }, offres: offres.slice(-30), h: addEv(p, (kind === 'contre' ? 'Contre-offre à @' + a + ' : ' + eur(c) : 'Offre de @' + a + (m > 0 ? ' : ' + eur(m) : ''))) }));
    autoRelance(a, cadence().offre, 'offre');
    $('sheet').hidden = true; app.toast(t('Offre enregistrée'), () => app.save(old), 5000); draw();
  };
  $('of_ok').onclick = () => commit('offre');
  $('of_cc').onclick = () => commit('contre');
  if ($('of_no')) $('of_no').onclick = () => { const q = Object.assign({}, p); delete q.crm; delete q.offre; app.save(q); $('sheet').hidden = true; draw(); };
  if ($('of_re')) $('of_re').onclick = () => { const q = Object.assign({}, p), a = (p.offre || {}).a; q.offres = [...(p.offres || []), { r: 'refus', m: (p.offre || {}).m || 0, d: today(), a }].slice(-30); q.h = addEv(q, 'Offre refusée' + (a ? ' (@' + a + ')' : '')); delete q.crm; delete q.offre; app.save(q); $('sheet').hidden = true; draw(); };
}

/* ---- menu d'une pièce : changer d'étape, message, suivi du colis ---- */
function openMove(id) {
  const p = app.P.find(x => x.id === id); if (!p) return;
  const cur = stageOf(p), soldP = sold(p), X = extraIds();
  const L = stages().filter(s => s[0] !== cur && (soldP ? SOLD_ST.includes(s[0]) || X.includes(s[0]) : !SOLD_ST.includes(s[0]) || s[0] === 'envoyer' || X.includes(s[0])));
  const c = contactOf(p), kind = soldP ? (cur === 'finalise' ? 'avis' : 'envoi') : p.crm === 'offre' ? 'offre' : '';
  const carr = p.carr || (app.cfg.shipCar || 'mr');
  showSheet(sheetHead(esc(title(p))) + `<p class="sub">${t('Étape actuelle : {s}', { s: lbl(cur) })}${expired(p) ? ' · <b class="cxwarn">' + t('Réservation expirée') + '</b>' : ''}</p>
   <div class="tools">${L.map(s => `<button type="button" class="tool" data-mv="${s[0]}"><span class="tx"><b>${s[0] === 'envoyer' && !soldP ? t('Vendu') : esc(s[1])}</b><small>${esc(s[2])}</small></span></button>`).join('')}</div>
   ${kind && c ? `<div class="card"><h3>${t('Message prêt')}</h3><div class="hint" style="white-space:pre-wrap">${esc(message(kind, c, p))}</div><div class="acts"><button type="button" class="btn sec" id="mv_cp">${t('Copier le message')}</button></div></div>` : ''}
   ${soldP ? `<div class="card"><h3>${t('Suivi du colis')}</h3><div class="chips">${CARR.map(x => `<button type="button" class="chip sm${carr === x[0] ? ' on' : ''}" data-cr="${x[0]}">${x[1]}</button>`).join('')}</div>
    <div class="fld" style="margin-top:8px"><label class="l" for="mv_s">${t('Numéro de suivi')}</label><input type="text" id="mv_s" autocomplete="off" autocapitalize="characters" value="${esc(p.suivi || '')}"></div>
    <div class="acts two"><button type="button" class="btn sec" id="mv_sv">${t('Enregistrer le numéro')}</button><button type="button" class="btn sec" id="mv_tr">${t('Suivre le colis')}</button></div></div>` : ''}
   ${expired(p) ? `<div class="acts"><button type="button" class="btn sec" id="mv_pb">${t('Remettre en ligne')}</button></div>` : ''}
   <div class="acts"><button type="button" class="btn sec" data-open="${esc(id)}">${t('Ouvrir la fiche')}</button></div>`);
  let cr = carr;
  $('shc').onclick = e => {
    const mv = e.target.closest('[data-mv]'), op = e.target.closest('[data-open]'), cc = e.target.closest('[data-cr]');
    if (op) return app.openSheet(op.dataset.open);
    if (cc) { cr = cc.dataset.cr; document.querySelectorAll('#shc [data-cr]').forEach(b => b.classList.toggle('on', b.dataset.cr === cr)); return; }
    if (e.target.closest('#mv_cp')) return copyText(message(kind, c, p), t('Message'));
    if (e.target.closest('#mv_sv')) { const q = app.P.find(x => x.id === id) || p; app.save(Object.assign({}, q, { suivi: $('mv_s').value.trim(), carr: cr })); app.toast(t('Numéro enregistré')); return draw(); }
    if (e.target.closest('#mv_tr')) { const u = trackUrl(cr, $('mv_s').value); if (u) { try { window.open(u, '_blank', 'noopener'); } catch (er) { /* fenêtre bloquée */ } } else app.toast(t('Pas de lien de suivi : regarde dans l\'appli du transporteur')); return; }
    if (e.target.closest('#mv_pb')) { putBackExpired(); $('sheet').hidden = true; return draw(); }
    if (mv) { $('sheet').hidden = true; moveTo(id, !soldP && mv.dataset.mv === 'envoyer' ? 'vendu' : mv.dataset.mv); draw(); }
  };
}

/* ---- fiche d'un acheteur ---- */
function openContact(k) {
  const c = contacts().find(x => x.k === k); if (!c) return;
  const td = today(), sc = c.score, panier = c.n ? c.ca / c.n : 0, kind = c.rt && TPL[c.rt] ? c.rt : c.offres.length ? 'offre' : 'relance';
  const others = contacts().filter(x => x.k !== k), alias = Object.keys(CRM().al || {}).filter(x => CRM().al[x] === k);
  const tagsAll = [...PRESET_TAGS, ...c.tags.filter(x => !PRESET_TAGS.includes(x))];
  showSheet(sheetHead('@' + esc(c.nom)) + `<div class="card"><div class="kpis"><div class="kpi"><b>${c.n}</b><span>${t(c.n > 1 ? 'achats' : 'achat')}</span></div><div class="kpi"><b>${eurR(c.ca)}</b><span>${t('dépensés chez toi')}</span></div><div class="kpi"><b>${eurR(c.ben)}</b><span>${t('de bénéfice')}</span></div></div>
   <p class="sub" style="margin:10px 0 0"><span class="tag">${t(TAGL[c.tag])}</span> <span class="tag ${sc >= 70 ? '' : 'x'}" id="ct_sc">${t('Fiabilité : {s}', { s: t(scoreLabel(sc)) + ' · ' + sc })}</span>${c.bl ? ' <span class="tag x">' + t('Liste noire') + '</span>' : ''}</p>
   <p class="sub" style="margin:6px 0 0">${[c.n ? t('panier moyen {p}', { p: eurR(panier) }) : '', c.first ? t('premier achat le {d}', { d: fd(c.first) }) : '', c.last ? t('dernier achat il y a {n} j', { n: Math.max(0, days(c.last, td)) }) : '', c.annul ? t('{n} annulation(s)', { n: c.annul }) : ''].filter(Boolean).join(' · ')}</p></div>
   ${c.offres.length ? `<div class="card"><h3>${t('Offres en cours')}</h3>${c.offres.map(p => `<button type="button" class="li" data-id="${esc(p.id)}" style="margin-top:6px"><div class="m"><b>${esc(title(p))}</b><small>${esc((p.offre || {}).d ? fd(p.offre.d) : '')}</small></div><div class="p">${(p.offre || {}).m ? eur(p.offre.m) : ''}</div></button>`).join('')}</div>` : ''}
   <div class="card"><h3>${t('Achats')}</h3>${c.achats.length ? c.achats.slice().sort((a, b) => (b.dv || '').localeCompare(a.dv || '')).map(p => `<button type="button" class="li" data-id="${esc(p.id)}" style="margin-top:6px"><div class="m"><b>${esc(title(p))}</b><small>${esc([p.taille, p.dv ? fd(p.dv) : ''].filter(Boolean).join(' · '))}</small></div><div class="p">${eur(p.pv)}</div></button>`).join('') : `<div class="hint">${t('Pas encore d\'achat.')}</div>`}</div>
   <div class="card"><h3>${t('Étiquettes')}</h3><div class="chips" id="ct_tg">${tagsAll.map(x => `<button type="button" class="chip sm${c.tags.includes(x) ? ' on' : ''}" data-tg="${esc(x)}">${esc(t(x))}</button>`).join('')}</div>
    <div class="fld" style="margin-top:8px"><input type="text" id="ct_tn" placeholder="${esc(t('Nouvelle étiquette'))}" autocomplete="off" maxlength="20"></div>
    <div class="acts two"><button type="button" class="btn sec" id="ct_ta">${t('Ajouter l\'étiquette')}</button><button type="button" class="btn sec" id="ct_bl">${t(c.bl ? 'Retirer de la liste noire' : 'Mettre sur liste noire')}</button></div></div>
   <div class="card"><h3>${t('Suivi')}</h3>
    <div class="fld"><label class="l" for="ct_n">${t('Note')}</label><textarea id="ct_n" rows="3" placeholder="${esc(t('Goûts, tailles, préférences…'))}">${esc(c.note)}</textarea></div>
    <div class="fld"><label class="l" for="ct_r">${t('À relancer le')}</label><input type="date" id="ct_r" value="${esc(c.relance)}"></div>
    <div class="chips" style="margin:6px 0 10px">${[[3, t('Dans 3 jours')], [7, t('Dans 1 semaine')], [30, t('Dans 1 mois')]].map(([n, l]) => `<button type="button" class="chip sm" data-rl="${n}">${l}</button>`).join('')}<button type="button" class="chip sm" data-rl="0">${t('Aucune')}</button></div>
    <span class="l">${t('Message')}</span><div class="chips" id="ct_tp">${Object.keys(TPL).map(x => `<button type="button" class="chip sm${x === kind ? ' on' : ''}" data-tp="${x}">${t(TPL_L[x])}</button>`).join('')}</div>
    <div class="acts two"><button type="button" class="btn sec" id="ct_cp">${t('Copier un message')}</button><button type="button" class="btn mint" id="ct_ok">${t('Enregistrer')}</button></div></div>
   <div class="card"><h3>${t('Notes datées')}</h3><div id="ct_lg">${c.log.length ? c.log.slice().reverse().map(x => `<div class="cxh2"><span>${esc(fd(x.d))}</span><span style="flex:1;white-space:pre-wrap">${esc(x.t)}</span></div>`).join('') : `<div class="hint">${t('Aucune note datée.')}</div>`}</div>
    <div class="fld" style="margin-top:8px"><input type="text" id="ct_ln" placeholder="${esc(t('Ajouter une note datée'))}" autocomplete="off"></div>
    <div class="acts two"><button type="button" class="btn sec" id="ct_la">${t('Ajouter la note')}</button><button type="button" class="btn sec" id="ct_an">${t('Compter une annulation')}</button></div></div>
   ${others.length ? `<div class="card"><h3>${t('Fusionner')}</h3><p class="hint">${t('Deux pseudos pour la même personne ? Réunis-les en une seule fiche.')}</p><div class="fld"><select id="ct_mg">${others.map(o => `<option value="${esc(o.k)}">@${esc(o.nom)}</option>`).join('')}</select></div><div class="acts"><button type="button" class="btn sec" id="ct_mb">${t('Fusionner dans cette fiche')}</button></div>${alias.length ? `<div class="hint">${t('Déjà réunis : {a}', { a: alias.map(a => '@' + a).join(', ') })}</div>` : ''}</div>` : ''}`);
  let tp = kind;
  const save = () => { setMeta(k, { note: $('ct_n').value.trim(), relance: $('ct_r').value || '', rt: $('ct_r').value ? (meta(k).rt || '') : '' }); };
  const again = () => { save(); openContact(k); draw(); };
  $('shc').onclick = e => {
    const r = e.target.closest('[data-rl]'), li = e.target.closest('.li[data-id]'), tg = e.target.closest('[data-tg]'), tpb = e.target.closest('[data-tp]');
    if (r) { $('ct_r').value = +r.dataset.rl ? addDays(td, +r.dataset.rl) : ''; return; }
    if (li) return app.openSheet(li.dataset.id);
    if (tpb) { tp = tpb.dataset.tp; document.querySelectorAll('#ct_tp [data-tp]').forEach(b => b.classList.toggle('on', b.dataset.tp === tp)); return; }
    if (tg) { const cur = meta(k).tags || [], x = tg.dataset.tg; setMeta(k, { tags: cur.includes(x) ? cur.filter(y => y !== x) : [...cur, x] }); return again(); }
    if (e.target.closest('#ct_ta')) { const x = $('ct_tn').value.trim().slice(0, 20); if (!x) return; const cur = meta(k).tags || []; if (!cur.includes(x)) setMeta(k, { tags: [...cur, x] }); return again(); }
    if (e.target.closest('#ct_bl')) { setMeta(k, { bl: !meta(k).bl }); return again(); }
    if (e.target.closest('#ct_la')) { const x = $('ct_ln').value.trim(); if (!x) return; setMeta(k, { log: [...(meta(k).log || []), { d: td, t: x }].slice(-50) }); return again(); }
    if (e.target.closest('#ct_an')) { setMeta(k, { annul: (+meta(k).annul || 0) + 1 }); app.toast(t('Annulation comptée')); return again(); }
    if (e.target.closest('#ct_mb')) { mergeContacts(k, $('ct_mg').value); app.toast(t('Fiches réunies')); return again(); }
    if (e.target.closest('#ct_cp')) return copyText(message(tp, c), t('Message'));
    if (e.target.closest('#ct_ok')) { save(); app.toast(t('Enregistré')); $('sheet').hidden = true; draw(); }
  };
}

/* ---- réglages du CRM : étapes, modèles de messages, délais ---- */
function openCrmSettings() {
  const c = CRM(), nm = c.names || {}, hid = c.hide || [], cd = cadence();
  showSheet(sheetHead(t('Réglages du CRM')) + `<div class="card"><h3>${t('Étapes du pipeline')}</h3><p class="hint">${t('Renomme ou masque une étape, ou ajoute la tienne (par exemple « litige »).')}</p>
   ${STAGES.map(s => `<div class="cxset"><input type="text" id="cs_n_${s[0]}" value="${esc(nm[s[0]] || '')}" placeholder="${esc(t(s[1]))}" maxlength="24"><label class="chk"><input type="checkbox" id="cs_h_${s[0]}"${hid.includes(s[0]) ? ' checked' : ''}><span>${t('Masquer')}</span></label></div>`).join('')}
   ${extras().map(s => `<div class="cxset"><input type="text" id="cs_x_${s.id}" value="${esc(s.n)}" maxlength="24"><label class="chk"><input type="checkbox" id="cs_xd_${s.id}"><span>${t('Supprimer')}</span></label></div>`).join('')}
   <div class="cxset"><input type="text" id="cs_add" placeholder="${esc(t('Nouvelle étape'))}" maxlength="24" autocomplete="off"></div></div>
   <div class="card"><h3>${t('Modèles de messages')}</h3><p class="hint">${t('Utilise {pseudo}, {piece} et {prix} : ils sont remplacés au moment de copier. Laisse vide pour garder le modèle de départ.')}</p>
   ${Object.keys(TPL).map(x => `<div class="fld"><label class="l" for="cs_t_${x}">${t(TPL_L[x])}</label><textarea id="cs_t_${x}" rows="3" placeholder="${esc(t(TPL[x]))}">${esc((c.tpl || {})[x] || '')}</textarea></div>`).join('')}</div>
   <div class="card"><h3>${t('Délais')}</h3>
   <div class="row2 fld"><div><label class="l" for="cs_d_offre">${t('Relancer une offre après (jours)')}</label><input type="text" inputmode="numeric" id="cs_d_offre" value="${cd.offre}"></div><div><label class="l" for="cs_d_avis">${t('Demander un avis après (jours)')}</label><input type="text" inputmode="numeric" id="cs_d_avis" value="${cd.avis}"></div></div>
   <div class="row2 fld"><div><label class="l" for="cs_res">${t('Réservation expirée après (jours)')}</label><input type="text" inputmode="numeric" id="cs_res" value="${cd.res}"></div><div><label class="l" for="cs_slow">${t('Colis qui traîne après (jours)')}</label><input type="text" inputmode="numeric" id="cs_slow" value="${cd.slow}"></div></div></div>
   <div class="acts"><button type="button" class="btn mint" id="cs_ok">${t('Enregistrer')}</button></div>`);
  $('cs_ok').onclick = () => {
    const names = {}, hide = [], x = [];
    STAGES.forEach(s => { const v = $('cs_n_' + s[0]).value.trim(); if (v) names[s[0]] = v; if ($('cs_h_' + s[0]).checked) hide.push(s[0]); });
    extras().forEach(s => { if ($('cs_xd_' + s.id).checked) return; x.push({ id: s.id, n: $('cs_x_' + s.id).value.trim().slice(0, 24) || s.n }); });
    const add = $('cs_add').value.trim().slice(0, 24); if (add) x.push({ id: 'x' + Date.now().toString(36), n: add });
    const tpl = {}; Object.keys(TPL).forEach(k => { const v = $('cs_t_' + k).value.trim(); if (v) tpl[k] = v; });
    const nn = (id, d, mn, mx) => { const v = Math.round(Number($('cs_' + id).value)); return isFinite(v) ? Math.max(mn, Math.min(mx, v)) : d; };
    const keepIds = x.map(s => s.id), gone = extraIds().filter(i => !keepIds.includes(i));
    gone.forEach(i => app.P.filter(p => p.crmx === i).forEach(p => { const q = Object.assign({}, p); delete q.crmx; app.save(q); }));
    setCrm({ names, hide, x, tpl, dOffre: nn('d_offre', 2, 0, 60), dAvis: nn('d_avis', 3, 0, 60), dRes: nn('res', 2, 1, 30), dSlow: nn('slow', 7, 1, 60) });
    app.toast(t('Réglage enregistré')); $('sheet').hidden = true; draw();
  };
}

/* ---- écran ---- */
let sub = LSg('crmSub', 'pipe');
let query = '', tagF = '', selMode = false;
const sel = new Set();
const card = p => {
  const [bg, fg] = pastel(p), st = stageOf(p), off = p.offre, on = sel.has(p.id);
  const price = sold(p) ? eur(p.pv) : '';
  return `<div class="cxc${on ? ' sel' : ''}" draggable="${selMode ? 'false' : 'true'}" data-cid="${esc(p.id)}">${selMode ? `<span class="cxck" aria-hidden="true">${on ? '✓' : ''}</span>` : ''}<button type="button" class="cxt" data-id="${esc(p.id)}" style="background:${bg};color:${fg}" aria-label="${esc(t('Ouvrir la fiche'))}">${p.photo ? phImg(p.photo) : catSvg(p)}</button>
   <div class="cxb"><b>${esc(title(p))}</b><small>${esc([p.code, p.taille].filter(Boolean).join(' · '))}</small>
   ${st === 'offre' && off ? `<small class="cxo">${esc('@' + off.a)}${off.m ? ' · ' + eur(off.m) : ''}${off.c ? ' → ' + eur(off.c) : ''}</small>` : ''}${expired(p) ? `<small class="cxwarn">${t('Réservation expirée')}</small>` : ''}${st === 'ligne' && ok(p.pub) ? `<small>${t('en ligne {n} j', { n: days(p.pub, today()) })}</small>` : ''}${sold(p) ? `<small class="cxo">${esc(p.acheteur ? '@' + p.acheteur : '')} ${price}</small>` : ''}${slowParcel(p) ? `<small class="cxwarn">${t('Colis en route depuis {n} j', { n: days(p.exp, today()) })}</small>` : ''}${sold(p) && p.suivi ? `<small>${esc(p.suivi)}</small>` : ''}</div>
   <button type="button" class="cxm" data-cm="${esc(p.id)}" aria-label="${esc(t('Déplacer'))}">⋯</button></div>`;
};
function pipelineHTML() {
  const L = app.P.filter(inPipeline), S = stages();
  return `<div class="cxp" style="--cols:${S.length}">${S.map(([k, l, d]) => {
    const C = L.filter(p => stageOf(p) === k).sort((a, b) => (b.entree || '').localeCompare(a.entree || ''));
    return `<section class="cxcol st-${esc(k)}" data-stage="${esc(k)}"><header><b>${esc(l)}</b><span class="cxn">${C.length}</span></header><small class="cxd">${esc(d)}</small><div class="cxl">${C.length ? C.slice(0, 40).map(card).join('') : `<div class="cxv">${t('Rien ici')}</div>`}${C.length > 40 ? `<div class="hint">${t('{n} autres dans Stock', { n: C.length - 40 })}</div>` : ''}</div></section>`;
  }).join('')}</div>`;
}
const toolbarHTML = () => {
  const nx = crmTodo().expirees.length;
  return `<div class="chips cxtb"><button type="button" class="chip sm${selMode ? ' on' : ''}" data-cxsel="1">${t(selMode ? 'Terminer la sélection' : 'Sélectionner')}</button>${nx ? `<button type="button" class="chip sm" data-cxexp="1">${t('Remettre en ligne les expirées ({n})', { n: nx })}</button>` : ''}<button type="button" class="chip sm" data-cxset="1">${t('Réglages du CRM')}</button></div>`;
};
const bulkHTML = () => {
  if (!selMode) return '';
  const n = sel.size, ids = [...sel], nAv = ids.map(i => app.P.find(p => p.id === i)).filter(p => p && avail(p)).length;
  return `<div class="cxbar"><b>${tn(n, 'pièce sélectionnée', 'pièces sélectionnées')}</b>${n ? `<span class="l">${t('Déplacer vers')}</span><div class="chips">${stages().filter(s => s[0] !== 'offre').map(s => `<button type="button" class="chip sm" data-cxto="${esc(s[0])}">${esc(s[1])}</button>`).join('')}</div>${nAv >= 2 ? `<button type="button" class="btn sec" data-cxlot="1">${t('Vendre en lot')}</button>` : ''}` : `<span class="hint">${t('Touche des pièces pour les choisir.')}</span>`}</div>`;
};
function buyersHTML() {
  const q = query.trim().toLowerCase(), td = today(), all = contacts(), tg = [...new Set(all.flatMap(c => c.tags))];
  const C = all.filter(c => (!q || c.nom.toLowerCase().includes(q)) && (!tagF || c.tags.includes(tagF))), D = dupes();
  return `<div class="srch"><input type="search" id="crm_q" value="${esc(query)}" placeholder="${esc(t('Chercher un acheteur (@pseudo)'))}" autocomplete="off" autocapitalize="none"></div>
   ${tg.length ? `<div class="chips" style="margin-bottom:10px"><button type="button" class="chip sm${tagF ? '' : ' on'}" data-cxtag="">${t('Tous')}</button>${tg.map(x => `<button type="button" class="chip sm${tagF === x ? ' on' : ''}" data-cxtag="${esc(x)}">${esc(t(x))}</button>`).join('')}</div>` : ''}
   ${D.length ? `<div class="card cxdup"><b>${t('Doublons possibles')}</b>${D.map(([a, b]) => `<div class="cxh2"><span style="flex:1">@${esc(a.nom)} · @${esc(b.nom)}</span><button type="button" class="chip sm" data-cxmg="${esc(a.k)}|${esc(b.k)}">${t('Réunir')}</button></div>`).join('')}</div>` : ''}
   ${C.length ? C.map(c => `<div class="cxrow"><button type="button" class="li cxct" data-ct="${esc(c.k)}"><div class="m"><b>@${esc(c.nom)}${c.bl ? ' ⛔' : ''}</b><small>${esc([tn(c.n, 'achat', 'achats'), c.last ? t('dernier {d}', { d: fd(c.last) }) : '', c.offres.length ? tn(c.offres.length, 'offre', 'offres') : '', c.tags.map(x => t(x)).join(', ')].filter(Boolean).join(' · '))}</small></div><div class="p"><span class="tag${c.tag === 'fidele' ? '' : ' x'}">${t(TAGL[c.tag])}</span>${c.relance ? `<small class="${c.relance <= td ? 'cxr' : ''}">${t('relance {d}', { d: fd(c.relance) })}</small>` : `<small>${eurR(c.ca)}</small>`}</div></button>${c.relance && c.relance <= td ? `<button type="button" class="chip sm cxcp" data-cpm="${esc(c.k)}">${t('Copier le message')}</button>` : ''}</div>`).join('') : `<div class="empty">${t('Aucun acheteur pour l\'instant. Les acheteurs apparaissent dès qu\'une vente ou une offre porte un pseudo.')}</div>`}
   ${all.length ? `<div class="acts"><button type="button" class="btn sec" data-csv="buyers">${t('Exporter les acheteurs (CSV)')}</button></div>` : ''}`;
}
function activityHTML() {
  const A = activity(40, logQ, logP);
  return `<div class="srch"><input type="search" id="crm_lq" value="${esc(logQ)}" placeholder="${esc(t('Chercher dans le journal'))}" autocomplete="off" autocapitalize="none"></div>
   <div class="chips" style="margin-bottom:10px">${[['7', 'Cette semaine'], ['30', '30 jours'], ['all', 'Tout']].map(([k, l]) => `<button type="button" class="chip sm${logP === k ? ' on' : ''}" data-cxlp="${k}">${t(l)}</button>`).join('')}</div>
   ${A.length ? A.map(x => `<button type="button" class="li" data-id="${esc(x.p.id)}" style="margin-bottom:6px"><div class="m"><b>${esc(title(x.p))}</b><small>${esc(trEv(x.e))}</small></div><div class="p"><small>${esc(fd(new Date(x.t).toISOString().slice(0, 10)))}</small></div></button>`).join('') : `<div class="empty">${t('Le journal se remplit au fil des actions sur tes pièces.')}</div>`}
   ${A.length ? `<div class="acts"><button type="button" class="btn sec" data-csv="log">${t('Exporter le journal (CSV)')}</button></div>` : ''}`;
}
function statsHTML() {
  const s = crmStats(), dd = v => (v == null ? '—' : t('{n} j', { n: String(v).replace('.', app.DS || ',') }));
  return `<div class="card"><div class="kpis"><div class="kpi"><b>${s.offres.n}</b><span>${t('offres en attente')} · ${eurR(s.offres.val)}</span></div><div class="kpi"><b>${eurR(s.bloque.val)}</b><span>${t('à recevoir')} · ${tn(s.bloque.n, 'vente', 'ventes')}</span></div><div class="kpi"><b>${s.rate} %</b><span>${t('de pièces vendues')} (${s.nSold}/${s.nPub})</span></div></div></div>
   <div class="card"><h3>${t('Par étape')}</h3>${s.perStage.map(x => `<div class="cxh2"><span style="flex:1">${esc(x.name)}</span><b>${x.n}</b><span>${x.val ? eurR(x.val) : ''}</span></div>`).join('')}</div>
   <div class="card"><h3>${t('Délais moyens')}</h3><div class="cxh2"><span style="flex:1">${t('En ligne → vendu')}</span><b>${dd(s.dPub)}</b></div><div class="cxh2"><span style="flex:1">${t('Vendu → expédié')}</span><b>${dd(s.dExp)}</b></div><div class="cxh2"><span style="flex:1">${t('Expédié → argent reçu')}</span><b>${dd(s.dFin)}</b></div></div>
   <div class="card"><h3>${t('Acheteurs du mois')}</h3>${s.top.length ? s.top.map(b => `<div class="cxh2"><span style="flex:1">@${esc(b.nom)}</span><span>${tn(b.n, 'achat', 'achats')}</span><b>${eurR(b.ca)}</b></div>`).join('') : `<div class="hint">${t('Pas encore de vente avec pseudo ce mois-ci.')}</div>`}</div>`;
}
function tilesHTML() {
  const T = crmTodo();
  const off = T.offres.reduce((a, p) => a + ((p.offre || {}).m || 0), 0);
  const tile = (n, l, go) => `<button type="button" class="cxk" data-crg="${go}"><b>${n}</b><span>${t(l)}</span></button>`;
  return `<div class="cxks">${tile(T.offres.length + (off ? ' · ' + eurR(off) : ''), 'offres en cours', 'offre')}${tile(T.envoyer.length, 'à expédier', 'envoyer')}${tile(T.relances.length, 'acheteurs à relancer', 'buyers')}${tile(T.dormantes.length, 'annonces dormantes', 'ligne')}${T.expirees.length ? tile(T.expirees.length, 'réservations expirées', 'offre') : ''}${T.traine.length ? tile(T.traine.length, 'colis qui traînent', 'expedie') : ''}</div>`;
}
function draw() {
  const box = $('crm'); if (!box || box.hidden) return;
  if (!selMode) sel.clear();
  box.innerHTML = `<div class="cxh"><span class="tag x">${t('Test')}</span><span class="hint" style="margin:0">${t('Le stock vu comme un CRM : fais avancer tes pièces et suis tes acheteurs.')}</span></div>${tilesHTML()}
   <div class="chips" style="margin:0 0 12px">${[['pipe', 'Pipeline'], ['buyers', 'Acheteurs'], ['log', 'Activité'], ['stats', 'Chiffres']].map(([k, l]) => `<button type="button" class="chip sm${sub === k ? ' on' : ''}" data-crs="${k}">${t(l)}</button>`).join('')}</div>
   ${sub === 'pipe' ? toolbarHTML() + bulkHTML() + pipelineHTML() : sub === 'buyers' ? buyersHTML() : sub === 'log' ? activityHTML() : statsHTML()}`;
  hydrate();
}
export const crmDraw = draw;
/** Ouvre directement un sous-écran du CRM : 'pipe', 'buyers', 'log' ou 'stats'. */
export function crmSub(k) { sub = ['pipe', 'buyers', 'log', 'stats'].includes(k) ? k : 'pipe'; LSs('crmSub', sub); draw(); }
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

/* ---- déplacements groupés ---- */
function bulkMove(target) {
  const olds = []; let skipped = 0;
  [...sel].forEach(id => { const o = moveTo(id, target, { silent: true, bulk: true }); if (o) olds.push(o); else skipped++; });
  sel.clear(); selMode = false;
  app.toast(olds.length ? t('{n} pièce(s) déplacée(s) : {s}', { n: olds.length, s: lbl(target) }) + (skipped ? ' · ' + t('{n} ignorée(s)', { n: skipped }) : '') : t('Rien n\'a bougé : ces pièces ne peuvent pas aller là'), olds.length ? () => olds.forEach(o => app.save(o)) : undefined, 6000);
  draw();
}

const host = $('v-list');
let suppress = 0;
host.addEventListener('click', e => {
  const sm = e.target.closest('[data-smode]'); if (sm) return setStockMode(sm.dataset.smode);
  if (mode !== 'crm' || $('crm').hidden) return;
  if (Date.now() < suppress) return;
  const s = e.target.closest('[data-crs]'); if (s) { sub = s.dataset.crs; LSs('crmSub', sub); return draw(); }
  const g = e.target.closest('[data-crg]');
  if (g) { const k = g.dataset.crg; sub = k === 'buyers' ? 'buyers' : 'pipe'; LSs('crmSub', sub); draw(); if (k !== 'buyers') { const c = document.querySelector(`#crm [data-stage="${k}"]`); if (c) c.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' }); } return; }
  if (e.target.closest('[data-cxsel]')) { selMode = !selMode; sel.clear(); return draw(); }
  if (e.target.closest('[data-cxset]')) return openCrmSettings();
  if (e.target.closest('[data-cxexp]')) { putBackExpired(); return draw(); }
  const to = e.target.closest('[data-cxto]'); if (to) return bulkMove(to.dataset.cxto);
  if (e.target.closest('[data-cxlot]')) { const ids = [...sel]; selMode = false; sel.clear(); draw(); return openGroupSale(ids); }
  const tg = e.target.closest('[data-cxtag]'); if (tg) { tagF = tg.dataset.cxtag; return draw(); }
  const lp = e.target.closest('[data-cxlp]'); if (lp) { logP = lp.dataset.cxlp; return draw(); }
  const mg = e.target.closest('[data-cxmg]'); if (mg) { const [a, b] = mg.dataset.cxmg.split('|'); mergeContacts(a, b); app.toast(t('Fiches réunies')); return draw(); }
  const cp = e.target.closest('[data-cpm]'); if (cp) { const c = contacts().find(x => x.k === cp.dataset.cpm); if (c) copyText(message(c.rt && TPL[c.rt] ? c.rt : c.offres.length ? 'offre' : 'relance', c), t('Message')); return; }
  const cv = e.target.closest('[data-csv]'); if (cv) return download(cv.dataset.csv === 'buyers' ? 'syno-acheteurs.csv' : 'syno-journal.csv', cv.dataset.csv === 'buyers' ? csvBuyers() : csvLog());
  if (selMode) { const cd = e.target.closest('.cxc'); if (cd) { const id = cd.dataset.cid; if (sel.has(id)) sel.delete(id); else sel.add(id); return draw(); } }
  const cm = e.target.closest('[data-cm]'); if (cm) return openMove(cm.dataset.cm);
  const ct = e.target.closest('[data-ct]'); if (ct) return openContact(ct.dataset.ct);
  const li = e.target.closest('.cxt[data-id], #crm .li[data-id]'); if (li) return app.openSheet(li.dataset.id);
});
host.addEventListener('input', e => {
  const id = e.target.id; if (id !== 'crm_q' && id !== 'crm_lq') return;
  if (id === 'crm_q') query = e.target.value; else logQ = e.target.value;
  const pos = e.target.selectionStart; draw(); const i = $(id); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) { /* champ non sélectionnable */ } }
});
/* glisser-déposer sur ordinateur : lâcher la carte sur une colonne la déplace */
const dropOn = (col, id) => { const p = app.P.find(x => x.id === id); if (!p || !col) return; moveTo(id, !sold(p) && col.dataset.stage === 'envoyer' ? 'vendu' : col.dataset.stage); draw(); };
host.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.cxc'); if (c && e.dataTransfer) { e.dataTransfer.setData('text/plain', c.dataset.cid); e.dataTransfer.effectAllowed = 'move'; } });
host.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('.cxcol')) e.preventDefault(); });
host.addEventListener('drop', e => { const col = e.target.closest && e.target.closest('.cxcol'); if (!col || !e.dataTransfer) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) dropOn(col, id); });

/* glisser-déposer au doigt : appui long sur une carte, puis on la dépose sur une colonne */
let tdrag = null;
const stopDrag = () => { if (!tdrag) return; clearTimeout(tdrag.timer); if (tdrag.ghost) tdrag.ghost.remove(); document.querySelectorAll('.cxcol.over').forEach(c => c.classList.remove('over')); tdrag = null; };
host.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || selMode || mode !== 'crm') return;
  const c = e.target.closest && e.target.closest('.cxc'); if (!c || e.target.closest('.cxm')) return;
  tdrag = { id: c.dataset.cid, el: c, x: e.clientX, y: e.clientY, on: false, ghost: null, timer: setTimeout(() => {
    if (!tdrag) return; tdrag.on = true;
    const g = c.cloneNode(true); g.classList.add('cxghost'); g.style.width = c.offsetWidth + 'px'; g.style.left = tdrag.x - 20 + 'px'; g.style.top = tdrag.y - 20 + 'px'; document.body.appendChild(g); tdrag.ghost = g; c.classList.add('cxlift');
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (er) { /* sans vibration */ } }
  }, 380) };
});
host.addEventListener('pointermove', e => {
  if (!tdrag) return;
  if (!tdrag.on) { if (Math.hypot(e.clientX - tdrag.x, e.clientY - tdrag.y) > 9) stopDrag(); return; }
  tdrag.ghost.style.left = e.clientX - 20 + 'px'; tdrag.ghost.style.top = e.clientY - 20 + 'px';
  const under = document.elementFromPoint(e.clientX, e.clientY), col = under && under.closest && under.closest('.cxcol');
  document.querySelectorAll('.cxcol.over').forEach(x => { if (x !== col) x.classList.remove('over'); }); if (col) col.classList.add('over');
  const rail = document.querySelector('#crm .cxp'); if (rail) { const r = rail.getBoundingClientRect(); if (e.clientX > r.right - 36) rail.scrollLeft += 14; else if (e.clientX < r.left + 36) rail.scrollLeft -= 14; }
});
const endDrag = e => {
  if (!tdrag) return;
  if (tdrag.on) { const under = document.elementFromPoint(e.clientX, e.clientY), col = under && under.closest && under.closest('.cxcol'), id = tdrag.id; suppress = Date.now() + 400; stopDrag(); if (col) dropOn(col, id); else draw(); } else stopDrag();
};
host.addEventListener('pointerup', endDrag); host.addEventListener('pointercancel', () => stopDrag());
host.addEventListener('touchmove', e => { if (tdrag && tdrag.on) e.preventDefault(); }, { passive: false });
host.addEventListener('contextmenu', e => { if (tdrag) e.preventDefault(); });

/* ---- saisie assistée du pseudo : tous les champs « pseudo de l'acheteur » proposent les acheteurs connus ---- */
document.addEventListener('focusin', e => {
  const i = e.target; if (!i || !i.id || !['s_ps', 'e_ps', 'gs_ps', 'lb'].includes(i.id)) return;
  let dl = document.getElementById('crm_dl'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'crm_dl'; document.body.appendChild(dl); }
  dl.innerHTML = contacts().map(c => `<option value="${esc(c.nom)}">`).join(''); i.setAttribute('list', 'crm_dl');
});
