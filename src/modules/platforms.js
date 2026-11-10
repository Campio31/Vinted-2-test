import { app } from '../state.js';

/* ---------- plateformes de vente : deux noms au choix ---------- */
/* Les ventes gardent en interne les valeurs « Vinted » (plateforme 1) et « TikTok Live » (plateforme 2), pour ne rien changer aux données.
   Chaque utilisateur peut donner à ces deux plateformes le nom qu'il veut dans Réglages : l'affichage suit partout (listes, bilans, PDF).
   Sans nom choisi, les noms d'origine restent affichés. */
export const DEFAULTS = { 1: 'Vinted', 2: 'TikTok Live' };
const KEYS = { 1: 'Vinted', 2: 'TikTok Live' };
export const pfName = i => String(app.cfg['pf' + i] || '').trim() || DEFAULTS[i];
/* valeur interne -> nom affiché (les autres valeurs, comme « Autre », ne changent pas) */
export const pfShow = v => (v === KEYS[1] ? pfName(1) : v === KEYS[2] ? pfName(2) : v);
/* texte saisi -> valeur interne : le nom d'une des deux plateformes redevient sa valeur interne */
export const pfKey = txt => {
  const s = String(txt || '').trim(), l = s.toLowerCase();
  if (l && l === pfName(1).toLowerCase()) return KEYS[1];
  if (l && l === pfName(2).toLowerCase()) return KEYS[2];
  return s;
};
app.pfName = pfName;
app.pfShow = pfShow;
app.pfKey = pfKey;

/* tv() traduit les valeurs affichées (canal, catégorie…) : on y branche les noms de plateformes */
const tv0 = globalThis.tv;
const tvPf = function (v) { return v === KEYS[1] || v === KEYS[2] ? pfShow(v) : tv0.apply(this, arguments); };
globalThis.tv = tvPf;
if (typeof window !== 'undefined' && window !== globalThis) window.tv = tvPf;
