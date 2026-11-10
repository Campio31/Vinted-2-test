import { app } from '../state.js';
import { $, LSg, LSs, addDays, age, avail, days, dj, ok, sold, today, eurR } from './core.js';
import { bilCtx, bilOk, bilRange, stats } from './dashboard.js';
import { incomplete } from './complete.js';
import { streakInfo } from './gamification.js';
import { tresoData } from './treasury.js';

/* ---------- Bilan : trois onglets, chacun avec sa couleur ---------- */
/* Sous l'objectif : Finances (vert), Activité (bleu), Stock (orange). Chaque onglet montre 6 indicateurs clés avec une flèche
   de hausse ou de baisse, puis UN graphique à la fois (des pastilles pour changer), de façon que tout tienne sur un écran.
   Le dernier onglet et le dernier graphique de chaque onglet sont retenus. */
const TABS = [['m', 'Finances'], ['a', 'Activité'], ['s', 'Stock']];
const BY_TOOL = { treso: 'm', rapport: 'm', fisc: 'm', calcom: 'a', defis: 'a' };
const BY_CK = { seuil: 'm', cohorte: 's', fourn: 's', live: 'a', planning: 'a' };
const BY_SEC = { 'Ventes': 'a', 'Dépenses': 'm', 'Stock actuel': 's', 'Six derniers mois': 'm', 'Par plateforme': 'm', 'Par compte': 'm', 'Par catégorie': 'a', 'Meilleures marques': 'a', 'Provenance': 's', 'Retours': 'a', 'Analyse par ballot': 's' };
const FIXED = el => el.matches('.ap, .dsa, .gcard, .hero, .empty, .btabs, .btiles, .bchips, [data-ck="today"], button.btn');

export const tabOf = el => {
  if (el.dataset.tool) return BY_TOOL[el.dataset.tool] || 'm';
  if (el.classList.contains('kpis')) return 'm';
  if (el.dataset.ck && BY_CK[el.dataset.ck]) return BY_CK[el.dataset.ck];
  const h = el.querySelector('h3[data-sec]');
  if (h && BY_SEC[h.dataset.sec]) return BY_SEC[h.dataset.sec];
  return el.classList.contains('minic') ? 'a' : 'm';
};
let tab = LSg('bilTab', 'm');
if (!TABS.some(x => x[0] === tab)) tab = 'm';
const pick = Object.assign({ m: '', a: '', s: '' }, LSg('bilPick', {}));   /* graphique choisi dans chaque onglet */
const keyOf = el => el.dataset.ck || (el.querySelector('h3[data-sec]') || {}).dataset?.sec || (el.querySelector('h3') || {}).textContent || '';
const labelOf = el => (el.dataset.lb || (el.querySelector('h3') || {}).textContent || keyOf(el)).split('·')[0].replace(/\s+/g, ' ').trim();

/* ---- flèches : la période du Bilan face à la période d'avant, de même durée (30 jours si « Tout ») ---- */
function windows() {
  const r = bilRange(), to = r.to || today(), from = r.from || addDays(today(), -29), n = days(from, to) + 1;
  return { from, to, pf: addDays(from, -n), pt: addDays(from, -1) };
}
const soldIn = (a, b) => app.P.filter(p => sold(p) && ok(p.dv) && p.dv >= a && p.dv <= b && bilOk(p));
const depIn = (a, b) => (app.DEP || []).filter(d => ok(d.date) && d.date >= a && d.date <= b).reduce((s, d) => s + (d.montant || 0), 0);
/* état du stock à une date passée, reconstitué avec les dates d'entrée, de publication et de vente */
const stockAt = d => app.P.filter(p => ok(p.entree) && p.entree <= d && !(sold(p) && ok(p.dv) && p.dv <= d));
const sumAge = (L, d) => L.length ? L.reduce((a, p) => a + Math.max(0, days(p.entree, d)), 0) / L.length : 0;
const onlineAt = d => stockAt(d).filter(p => ok(p.pub) && p.pub <= d);
const rateAt = d => { const all = app.P.filter(p => ok(p.entree) && p.entree <= d); return all.length ? all.filter(p => sold(p) && ok(p.dv) && p.dv <= d).length / all.length : 0; };
const mtr = L => { const S = stats(L); return { n: S.n, ca: S.ca, ben: S.ben, bpv: S.n ? S.ben / S.n : 0, marge: S.marge * 100, panier: S.panier, delai: S.delai }; };

/** Flèche d'une tuile : cur et prev sont comparés ; goodUp dit si la hausse est une bonne nouvelle ; pts = écart en points. */
function arrow(cur, prev, goodUp, pts) {
  if (prev == null || cur == null || (!cur && !prev)) return '<i class="bka">&nbsp;</i>';
  const d = pts ? cur - prev : (prev ? (cur - prev) / Math.abs(prev) * 100 : 100), r = Math.round(d);
  if (!r) return '<i class="bka eq">→</i>';
  const up = d > 0, good = up === goodUp;
  return `<i class="bka ${up ? 'up' : 'dn'} ${good ? 'ok' : 'ko'}" aria-label="${up ? t('en hausse') : t('en baisse')}">${up ? '↑' : '↓'} ${Math.abs(r)}${pts ? ' pt' : ' %'}</i>`;
}

/** Les 6 indicateurs de chaque onglet : [valeur, libellé, outil au toucher, flèche]. */
export function tilesOf(k) {
  const S = bilCtx.S || { n: 0, ca: 0, ben: 0, marge: 0, panier: 0, delai: 0 }, A = app.P.filter(avail), td = today(), td0 = addDays(td, -30);
  if (k === 'm' || k === 'a') {
    const W = windows(), c = mtr(soldIn(W.from, W.to)), p = mtr(soldIn(W.pf, W.pt));
    if (k === 'm') {
      const dep = (app.DEP || []).filter(d => ok(d.date) && (!bilCtx.from || d.date >= bilCtx.from)).reduce((a, d) => a + (d.montant || 0), 0), tr = tresoData();
      return [
        [eurR(S.ca), t('chiffre d\'affaires'), '', arrow(c.ca, p.ca, true)],
        [S.n ? eurR(S.ben / S.n) : '—', t('bénéfice par vente'), '', arrow(c.bpv, p.bpv, true)],
        [Math.round(S.marge * 100) + ' %', t('de marge'), '', arrow(c.marge, p.marge, true, true)],
        [eurR(S.panier), t('panier moyen'), '', arrow(c.panier, p.panier, true)],
        [eurR(dep), t('de dépenses'), '', arrow(depIn(W.from, W.to), depIn(W.pf, W.pt), false)],
        [tr ? eurR(tr.now) : '—', t('trésorerie'), 'treso', tr ? arrow(tr.rate, 0, true) : arrow()]];
    }
    const sd = app.P.filter(p => p.statut === 'Vendu').length, ecoul = app.P.length ? sd / app.P.length : 0;
    return [
      [S.n, t(S.n > 1 ? 'ventes' : 'vente'), '', arrow(c.n, p.n, true)],
      [S.n ? dj(S.delai) : '—', t('délai avant la vente'), '', arrow(c.delai, p.delai, false)],
      [Math.round(ecoul * 100) + ' %', t('pièces vendues'), '', arrow(rateAt(td) * 100, rateAt(td0) * 100, true, true)],
      [app.colisCount ? app.colisCount() : 0, t('colis à préparer'), 'colis', arrow()],
      [streakInfo().n, t('jours de série'), 'trophees', arrow()],
      [A.filter(p => ok(p.pub)).length, t('pièces en ligne'), '', arrow(onlineAt(td).length, onlineAt(td0).length, true)]];
  }
  const imm = L => L.reduce((a, p) => a + (p.achat || 0), 0), s0 = stockAt(td0), s1 = stockAt(td);
  const aPub = (L, d) => L.filter(p => !(ok(p.pub) && p.pub <= d)).length, relance = (L, d) => L.filter(p => ok(p.pub) && p.pub <= d && days(p.pub, d) >= 30).length;
  const moy = A.length ? A.reduce((a, p) => a + age(p), 0) / A.length : 0;
  return [
    [A.length, t('pièces en stock'), '', arrow(s1.length, s0.length, true)],
    [eurR(A.reduce((a, p) => a + (p.achat || 0), 0)), t('argent immobilisé'), '', arrow(imm(s1), imm(s0), false)],
    [A.length ? dj(moy) : '—', t('ancienneté moyenne'), '', arrow(sumAge(s1, td), sumAge(s0, td0), false)],
    [A.filter(p => !ok(p.pub)).length, t('à publier'), '', arrow(aPub(s1, td), aPub(s0, td0), false)],
    [A.filter(p => ok(p.pub) && days(p.pub, td) >= 30).length, t('à relancer'), '', arrow(relance(s1, td), relance(s0, td0), false)],
    [app.P.filter(incomplete).length, t('fiches à compléter'), 'fiches', arrow()]];
}
const tilesHTML = k => `<div class="btiles bt-${k}">${tilesOf(k).map(([v, l, tool, ar]) => `<${tool ? 'button type="button"' : 'div'} class="bkt"${tool ? ` data-tool="${tool}"` : ''}>${ar}<b>${v}</b><span>${l}</span></${tool ? 'button' : 'div'}>`).join('')}</div>`;

function barHTML() {
  return `<div class="dsa btabs" role="tablist" aria-label="${t('Bilan')}">${TABS.map(([k, l]) => `<button type="button" role="tab" class="chip${k === tab ? ' on' : ''}" aria-selected="${k === tab}" data-bt="${k}">${t(l)}</button>`).join('')}</div>`;
}

const renderDash0 = app.renderDash;
const kids = box => [...box.children].filter(el => !FIXED(el));
app.renderDash = function () {
  renderDash0.apply(this, arguments);
  const box = $('dsh');
  if (!box || !app.loaded) return;
  /* le bénéfice net de la période se place juste sous la carte Objectifs (hors onglets) */
  const hero = box.querySelector('.hero'), goal = box.querySelector('.gcard') || box.querySelector('.ap');
  if (hero && goal && goal.nextElementSibling !== hero) goal.after(hero);
  box.querySelectorAll('.btiles, .btabs, .bchips').forEach(b => b.remove());
  const items = kids(box);
  /* rien à classer, ou bilan réduit du mode simple : pas d'onglets */
  if (!items.length || items.every(el => el.style.display === 'none')) { delete box.dataset.bt; return; }
  items.forEach(el => { el.classList.remove('bt-m', 'bt-a', 'bt-s'); el.classList.add('bt-' + tabOf(el)); });
  /* les anciennes cartes d'indicateurs sont remplacées par les 6 tuiles de l'onglet */
  items.filter(el => el.matches('button.minic, .kpis')).forEach(el => el.remove());
  const rest = kids(box), cards = rest.filter(el => el.classList.contains('card') && el.style.display !== 'none');
  /* un seul graphique par onglet, choisi avec les pastilles */
  const chips = TABS.map(([k]) => {
    const L = cards.filter(el => el.classList.contains('bt-' + k));
    if (!L.length) return '';
    const cur = L.find(el => keyOf(el) === pick[k]) || L[0];
    L.forEach(el => { el.classList.add('bsel0'); el.classList.remove('shut'); el.classList.toggle('bnot', el !== cur); el.classList.toggle('bsel', el === cur); el.dataset.bk = keyOf(el); });
    return L.length > 1 ? `<div class="bchips bt-${k}" role="tablist">${L.map(el => `<button type="button" role="tab" class="chip sm${el === cur ? ' on' : ''}" aria-selected="${el === cur}" data-bp="${k}" data-bk="${keyOf(el).replace(/"/g, '&quot;')}">${labelOf(el)}</button>`).join('')}</div>` : '';
  }).join('');
  const head = barHTML() + TABS.map(([k]) => tilesHTML(k)).join('') + chips;
  if (rest[0]) rest[0].insertAdjacentHTML('beforebegin', head); else box.insertAdjacentHTML('beforeend', head);
  box.dataset.bt = tab;
};

$('dsh').addEventListener('click', e => {
  const box = $('dsh'), b = e.target.closest('[data-bt]');
  if (b && b.classList.contains('chip')) {
    tab = b.dataset.bt; LSs('bilTab', tab);
    box.dataset.bt = tab;
    box.querySelectorAll('.btabs .chip').forEach(c => { const on = c.dataset.bt === tab; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); });
    return;
  }
  const p = e.target.closest('[data-bp]');
  if (p) {
    const k = p.dataset.bp, key = p.dataset.bk;
    pick[k] = key; LSs('bilPick', pick);
    box.querySelectorAll(`.bchips.bt-${k} .chip`).forEach(c => { const on = c.dataset.bk === key; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); });
    box.querySelectorAll(`.card.bt-${k}.bsel0`).forEach(el => { const on = el.dataset.bk === key; el.classList.toggle('bsel', on); el.classList.toggle('bnot', !on); });
  }
});