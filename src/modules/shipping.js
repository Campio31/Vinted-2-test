import { app } from '../state.js';
import { CFG0 } from './settings-core.js';

/* ---------- frais de port réels : un barème par transporteur et par poids ---------- */
/* Chaque pièce a un poids (classe de colis : 0,5 · 1 · 2 · 5 · 10 kg). Avec « Utiliser le barème » activé, les frais préremplis
   (marge, prix conseillé, vente) comptent le vrai prix d'envoi de ce poids chez le transporteur choisi, au lieu d'un montant fixe.
   Les prix ci-dessous sont des ESTIMATIONS de départ : ils changent, vérifie-les et corrige-les dans Réglages, Objectifs et coûts. */
export const CARRIERS = [
  ['mr', 'Mondial Relay', [[0.5, 3.5], [1, 4.5], [2, 5.5], [5, 7.5], [10, 10.5]]],
  ['col', 'Colissimo', [[0.5, 5.9], [1, 7], [2, 8.2], [5, 11], [10, 15]]],
  ['vgo', 'Vinted Go', [[0.5, 3], [1, 3.8], [2, 4.8], [5, 6.5], [10, 9]]],
];
export const TIERS = [0.5, 1, 2, 5, 10];
Object.assign(CFG0, { shipOn: false, shipCar: 'mr', shipT: {} });

const carrier = id => CARRIERS.find(c => c[0] === id) || CARRIERS[0];
/** Barème d'un transporteur : [[kg, prix]] avec les prix corrigés dans les Réglages. */
export function tableOf(id) {
  const c = carrier(id), o = (app.cfg.shipT || {})[c[0]] || {};
  return c[2].map(([kg, pr]) => { const v = o[kg]; return [kg, v !== undefined && v !== '' && v !== null && isFinite(+v) && +v >= 0 ? +v : pr]; });
}
/** Prix d'envoi pour un poids (la classe de colis égale ou juste au-dessus). */
export function shipPrice(kg, car) {
  const T = tableOf(car || app.cfg.shipCar), r = T.find(([k]) => kg <= k) || T[T.length - 1];
  return r[1];
}
/* poids proposé d'après la catégorie, quand la pièce n'en a pas encore */
export const WEIGHT0 = { Tshirt: 0.5, Polo: 0.5, Maillot: 0.5, Chemise: 0.5, Short: 0.5, RobeJupe: 1, Sweat: 1, Pantalon: 1, Veste: 2, Autres: 1 };
export const weightOf = p => (p && isFinite(+p.poids) && +p.poids > 0 ? +p.poids : (p && WEIGHT0[p.cat]) || 0);
export const shipFor = p => { const kg = weightOf(p); return kg ? shipPrice(kg) : 0; };
export const carrierName = id => carrier(id)[1];
app.shipFor = shipFor;
app.weightOf = weightOf;
