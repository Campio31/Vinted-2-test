import { app } from '../state.js';
import { $, LSg, LSs, addDays, avail, days, esc, eur, fd, ok, title, today } from './core.js';
import { CFG0 } from './settings-core.js';
import { advice } from './advice.js';
import { colisList } from './colis.js';
import { pendingSales } from './finalisation.js';
import { incomplete } from './complete.js';
import { fournLow } from './supplies-planning.js';
import { goalCalc, goalKinds } from './goals.js';
import { bulkMod, bulkUndo } from './buyers.js';
import { fiscStatus } from './fiscal.js';
import { go } from './nav.js';
import { streakInfo } from './gamification.js';

/* ---------- Max Autopilot, phase 1 : « Ma journée » ---------- */
/* Un moteur de tâches calcule ce qu'il y a à faire d'après tes données (des règles, pas d'IA) et propose des lots à valider.
   Niveaux : Manuel (Max liste, tu fais), Assisté (Max prépare un lot, tu valides : par défaut), Automatique encadré (pas encore disponible).
   Chaque lot appliqué est inscrit dans le journal, et peut être annulé. */
Object.assign(CFG0, { apMode: 'assist', apLog: [], apStats: { lots: 0, items: 0, min: 0 }, rules: {}, ruleSnooze: {}, apSnooze: {} });

export const AP_MODES = [['manual', 'Manuel', 'Max liste les tâches, tu fais tout'], ['assist', 'Assisté', 'Max prépare, tu valides'], ['auto', 'Automatique encadré', 'Bientôt']];
const MIN = { fin: .3, colis: .5, pub: 1, prix: 1.5 };   /* minutes économisées par pièce, estimation */
const MAXI = 5;                                         /* éléments montrés par tâche */
export const apMode = () => (app.cfg.apMode === 'manual' ? 'manual' : 'assist');

/* ---- lots proposés : chaque ligne = une pièce, ce qui change, et le texte à montrer ---- */
export function batchOf(kind) {
  const td = today();
  if (kind === 'fin') return pendingSales().map(p => ({ p, patch: { fin: td }, txt: t('Marquer finalisée') + ' · ' + eur(p.pv || 0) }));
  if (kind === 'colis') return colisList().map(p => ({ p, patch: { exp: td }, txt: t('Colis prêt') + (p.bac ? ' · ' + t('Bac {b}', { b: p.bac }) : '') }));
  if (kind === 'pub') return app.P.filter(p => avail(p) && !ok(p.pub)).map(p => ({ p, patch: { pub: td }, txt: t('Marquer publiée') }));
  if (kind === 'prix') {
    return app.P.filter(p => avail(p) && ok(p.pub) && days(p.pub, td) >= ruleParam('dormant')).map(p => ({ p, a: advice(p) })).filter(x => x.a && x.a.ok && x.a.reco > 0 && !(x.p.pvise > 0 && x.p.pvise <= x.a.reco))
      .sort((a, b) => days(b.p.pub, td) - days(a.p.pub, td)).map(x => ({ p: x.p, patch: { pvise: x.a.reco }, txt: (x.p.pvise > 0 ? eur(x.p.pvise) + ' → ' : '') + t('prix conseillé {p}', { p: eur(x.a.reco) }) }));
  }
  return [];
}

/* ---- les tâches, de la plus importante à la moins importante ---- */
function baseTasks() {
  const T = [], A = app.P.filter(avail), td = today(), mk = (id, tone, n, ttl, why, o) => T.push(Object.assign({ id, tone, n, title: ttl, why }, o));
  const f = fiscStatus();
  if (f.pl && f.pct >= .75) mk('plafond', f.pct >= .9 ? 'r' : 'o', Math.round(f.pct * 100), t('Plafond micro : {p} %', { p: Math.round(f.pct * 100) }), f.cross ? t('À ce rythme tu le dépasses vers le {d}.', { d: fd(f.cross) }) : t('Il te reste {r}.', { r: eur(f.reste) }), { go: 'fisc', btn: t('Ouvrir la ligne fiscale') });
  const fin = batchOf('fin'); if (fin.length) mk('fin', 'o', fin.length, t(fin.length > 1 ? '{n} ventes à finaliser' : '{n} vente à finaliser', { n: fin.length }), t('Elles comptent dans ton chiffre d\'affaires à déclarer une fois finalisées.'), { kind: 'fin', go: 'sales:fin' });
  const col = batchOf('colis'); if (col.length) mk('colis', 'r', col.length, t(col.length > 1 ? '{n} colis à préparer' : '{n} colis à préparer', { n: col.length }), t('Les acheteurs attendent leur envoi : les plus anciens d\'abord.'), { kind: 'colis', go: 'colis' });
  const pub = batchOf('pub'); if (pub.length) mk('pub', 'o', pub.length, t(pub.length > 1 ? '{n} pièces à publier' : '{n} pièce à publier', { n: pub.length }), t('Elles ne peuvent pas se vendre tant qu\'elles ne sont pas en ligne.'), { kind: 'pub', go: 'list:Apub' });
  const prix = batchOf('prix'); if (prix.length) mk('prix', 'n', prix.length, t(prix.length > 1 ? '{n} prix à examiner' : '{n} prix à examiner', { n: prix.length }), t('En ligne depuis plus de {n} jours : le prix conseillé peut accélérer la vente.', { n: ruleParam('dormant') }), { kind: 'prix', go: 'list:Enligne' });
  const inc = A.filter(incomplete).length + app.P.filter(p => !avail(p) && incomplete(p)).length; if (inc) mk('inc', 'n', inc, t(inc > 1 ? '{n} fiches à compléter' : '{n} fiche à compléter', { n: inc }), t('Il manque la grade, l\'état ou le type : 10 fiches en 2 minutes.'), { go: 'complete', btn: t('Compléter') });
  const kind = goalKinds().find(k => goalCalc(k, 'm')), g = kind && goalCalc(kind, 'm');
  if (g && g.cur < g.g && +td.slice(8) >= 15) mk('goal', 'n', Math.round(g.pct * 100), t('Objectif du mois : {p} %', { p: Math.round(g.pct * 100) }), t('Il reste {r} pour l\'atteindre.', { r: eur(g.reste) }), { go: 'courbe', btn: t('Voir l\'objectif') });
  const fo = fournLow(); if (fo.length) mk('fourn', 'o', fo.length, t('À racheter : {n}', { n: fo.map(x => x.n).slice(0, 2).join(', ') }), t('Ton stock de fournitures est bas.'), { go: 'fourn', btn: t('Voir les fournitures') });
  const lb = LSg('lastBackup', ''); if (app.P.length && (!lb || days(lb, td) >= 7)) mk('backup', 'n', 0, t('Fais une sauvegarde'), lb ? t('Dernière sauvegarde il y a {n} jours.', { n: days(lb, td) }) : t('Aucune sauvegarde JSON faite pour l\'instant.'), { go: 'set', btn: t('Sauvegarder') });
  return T;
}
/* tâches reportées à demain (glisser vers la gauche) : elles reviennent le lendemain */
const taskSnoozed = id => { const d = (app.cfg.apSnooze || {})[id]; return !!d && d > today(); };
const allTasks = () => applyRules(baseTasks());
export const tasksToday = () => allTasks().filter(x => !taskSnoozed(x.id));
function snoozeTask(id) {
  app.setCfg({ apSnooze: Object.assign({}, app.cfg.apSnooze, { [id]: addDays(today(), 1) }) });
  app.toast(t('Reportée à demain'), () => { const q = Object.assign({}, app.cfg.apSnooze); delete q[id]; app.setCfg({ apSnooze: q }); app.renderAll(); }, 6000);
  app.renderAll();
}


/* ---------- phase 2 : règles planifiées ---------- */
/* Une règle = quand, si, alors. Elle ne fait que PROPOSER : elle met la tâche en tête de « Ma journée » avec la mention « Règle : … ».
   Règle coupée : sa tâche disparaît. Règle « Pas maintenant » : la tâche revient demain. Au plus 3 règles marquées par jour.
   Les règles sont évaluées à l'ouverture de l'appli (rien ne tourne appli fermée). */
const lastDayOfMonth = () => { const d = new Date(); return d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
const lateColis = () => colisList().some(p => ok(p.dv) && days(p.dv, today()) >= 2);
export const RULES = [
  { id: 'dormant', name: 'Stock dormant', d: 'Quand une pièce reste en ligne sans se vendre, Max prépare une baisse de prix à valider.', task: 'prix', param: { k: 'jours', def: 45, min: 14, max: 180, u: 'jours' }, due: () => true },
  { id: 'colis', name: 'Colis en retard', d: 'Un colis qui attend depuis 2 jours ou plus passe en haut de ta journée.', task: 'colis', due: lateColis },
  { id: 'finalise', name: 'Ventes à finaliser en fin de mois', d: 'Le dernier jour du mois, Max prépare le lot « finaliser » avant ta déclaration.', task: 'fin', due: lastDayOfMonth },
  { id: 'plafond', name: 'Plafond micro', d: 'Max te prévient à 75 % puis 90 % du plafond, avec la projection.', task: 'plafond', due: () => true },
  { id: 'fourn', name: 'Fournitures basses', d: 'Quand un article passe sous son seuil, « à racheter » s\'ajoute à ta journée.', task: 'fourn', due: () => true },
  { id: 'pub', name: 'Nouvelles pièces', d: 'Quand trop de pièces ne sont pas encore publiées, Max prépare le lot « publier ».', task: 'pub', param: { k: 'nb', def: 10, min: 3, max: 100, u: 'pièces' }, due: () => app.P.filter(p => avail(p) && !ok(p.pub)).length > ruleParam('pub') },
  { id: 'rapport', name: 'Fin de mois', d: 'Le dernier jour du mois, Max te prépare le rapport PDF du mois.', make: () => lastDayOfMonth() && app.P.length ? { id: 'r-rapport', tone: 'n', n: 0, title: t('Rapport du mois'), why: t('Le mois se termine : enregistre ton rapport en PDF.'), go: 'rapport', btn: t('Ouvrir les rapports') } : null },
  { id: 'sauvegarde', name: 'Sauvegarde', d: 'Chaque semaine, Max te rappelle de sauvegarder.', task: 'backup', due: () => true },
  { id: 'serie', name: 'Série de publication', d: 'En fin de journée, Max te prévient si ta série est en danger.', make: () => { const s = streakInfo(); return s.n > 0 && !s.today && new Date().getHours() >= 17 ? { id: 'r-serie', tone: 'o', n: s.n, title: t('Ta série de {n} jours est en danger', { n: s.n }), why: t('Publie une pièce avant la fin de la journée.'), go: 'list:Apub', btn: t('Voir à publier') } : null; } },
];
export const ruleOn = id => ((app.cfg.rules || {})[id] || {}).on !== false;
export function ruleParam(id) { const r = RULES.find(x => x.id === id), v = +((app.cfg.rules || {})[id] || {}).p; return r && r.param ? (isFinite(v) && v >= r.param.min && v <= r.param.max ? Math.round(v) : r.param.def) : 0; }
const snoozed = id => { const d = (app.cfg.ruleSnooze || {})[id]; return !!d && d > today(); };
const seenGet = () => { try { return JSON.parse(localStorage.getItem('ruleSeen')) || {}; } catch (e) { return {}; } };
const seenSet = o => { try { localStorage.setItem('ruleSeen', JSON.stringify(o)); } catch (e) { /* stockage indisponible */ } };

/** Applique les règles aux tâches : coupées = masquées, déclenchées = marquées et en tête, max 3 par jour. */
export function applyRules(T) {
  const td = today(), seen = seenGet(), tagged = [];
  let out = T.slice();
  RULES.forEach(r => {
    const on = ruleOn(r.id) && !snoozed(r.id);
    let task = r.task ? out.find(x => x.id === r.task) : null;
    if (!on) { if (r.task) out = out.filter(x => x.id !== r.task); return; }
    if (!task && r.make) { task = r.make(); if (task) out.push(task); }
    if (!task) return;
    if (r.due && !r.due(task)) return;
    if (tagged.length >= 3) return;
    task.rule = r.id; task.ruleName = r.name; tagged.push(task);
    const s = seen[r.id] || { d: '', n: 0, h: false };
    if (s.d !== td) { seen[r.id] = { d: td, n: s.d && !s.h ? s.n + 1 : 0, h: false }; }
    task.ignored = (seen[r.id] || s).n >= 3;
  });
  seenSet(seen);
  return [...out.filter(x => x.rule), ...out.filter(x => !x.rule)];
}
function ruleHandled(id) { const s = seenGet(); s[id] = Object.assign({ d: today(), n: 0 }, s[id], { h: true, n: 0 }); seenSet(s); }
function logRule(id, res) { const r = RULES.find(x => x.id === id); app.setCfg({ apLog: [{ t: Date.now(), k: 'rule', rule: r ? r.name : id, res, n: 0 }, ...(app.cfg.apLog || [])].slice(0, 60) }); }
export function snoozeRule(id) { const o = Object.assign({}, app.cfg.ruleSnooze); o[id] = addDays(today(), 1); app.setCfg({ ruleSnooze: o }); ruleHandled(id); logRule(id, 'later'); }
export function setRule(id, patch) { const o = Object.assign({}, app.cfg.rules), cur = Object.assign({ on: true }, o[id]); o[id] = Object.assign(cur, patch); app.setCfg({ rules: o }); }

/* ---- carte « Règles de Max » dans Réglages ---- */
function renderRules() {
  const c = $('rlc'); if (!c || c.contains(document.activeElement)) return;
  c.innerHTML = `<h3>${t('Règles de Max')}</h3><p class="sub">${t('Des règles prêtes à activer. Elles proposent des tâches dans « Ma journée », jamais d\'action sans ta validation. Évaluées à l\'ouverture de l\'appli.')}</p>`
    + RULES.map(r => `<div class="rur"><label class="chk cfr"><input type="checkbox" data-ru="${r.id}"${ruleOn(r.id) ? ' checked' : ''}><span><b>${t(r.name)}</b><small>${t(r.d)}</small></span></label>${r.param ? `<div class="cfld rup"><label class="l" for="rp_${r.id}">${r.id === 'dormant' ? t('À partir de') : t('Au-delà de')}</label><span class="uin"><input type="text" inputmode="numeric" id="rp_${r.id}" data-rp="${r.id}" value="${ruleParam(r.id)}"><i aria-hidden="true">${t(r.param.u)}</i></span></div>` : ''}</div>`).join('');
}
app.renderRules = renderRules;
$('v-set').addEventListener('change', e => {
  const on = e.target.closest('[data-ru]');
  if (on) { setRule(on.dataset.ru, { on: on.checked }); app.renderDash && app.renderDash(); return; }
  const p = e.target.closest('[data-rp]');
  if (p) { const r = RULES.find(x => x.id === p.dataset.rp), v = Math.round(+String(p.value).replace(',', '.')); setRule(r.id, { p: isFinite(v) ? Math.min(r.param.max, Math.max(r.param.min, v)) : r.param.def }); renderRules(); app.renderDash && app.renderDash(); }
});
/* ---- appliquer un lot, avec journal et annulation ---- */
export function applyBatch(kind, ids, rule) {
  const plan = batchOf(kind).filter(x => ids.includes(x.p.id));
  if (!plan.length) return 0;
  const patch = Object.fromEntries(plan.map(x => [x.p.id, x.patch]));
  const out = bulkMod(plan.map(x => x.p.id), q => Object.assign(q, patch[q.id]));
  const n = out.length, min = Math.round(n * (MIN[kind] || 0) * 10) / 10, st = Object.assign({ lots: 0, items: 0, min: 0 }, app.cfg.apStats);
  const entry = { t: Date.now(), k: kind, n, ids: out.map(x => x.q.id) };
  if (rule) { entry.rule = (RULES.find(x => x.id === rule) || {}).name; ruleHandled(rule); }
  app.setCfg({ apStats: { lots: st.lots + 1, items: st.items + n, min: Math.round((st.min + min) * 10) / 10 }, apLog: [entry, ...(app.cfg.apLog || [])].slice(0, 60) });
  app.toast(t('{n} modifications appliquées', { n }), () => {
    bulkUndo(out);
    const s2 = Object.assign({ lots: 0, items: 0, min: 0 }, app.cfg.apStats);
    app.setCfg({ apStats: { lots: Math.max(0, s2.lots - 1), items: Math.max(0, s2.items - n), min: Math.max(0, Math.round((s2.min - min) * 10) / 10) }, apLog: (app.cfg.apLog || []).map(e => e.t === entry.t ? Object.assign({}, e, { undone: 1 }) : e) });
    app.renderAll();
  }, 8000);
  app.renderAll();
  return n;
}

/* ---- écran : carte « Ma journée » en haut du Bilan ---- */
let openId = '', excl = new Set(), showLog = false, showSet = false, jOpen = false;
/* Ma journée est aussi un outil : il ouvre la carte même quand elle est repliée (tout est fait) */
/* la carte se réduit d'un appui, même s'il reste des tâches : elle reste réduite jusqu'à la fin de la journée */
const isShut = () => LSg('jShut', '') === today();
app.openJournee = () => { jOpen = true; LSs('jShut', ''); go('dash'); };
const KIND_LABEL = { fin: 'Ventes finalisées', colis: 'Colis prêts', pub: 'Pièces publiées', prix: 'Prix mis à jour' };
function taskHTML(x) {
  const mode = apMode(), batch = x.kind && mode === 'assist', isOpen = openId === x.id && batch;
  const body = isOpen ? (() => {
    const L = batchOf(x.kind), shown = L.slice(0, MAXI), nSel = L.filter(y => !excl.has(y.p.id)).length;
    return `<div class="apl">${shown.map(y => `<label class="apr"><input type="checkbox" data-aps="${esc(y.p.id)}"${excl.has(y.p.id) ? '' : ' checked'}><span><b>${esc(title(y.p))}${y.p.taille ? ' · ' + esc(y.p.taille) : ''}</b><small>${esc(y.txt)}</small></span></label>`).join('')}${L.length > MAXI ? `<div class="hint">${t('{n} autres dans la liste complète.', { n: L.length - MAXI })} <button type="button" class="lnk" data-ap="go:${esc(x.go || '')}">${t('Voir tout')}</button></div>` : ''}</div>
      <div class="acts two"><button type="button" class="btn" data-ap="do:${x.kind}"${nSel ? '' : ' disabled'}>${t('Appliquer à {n}', { n: nSel })}</button><button type="button" class="btn sec" data-ap="close">${t('Fermer')}</button></div>`;
  })() : '';
  const rl = x.rule ? `<div class="apq"><span>${t('Règle : {r}', { r: t(x.ruleName) })}</span><button type="button" class="lnk" data-ap="later:${x.rule}">${t('Pas maintenant')}</button></div>${x.ignored ? `<div class="apq ign"><span>${t('Tu as ignoré cette règle 3 fois de suite.')}</span><button type="button" class="lnk" data-ap="off:${x.rule}">${t('La désactiver')}</button></div>` : ''}` : '';
  return `<div class="apt t-${x.tone}${isOpen ? ' open' : ''}">${rl}<button type="button" class="aph" data-ap="${batch ? 'open:' + x.id : 'go:' + (x.go || '')}"><span class="apn">${x.n || '·'}</span><span class="apx"><b>${esc(x.title)}</b><small>${esc(x.why)}</small></span><span class="apb">${batch ? (isOpen ? '▴' : t('À valider')) : esc(x.btn || t('Ouvrir'))}</span></button><button type="button" class="apz" data-ap="snooze:${esc(x.id)}" aria-label="${esc(t('Reporter à demain'))}">⏭</button>${body}</div>`;
}
/* tuile d'un compteur : touche-la pour ouvrir la tâche correspondante (même action que la ligne dessous) */
const TILES = [['pub', 'à publier', 'b'], ['colis', 'à préparer', 'a'], ['prix', 'à relancer', 't'], ['fin', 'à finaliser', 'g']];
function tileHTML([id, lab, col], T, mode) {
  const x = T.find(y => y.id === id), n = x ? x.n : 0;
  const act = !x ? '' : ` data-ap="${x.kind && mode === 'assist' ? 'open:' + x.id : 'go:' + (x.go || '')}"`;
  return `<button type="button" class="apc-t c-${col}${n ? '' : ' zero'}"${act}${x ? '' : ' disabled'}><b>${n}</b><span>${t(lab)}</span></button>`;
}
/* anneau : tâches faites aujourd'hui sur le total du jour (faites + restantes) */
function ringHTML(done, total) {
  const R = 26, C = 2 * Math.PI * R, pc = total ? Math.min(1, done / total) : 1;
  return `<svg class="apring" viewBox="0 0 64 64" role="img" aria-label="${esc(t('{a} sur {b}', { a: done, b: total }))}"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--ok,#1D9E75)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C * pc).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${done}/${total}</text></svg>`;
}
export function journeeHTML() {
  if (!app.P.length) return '';
  const AL = allTasks(), T = AL.filter(x => !taskSnoozed(x.id)), nSn = AL.length - T.length, mode = apMode(), st = Object.assign({ lots: 0, items: 0, min: 0 }, app.cfg.apStats), log = app.cfg.apLog || [];
  const hi = new Date().getHours(), hello = hi < 12 ? t('Bonjour') : hi < 18 ? t('Bon après-midi') : t('Bonsoir');
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const done = log.filter(e => e.k !== 'rule' && !e.undone && e.t >= d0.getTime()).length, total = done + T.length, sr = streakInfo().n;
  /* tout est fait : la carte se replie en une ligne (on la rouvre d'un appui, ou depuis Outils) */
  if (isShut() || (!T.length && !jOpen)) return `<div class="card tdy ap apdone" data-ck="today" data-lb="${esc(t('Ma journée'))}"><button type="button" class="apx0" data-ap="jopen"><span class="apok${T.length ? ' ' : ' ok'}" aria-hidden="true">${T.length ? T.length : '✓'}</span><span class="apx"><b>${T.length ? t('Ma journée') : t('Ma journée est terminée')}</b><small>${T.length ? t(T.length > 1 ? 'Voici tes {n} priorités.' : 'Voici ta priorité.', { n: T.length }) : t('Tout est à jour : rien d\'urgent aujourd\'hui.')}</small></span><span class="apb">${t('Ouvrir')}</span></button></div>`;
  return `<div class="card tdy ap" data-ck="today" data-lb="${esc(t('Ma journée'))}"><div class="aph0">${ringHTML(done, total)}<div style="flex:1;min-width:0"><h3 style="margin:0 0 2px">${t('Ma journée')}</h3><p class="sub" style="margin:0">${hello} ! ${T.length ? t(T.length > 1 ? 'Voici tes {n} priorités.' : 'Voici ta priorité.', { n: T.length }) : t('Tout est à jour : rien d\'urgent aujourd\'hui.')}</p>${sr > 1 ? `<p class="sub" style="margin:2px 0 0">${t('{n} jours de suite', { n: sr })}</p>` : ''}</div><button type="button" class="apcl" data-ap="jclose" aria-label="${esc(t('Réduire'))}">▴</button></div>
   <div class="apc">${TILES.map(x => tileHTML(x, T, mode)).join('')}</div>
   ${T.length ? `<div class="hint apsw">${t('Glisse une tâche vers la droite pour la faire, vers la gauche pour la reporter à demain.')}</div>` : ''}
   ${T.map(x => `<div class="apw" data-tid="${esc(x.id)}"><div class="apbg" aria-hidden="true"><span>${t('Faire')}</span><span>${t('Reporter')}</span></div>${taskHTML(x)}</div>`).join('')}
   ${nSn ? `<div class="hint apsn">${t(nSn > 1 ? '{n} tâches reportées à demain.' : '{n} tâche reportée à demain.', { n: nSn })} <button type="button" class="lnk" data-ap="unsnooze">${t('Les remettre')}</button></div>` : ''}
   <details class="apd"${showLog || showSet ? ' open' : ''}><summary>${t('Réglages de Max')}</summary>
   <div class="apm" role="group" aria-label="${esc(t('Niveau d\'automatisation'))}">${AP_MODES.map(([k, l, d]) => `<button type="button" class="${mode === k ? 'on' : ''}" data-ap="mode:${k}"${k === 'auto' ? ' disabled' : ''} title="${esc(t(d))}">${t(l)}</button>`).join('')}</div>
   <div class="hint" style="margin:6px 0 0">${t(AP_MODES.find(m => m[0] === mode)[2])}.</div>
   ${st.lots ? `<div class="hint" style="margin:8px 0 0">${t('Avec Max : {l} lots, {n} modifications, environ {m} min gagnées (estimation).', { l: st.lots, n: st.items, m: Math.round(st.min) })}</div>` : ''}
   <button type="button" class="lnk" data-ap="rules" style="margin-top:8px;margin-right:14px">${t('Règles de Max')}</button>${log.length ? `<button type="button" class="lnk" data-ap="log" style="margin-top:8px">${showLog ? t('Masquer le journal') : t('Journal des actions')}</button>` : ''}
   ${showLog ? `<div class="apj">${log.slice(0, 15).map(e => `<div class="${e.undone ? 'un' : ''}"><span>${new Date(e.t).toLocaleString(app.LOC, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><b>${e.k === 'rule' ? t('Règle : {r}', { r: t(e.rule) }) + ' · ' + t({ later: 'reportée à demain', off: 'désactivée' }[e.res] || e.res) : t(KIND_LABEL[e.k] || e.k) + (e.rule ? ' · ' + t('règle : {r}', { r: t(e.rule) }) : '') + ' · ' + e.n}</b>${e.undone ? `<em>${t('annulé')}</em>` : ''}</div>`).join('')}</div>` : ''}
   </details>
  </div>`;
}app.journeeHTML = journeeHTML;
$('dsh').addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('apd')) showSet = e.target.open; }, true);
app.tasksToday = tasksToday;

function goTo(spec) {
  const [k, v] = String(spec).split(':');
  if (k === 'sales') { app.salesFilter(v || 'all'); return go('sales'); }
  if (k === 'list') { app.filt = v || 'Tous'; app.lim = 60; return go('list'); }
  if (k === 'set') return go('set');
  if (k) app.openTool(k);
}
/* glisser une tâche : à droite = la faire (comme un appui), à gauche = la reporter à demain */
let sw = null, swallow = false;
const swEnd = e => {
  if (!sw || e.pointerId !== sw.id) return;
  const { w, c, dx, on } = sw; sw = null;
  c.style.transform = ''; w.classList.remove('drag', 'r', 'l');
  if (!on) return;
  if (dx > 90 && e.type === 'pointerup') w.querySelector('.aph').click();
  else if (dx < -90 && e.type === 'pointerup') snoozeTask(w.dataset.tid);
  swallow = true; setTimeout(() => { swallow = false; }, 350);
};
$('dsh').addEventListener('pointerdown', e => {
  const h = e.target.closest('.aph'); if (!h || (e.pointerType === 'mouse' && e.button > 0)) return;
  const w = h.closest('.apw'), c = h.closest('.apt'); if (!w || c.classList.contains('open')) return;
  sw = { w, c, x: e.clientX, y: e.clientY, dx: 0, on: false, id: e.pointerId, el: h };
});
$('dsh').addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
    if (Math.abs(dx) < 10) return;
    sw.on = true; sw.w.classList.add('drag');
    try { sw.el.setPointerCapture(e.pointerId); } catch (er) { /* capture indisponible */ }
  }
  sw.dx = dx;
  sw.c.style.transform = `translateX(${Math.max(-140, Math.min(140, dx))}px)`;
  sw.w.classList.toggle('r', dx > 60); sw.w.classList.toggle('l', dx < -60);
});
$('dsh').addEventListener('pointerup', swEnd);
$('dsh').addEventListener('pointercancel', swEnd);
$('dsh').addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
$('dsh').addEventListener('click', e => {
  const b = e.target.closest('[data-ap]'); if (!b) return;
  const [a, v] = [b.dataset.ap.split(':')[0], b.dataset.ap.split(':').slice(1).join(':')];
  if (a === 'jopen') { jOpen = true; LSs('jShut', ''); return app.renderDash(); }
  if (a === 'jclose') { jOpen = false; LSs('jShut', today()); return app.renderDash(); }
  if (a === 'snooze') return snoozeTask(v);
  if (a === 'unsnooze') { app.setCfg({ apSnooze: {} }); return app.renderAll(); }
  if (a === 'open') { openId = openId === v ? '' : v; excl = new Set(); return app.renderDash(); }
  if (a === 'close') { openId = ''; return app.renderDash(); }
  if (a === 'go') return goTo(v);
  if (a === 'log') { showLog = !showLog; return app.renderDash(); }
  if (a === 'mode') { if (v !== 'auto') app.setCfg({ apMode: v }); openId = ''; return app.renderDash(); }
  if (a === 'later') { snoozeRule(v); return app.renderAll(); }
  if (a === 'off') { setRule(v, { on: false }); logRule(v, 'off'); return app.renderAll(); }
  if (a === 'rules') { go('set'); if (app.openSetCard) app.openSetCard('rlc'); setTimeout(() => { const c = $('rlc'); if (c) c.scrollIntoView(); }, 60); return; }
  if (a === 'do') { const ids = batchOf(v).filter(y => !excl.has(y.p.id)).map(y => y.p.id), tk = tasksToday().find(y => y.kind === v); openId = ''; excl = new Set(); applyBatch(v, ids, tk && tk.rule); }
});
$('dsh').addEventListener('change', e => {
  const c = e.target.closest('[data-aps]'); if (!c) return;
  c.checked ? excl.delete(c.dataset.aps) : excl.add(c.dataset.aps);
  app.renderDash();
});
renderRules();
