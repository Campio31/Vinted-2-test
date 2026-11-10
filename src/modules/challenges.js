import { app } from '../state.js';
import { addDays, eurR, esc, ok, sold, today } from './core.js';
import { grantPack } from './cartes.js';

app.defiCardHTML = defiCardHTML;

/* ---------- défis ---------- */
/* C'est l'appli qui propose les défis, personne ne crée les siens.
   Chaque mois : 3 défis communs (les mêmes pour tout le monde, tirés d'après la date) et 3 personnels (d'après tes 3 derniers mois).
   Chaque semaine (lundi à dimanche) : 1 défi commun et 2 personnels (d'après tes 4 dernières semaines).
   Chaque défi réussi offre un pack de cartes (voir cartes.js). Les défis sont gardés dans les réglages, donc sur tous tes appareils. */
const POOL_M = { pub: 60, sold: 20, ca: 600, add: 40, colis: 20, buyers: 12, live: 10 };
const POOL_W = { pub: 15, sold: 5, ca: 150, add: 10, colis: 5, buyers: 4 };
const MIN_M = { pub: 20, sold: 6, ca: 150, add: 15, colis: 6 };
const MIN_W = { pub: 6, sold: 2, ca: 50, add: 4, colis: 2 };
const PKEYS = ['pub', 'sold', 'add', 'colis', 'ca'];

/* ---- chiffres d'une période ---- */
export function periodStats(a, b) {
  const R = app.P.filter(p => !p.ex), inR = d => ok(d) && d >= a && d <= b;
  const S = R.filter(p => sold(p) && inR(p.dv));
  return {
    pub: R.filter(p => inR(p.pub)).length,
    add: R.filter(p => inR(p.entree)).length,
    sold: S.length,
    ca: S.reduce((s, p) => s + (p.pv || 0), 0),
    colis: R.filter(p => inR(p.exp)).length,
    buyers: new Set(S.map(p => String(p.acheteur || '').toLowerCase().replace(/^@/, '')).filter(Boolean)).size,
    live: S.filter(p => p.canal === 'TikTok Live').length,
  };
}
const rangeOf = d => d.from ? [d.from, d.to] : [d.m + '-01', d.m + '-31'];
/** Avancement d'un défi (une fois terminé, le résultat final est gardé). */
export function defiProg(d) {
  if (d.end) return d.fp || 0;
  const [a, b] = rangeOf(d), s = periodStats(a, b);
  return s[d.type] || 0;
}
export const defiDone = d => !!d.done || defiProg(d) >= d.target;
export const defiTxt = d => d.type === 'ca' ? t('Atteindre {n} de chiffre d\'affaires', { n: eurR(d.target) })
  : d.type === 'pub' ? t('Publier {n} pièces', { n: d.target })
    : d.type === 'sold' ? t('Vendre {n} pièces', { n: d.target })
      : d.type === 'colis' ? t('Préparer {n} colis', { n: d.target })
        : d.type === 'buyers' ? t('Vendre à {n} acheteurs différents', { n: d.target })
          : d.type === 'live' ? t('Faire {n} ventes en Live', { n: d.target })
            : t('Ajouter {n} pièces au stock', { n: d.target });

/* ---- périodes ---- */
export const mondayOf = d => addDays(d, -((new Date(d + 'T12:00:00').getDay() + 6) % 7));
export function monthRange(m) { const [y, mo] = m.split('-').map(Number); return [m + '-01', m + '-' + String(new Date(y, mo, 0).getDate()).padStart(2, '0')]; }
const prevMonths = (m, n) => Array.from({ length: n }, (_, i) => { const d = new Date(+m.slice(0, 4), +m.slice(5) - 2 - i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });

/* ---- tirage commun, le même pour tous d'après la période ---- */
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let x = Math.imul(h ^ h >>> 15, 1 | h); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
function pick(keys, n, r) {
  const a = [...keys];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
const avgOf = ranges => {
  const t0 = { pub: 0, add: 0, sold: 0, ca: 0, colis: 0 };
  ranges.forEach(([a, b]) => { const s = periodStats(a, b); PKEYS.forEach(k => { t0[k] += s[k]; }); });
  PKEYS.forEach(k => { t0[k] /= ranges.length; });
  return t0;
};
/* défis personnels : le point fort un peu plus haut, le point faible, et (au mois) le milieu */
export function personal(scope, avg, n) {
  const MIN = scope === 'month' ? MIN_M : MIN_W, ratio = k => avg[k] / MIN[k];
  const S = [...PKEYS].sort((a, b) => ratio(b) - ratio(a)), plan = scope === 'month' ? [[S[0], 1.15], [S[4], 1.3], [S[2], 1.15]] : [[S[0], 1.15], [S[4], 1.3]];
  return plan.slice(0, n).map(([k, mult]) => { const raw = Math.max(MIN[k], Math.ceil(avg[k] * mult)); return { type: k, target: k === 'ca' ? Math.ceil(raw / 10) * 10 : raw }; });
}
export function generate(scope, now = today()) {
  const month = scope === 'month', from = month ? now.slice(0, 7) + '-01' : mondayOf(now), to = month ? monthRange(now.slice(0, 7))[1] : addDays(from, 6), key = month ? now.slice(0, 7) : from;
  const POOL = month ? POOL_M : POOL_W, r = rng((month ? 'M' : 'W') + key), out = [];
  pick(Object.keys(POOL), month ? 3 : 1, r).forEach(k => out.push({ id: scope + ':' + key + ':c:' + k, scope, src: 'common', type: k, target: POOL[k], m: from.slice(0, 7), from, to }));
  const ranges = month ? prevMonths(now.slice(0, 7), 3).map(monthRange) : [1, 2, 3, 4].map(i => [addDays(from, -7 * i), addDays(from, -7 * i + 6)]);
  personal(scope, avgOf(ranges), month ? 3 : 2).forEach(d => out.push(Object.assign({ id: scope + ':' + key + ':p:' + d.type, scope, src: 'perso', m: from.slice(0, 7), from, to }, d)));
  return out;
}

/* ---- défis en cours ---- */
export const defisOf = scope => (app.cfg.defis || []).filter(d => d.scope === scope && d.from <= today() && today() <= d.to);
export const defisNow = () => defisOf('month');
export const defisCur = () => [...defisOf('week'), ...defisOf('month')];

/** Crée les défis de la semaine et du mois s'ils n'existent pas encore, clôt ceux qui sont finis, offre les packs. */
let T = null;
export function ensureDefis() {
  if (app.importing || !app.loaded) return null;
  let D = (app.cfg.defis || []).slice(), changed = false, got = [];
  ['month', 'week'].forEach(sc => { if (!defisOf(sc).length) { generate(sc).forEach(d => { if (!D.some(x => x.id === d.id)) { D.push(d); changed = true; } }); } });
  const t0 = today();
  D = D.map(d => {
    if (d.end || d.done && d.to && d.to >= t0) return d;
    const p = defiProg(d);
    if (!d.done && p >= d.target) { changed = true; got.push(d); return Object.assign({}, d, { done: t0 }); }
    if (d.to && d.to < t0) { changed = true; return Object.assign({}, d, { end: 1, fp: p }); }
    return d;
  });
  if (changed) app.setCfg({ defis: D });
  got.forEach(d => { grantPack(d.scope === 'month' ? 'p' : 's', d.id); app.toast(t('Défi réussi : {d}', { d: defiTxt(d) }) + ' · ' + t('un pack de cartes t\'attend'), null, 6000); });
  return got;
}
export function scheduleDefis() { clearTimeout(T); T = setTimeout(() => { try { ensureDefis(); } catch (e) { /* jamais bloquant */ } }, 900); }

/* carte du Bilan : le prochain défi à finir */
function defiCardHTML() {
  const L = defisCur();
  if (!L.length) return `<button type="button" class="card minic" data-tool="defis"><span class="l">${t('défis')}</span><b>—</b><span class="mini-s">${t('Tes défis de la semaine et du mois arrivent')}</span></button>`;
  const n = L.filter(defiDone).length, d = L.find(x => !defiDone(x)) || L[0], g = defiProg(d), pc = Math.min(1, g / d.target);
  return `<button type="button" class="card minic" data-tool="defis"><span class="l">${t('défis')}</span><b>${n} <small>${t('sur {n}', { n: L.length })}</small></b><div class="rl dk"><b class="gc-${pc >= 1 ? 'g' : 'o'}" style="width:${(pc * 100).toFixed(1)}%"></b></div><span class="mini-s">${esc(defiTxt(d))} · ${d.type === 'ca' ? eurR(g) : g} / ${d.type === 'ca' ? eurR(d.target) : d.target}</span></button>`;
}
