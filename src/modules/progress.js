import { app } from '../state.js';
import { $, LSg, LSs, esc, eur, ok, sold, today } from './core.js';
import { sheetHead, showSheet } from './tools-index.js';
import { FLAME, MOIS, streakInfo } from './gamification.js';
import { defiDone, defiProg, defiTxt, defisOf } from './challenges.js';
import { cartesBody, cartesClick, cartesTilt, checkUniques, packsLeft } from './cartes.js';
import { CATS, TIERS, checkTrophies, trophyData } from './trophees.js';
import { rangBody, rangClick, rangInit } from './rang.js';

/* ---------- Défis, cartes, trophées, classement : un seul écran, 4 onglets ---------- */
/* Le niveau se calcule à partir de ce que tu fais déjà : rien n'est stocké, donc rien à synchroniser ni à tricher.
   Points : publier une pièce 1, vendre 3, préparer un colis 1, réussir un défi 5. Les pièces d'exemple ne comptent pas. */
export const LEVELS = [
  { n: 'Débutant', min: 0 }, { n: 'Chineur', min: 50 }, { n: 'Confirmé', min: 150 },
  { n: 'Pro', min: 400 }, { n: 'Expert', min: 1000 }, { n: 'Légende', min: 2500 },
];

export const defisReussis = () => (app.cfg.defis || []).filter(defiDone);
export function xpData() {
  const R = app.P.filter(p => !p.ex), pubs = R.filter(p => ok(p.pub)).length, sales = R.filter(sold).length, colis = R.filter(p => sold(p) && p.exp).length, med = defisReussis().length;
  return { pubs, sales, colis, med, xp: pubs + 3 * sales + colis + 5 * med };
}
export function levelOf(xp) {
  let i = 0; LEVELS.forEach((l, k) => { if (xp >= l.min) i = k; });
  const cur = LEVELS[i], next = LEVELS[i + 1] || null;
  return { i, cur, next, pct: next ? Math.min(1, (xp - cur.min) / (next.min - cur.min)) : 1, left: next ? next.min - xp : 0 };
}

let tab = 'now';
const TABS = [['now', 'Défis'], ['cartes', 'Cartes'], ['trophees', 'Trophées'], ['classement', 'Classement']];
export function openProgress(t0) { if (t0) tab = t0 === 'amis' ? 'classement' : t0; draw(); }
app.openTrophees = () => openProgress('trophees');
app.openDefis = () => openProgress('now');

const defiCard = d => {
  const g = defiProg(d), done = defiDone(d), pc = done ? 1 : Math.min(1, g / d.target), pack = d.scope === 'month' ? t('pack premium') : t('pack');
  return `<div class="card dfi${done ? ' ok' : ''}"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${esc(defiTxt(d))}</b><div class="dfs">${d.src === 'common' ? t('Pour tout le monde') : t('Pour toi')} · ${t('récompense : {p}', { p: pack })}</div></div><span class="gp gc-${done ? 'g' : 'o'}">${Math.round(pc * 100)} %</span></div><div class="rl"><b class="gc-${done ? 'g' : 'o'}" style="width:${(pc * 100).toFixed(1)}%"></b></div><div class="gl2">${t('{a} sur {b}', { a: d.type === 'ca' ? eur(g) : g, b: d.type === 'ca' ? eur(d.target) : d.target })}${done ? ' · ' + t('défi réussi, +5 points') : ''}</div></div>`;
};
function nowBody() {
  const x = xpData(), L = levelOf(x.xp), st = streakInfo(), m = today().slice(0, 7);
  const lvl = `<div class="gcard" style="margin-bottom:10px"><div class="gh2"><span>${t('Niveau')}</span><span>${t('{n} points', { n: x.xp })}</span></div><div class="gbig cd">${t(L.cur.n)}</div><div class="rl"><b class="gc-g" style="width:${(L.pct * 100).toFixed(1)}%"></b></div><div class="gl2">${L.next ? t('Encore {n} points pour devenir {l}.', { n: L.left, l: t(L.next.n) }) : t('Niveau maximum atteint.')}</div><div class="gl2" style="margin-top:4px">${t('Publier une pièce 1 point · vendre 3 · préparer un colis 1 · réussir un défi 5')}</div></div>`;
  const ser = `<div class="gcard" style="margin-bottom:10px"><div class="gh2"><span>${t('Série de publication')}</span><span>${t('record {n} j', { n: st.best })}</span></div><div class="gbig cd" style="display:flex;align-items:center;gap:12px"><span class="flm${st.n ? ' on' : ''}">${FLAME}</span>${st.n}<small> ${t(st.n > 1 ? 'jours' : 'jour')}</small></div><div class="gl2">${t(st.today ? 'Tu as déjà publié aujourd\'hui.' : st.pending ? 'Hier était ton jour de repos : publie aujourd\'hui pour continuer.' : st.n ? 'Publie aujourd\'hui pour garder ta série.' : 'Publie une pièce aujourd\'hui pour lancer une série.')}</div><div class="gl2" style="margin-top:4px">${t('Un jour de repos par semaine est permis sans casser la série.')}${st.n ? ' ' + t(st.restLeft ? 'Ton jour de repos de cette semaine est encore disponible.' : 'Ton jour de repos de cette semaine est utilisé.') : ''}</div></div>`;
  const W = defisOf('week'), M = defisOf('month'), packs = packsLeft();
  const sec = (h, sub, L) => `<h3 style="margin:16px 0 2px">${h}</h3><p class="sub" style="margin:0 0 8px">${sub}</p>${L.length ? L.map(defiCard).join('') : `<div class="card empty">${t('Tes défis arrivent dans un instant.')}</div>`}`;
  return lvl + ser + (packs ? `<button type="button" class="btn mint" data-ptab="cartes" style="margin-bottom:6px">${t('{n} pack à ouvrir', { n: packs })}</button>` : '')
    + sec(t('Cette semaine'), t('1 défi commun et 2 pour toi. Chaque défi réussi offre un pack de cartes.'), W)
    + sec(t('Ce mois-ci'), MOIS[+m.slice(5) - 1] + ' ' + m.slice(0, 4) + ' · ' + t('3 défis communs et 3 pour toi. Un défi du mois offre un pack premium.'), M);
}
function tropheesBody() {
  const D = trophyData(), tot = D.reduce((a, c) => a + c.tier, 0);
  return `<p class="sub">${t('{a} paliers sur {b}', { a: tot, b: CATS.length * TIERS.length })} · ${t('Chaque palier atteint offre un pack premium.')}</p>`
    + D.map(c => `<div class="card tro t${c.tier}"><div class="th2"><span class="medal m${c.tier}">${c.tier ? esc(t(TIERS[c.tier - 1])[0]) : '·'}</span><div><b>${t(c.t)}</b><small>${t(c.d)}</small></div><span class="tt2">${c.tier ? t(TIERS[c.tier - 1]) : t('à débloquer')}</span></div>
     <div class="pips">${TIERS.map((n, i) => `<i class="m${i + 1}${c.tier > i ? ' on' : ''}" title="${esc(t(n))}"></i>`).join('')}</div>
     <div class="rl"><b class="gc-g" style="width:${(c.pct * 100).toFixed(1)}%"></b></div><div class="gl2">${c.next ? t('{a} sur {b} pour le palier {p}', { a: c.show(c.val), b: c.show(c.next), p: t(TIERS[c.tier]) }) : t('Palier Diamant atteint : {a}', { a: c.show(c.val) })}</div></div>`).join('');
}
function draw() {
  const body = tab === 'trophees' ? tropheesBody() : tab === 'cartes' ? cartesBody() : tab === 'classement' ? rangBody() : nowBody();
  showSheet(sheetHead(t('Défis, cartes et trophées')) + `<div class="chips ptabs" style="margin-bottom:12px">${TABS.map(([k, l]) => `<button type="button" class="chip sm${tab === k ? ' on' : ''}" data-ptab="${k}">${t(l)}</button>`).join('')}</div>` + body);
  $('shc').onclick = async e => {
    if (e.target.closest('[data-am]')) return app.amisClick(e);
    const tb = e.target.closest('[data-ptab]'); if (tb) { tab = tb.dataset.ptab; return draw(); }
    if (tab === 'cartes') { const r = cartesClick(e); if (r) draw(); return; }
    if (tab === 'classement') { const r = await rangClick(e); if (r) draw(); }
  };
  if (tab === 'classement') rangInit();
  if (tab === 'cartes') cartesTilt($('shc'));
}

/* message quand tu montes de niveau (le premier calcul ne dit rien : on ne félicite pas pour l'existant) */
let lvT = null;
export function checkLevel() {
  if (app.importing || !app.loaded || !app.P.length) return;
  const L = levelOf(xpData().xp), seen = LSg('lvlSeen', null);
  if (seen === null) { LSs('lvlSeen', L.i); return; }
  if (L.i > seen) { LSs('lvlSeen', L.i); app.toast(t('Niveau {l} atteint !', { l: t(L.cur.n) }), null, 5000); }
}
const scheduleBadges0 = app.scheduleBadges;
app.scheduleBadges = function () { scheduleBadges0(); clearTimeout(lvT); lvT = setTimeout(() => { checkLevel(); checkTrophies(); checkUniques(); }, 1000); };
