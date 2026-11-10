import { app } from '../state.js';
import { LSg, LSs, eurR, ok, profit, sold } from './core.js';
import { streakInfo } from './gamification.js';
import { grantPack, owned } from './cartes.js';

/* ---------- trophées à paliers ---------- */
/* Une catégorie = un compteur et cinq paliers : Bronze, Argent, Or, Platine, Diamant.
   Le palier se calcule à partir de ce que tu as déjà fait : rien n'est stocké (sauf le dernier palier vu, pour te féliciter une seule fois). */
export const TIERS = ['Bronze', 'Argent', 'Or', 'Platine', 'Diamant'];
const R = () => app.P.filter(p => !p.ex);
const fmt = { n: v => String(Math.round(v)), e: v => eurR(v), p: v => Math.round(v) + ' %' };
export const CATS = [
  { k: 'ventes', t: 'Ventes', d: 'Pièces vendues', th: [10, 50, 150, 500, 1500], f: 'n', v: () => R().filter(sold).length },
  { k: 'ca', t: 'Chiffre d\'affaires', d: 'Cumul des ventes', th: [1000, 5000, 15000, 50000, 150000], f: 'e', v: () => R().filter(sold).reduce((a, p) => a + (p.pv || 0), 0) },
  { k: 'benef', t: 'Bénéfice', d: 'Bénéfice net cumulé', th: [500, 2000, 7500, 25000, 75000], f: 'e', v: () => R().filter(sold).reduce((a, p) => a + profit(p), 0) },
  { k: 'pubs', t: 'Publications', d: 'Pièces publiées', th: [25, 100, 400, 1200, 3000], f: 'n', v: () => R().filter(p => ok(p.pub)).length },
  { k: 'serie', t: 'Série', d: 'Meilleure série de publication (jours)', th: [7, 14, 30, 60, 120], f: 'n', v: () => streakInfo().best },
  { k: 'colis', t: 'Colis', d: 'Colis préparés', th: [10, 50, 200, 600, 1500], f: 'n', v: () => R().filter(p => ok(p.exp)).length },
  { k: 'acheteurs', t: 'Acheteurs', d: 'Acheteurs différents', th: [10, 40, 120, 400, 1000], f: 'n', v: () => new Set(R().filter(sold).map(p => String(p.acheteur || '').toLowerCase().replace(/^@/, '')).filter(Boolean)).size },
  { k: 'ecoul', t: 'Écoulement', d: 'Part de tes pièces vendues (à partir de 20 pièces)', th: [30, 45, 60, 75, 90], f: 'p', v: () => { const a = R(); return a.length >= 20 ? a.filter(sold).length / a.length * 100 : 0; } },
  { k: 'defis', t: 'Défis', d: 'Défis réussis', th: [3, 10, 25, 60, 150], f: 'n', v: () => (app.cfg.defis || []).filter(d => d.done).length },
  { k: 'cartes', t: 'Collection', d: 'Cartes différentes', th: [5, 12, 22, 32, 43], f: 'n', v: () => owned() },
];

export function trophyData() {
  return CATS.map(c => {
    const v = c.v(), tier = c.th.filter(x => v >= x).length, next = c.th[tier] ?? null, prev = tier ? c.th[tier - 1] : 0;
    return Object.assign({}, c, { val: v, tier, next, pct: next ? Math.min(1, (v - prev) / (next - prev)) : 1, show: fmt[c.f] });
  });
}
export const trophyTiers = () => trophyData().reduce((a, c) => a + c.tier, 0);
app.trophyTiers = trophyTiers;

/** Félicite quand un palier est atteint (jamais au premier calcul) et offre un pack premium par palier. */
export function checkTrophies() {
  if (app.importing || !app.loaded || !app.P.length) return;
  const cur = Object.fromEntries(trophyData().map(c => [c.k, c.tier])), seen = LSg('trophSeen', null);
  if (seen === null) { LSs('trophSeen', cur); return; }
  const up = Object.keys(cur).filter(k => cur[k] > (seen[k] || 0));
  if (!up.length) return;
  LSs('trophSeen', cur);
  up.forEach(k => { for (let i = (seen[k] || 0) + 1; i <= cur[k]; i++) grantPack(i >= 4 ? 'a' : 'p', 't:' + k + ':' + i); });
  const c = CATS.find(x => x.k === up[0]);
  app.toast(t('Trophée {n} : {c}', { n: t(TIERS[cur[up[0]] - 1]), c: t(c.t) }) + ' · ' + t('un pack premium t\'attend'), null, 6000);
}
