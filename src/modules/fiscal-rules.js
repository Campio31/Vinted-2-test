import { app } from '../state.js';
import { CFG0 } from './settings-core.js';
import { addDays, today } from './core.js';

/* ---------- règles fiscales, réglées par un questionnaire ---------- */
/* L'utilisateur ne tape aucun chiffre : il répond à des questions (Ligne fiscale, Refaire le questionnaire) et Max en déduit
   le plafond, le seuil de TVA, le taux de cotisations, le versement libératoire et la période de déclaration.
   Les chiffres ci-dessous sont ceux de la vente de marchandises en micro-entreprise pour 2026 : à vérifier chaque année sur autoentrepreneur.urssaf.fr. */
export const RULES = {
  year: 2026,
  plafond: 203100,       /* plafond de chiffre d'affaires, vente de marchandises (2026-2028) */
  tva: 85000,            /* franchise en base de TVA, vente de marchandises */
  taux: 12.3,            /* cotisations sociales, vente de marchandises */
  vl: 1,                 /* versement libératoire de l'impôt, vente de marchandises (en plus des cotisations) */
  abat: 71,              /* abattement forfaitaire pour le calcul de l'impôt sur le revenu */
  acreDepuis: '2025-07-01', acreAvant: 0.5, acreApres: 0.75, /* part des cotisations payée avec l'ACRE */
  dac7Ventes: 30, dac7Ca: 2000, /* seuils de déclaration automatique des plateformes (vendeurs particuliers) */
};
Object.assign(CFG0, { fiscQ: null, vl: 0, abat: RULES.abat });

/** Réglages déduits des réponses. Sans réponse, les valeurs par défaut de la vente de marchandises. */
export function deriveFisc(a) {
  a = a || {};
  const o = { fiscOn: false, plafond: 0, plafondTva: 0, tauxSoc: 0, vl: 0, abat: RULES.abat, periode: 'M', acreOn: false };
  if (a.statut !== 'micro') return o;
  o.fiscOn = true;
  o.plafond = RULES.plafond;
  o.plafondTva = a.tva === 'assujetti' ? 0 : RULES.tva;
  o.tauxSoc = RULES.taux;
  const encore = a.creation && a.creation >= addDays(today(), -365);
  if (a.acre === 'oui' && encore) { o.tauxSoc = Math.round(RULES.taux * (a.creation >= RULES.acreDepuis ? RULES.acreApres : RULES.acreAvant) * 100) / 100; o.acreOn = true; }
  if (a.vl === 'liberatoire') o.vl = RULES.vl;
  o.periode = a.periode === 'T' ? 'T' : 'M';
  return o;
}
/** Plafond ou seuil de l'année : réduit au prorata la première année d'activité. */
export function prorata(v, y) {
  const c = (app.cfg.fiscQ || {}).creation;
  if (!v || !c || +c.slice(0, 4) !== y) return v;
  const fin = new Date(y, 11, 31), d0 = new Date(c + 'T12:00:00'), n = Math.round((fin - d0) / 864e5) + 1;
  return Math.round(v * Math.min(1, n / 365));
}
/** Met les réglages à jour d'après les réponses (appelé à l'ouverture et à la fin du questionnaire). */
export function syncFisc() {
  if (!app.cfg.fiscQ) return false;
  const d = deriveFisc(app.cfg.fiscQ), p = {};
  ['plafond', 'plafondTva', 'tauxSoc', 'vl', 'abat', 'periode'].forEach(k => { if (app.cfg[k] !== d[k]) p[k] = d[k]; });
  if (app.cfg.finJours !== 21) p.finJours = 21;
  if (Object.keys(p).length) app.setCfg(p);
  return true;
}
export const fiscMode = () => (app.cfg.fiscQ || {}).statut || '';

/** Étapes du questionnaire fiscal. */
export function fiscSteps() {
  return [
    { k: 'statut', q: 'Tu vends en tant que…', h: 'Ça détermine les règles qui s\'appliquent à tes ventes.', type: 'choice', o: [['part', 'Particulier', 'Je vends mes affaires, sans statut d\'entreprise'], ['micro', 'Micro-entrepreneur', 'Auto-entrepreneur déclaré à l\'URSSAF'], ['autre', 'Autre statut', 'Société, entreprise individuelle au réel…']] },
    { k: 'activite', q: 'Quelle est ton activité ?', h: 'Le plafond et les cotisations dépendent de l\'activité.', type: 'choice', show: a => a.statut === 'micro', o: [['march', 'Vente de marchandises', 'Je revends des pièces : le cas de Max'], ['mixte', 'Vente et prestations', 'Je vends aussi des services (Max ne suit que les ventes de pièces)']] },
    { k: 'creation', q: 'Quand as-tu créé ton activité ?', h: 'La première année, le plafond est réduit au prorata des jours. Sert aussi pour l\'ACRE.', type: 'date', show: a => a.statut === 'micro', need: a => !!a.creation, needMsg: 'Indique la date de création' },
    { k: 'acre', q: 'Bénéficies-tu de l\'ACRE ?', h: 'Réduction de cotisations la première année.', type: 'choice', show: a => a.statut === 'micro' && !!a.creation && a.creation >= addDays(today(), -365), o: [['oui', 'Oui', 'Mes cotisations sont réduites'], ['non', 'Non', '']] },
    { k: 'vl', q: 'Comment paies-tu l\'impôt sur le revenu ?', h: 'Le versement libératoire se paie avec les cotisations, en plus.', type: 'choice', show: a => a.statut === 'micro', o: [['bareme', 'Avec ma déclaration de revenus', 'Le cas général'], ['liberatoire', 'Versement libératoire', 'Un petit pourcentage du chiffre d\'affaires en plus des cotisations'], ['nsp', 'Je ne sais pas', 'On compte le cas général']] },
    { k: 'tva', q: 'Factures-tu la TVA ?', h: 'La plupart des micro-entrepreneurs sont en franchise en base.', type: 'choice', show: a => a.statut === 'micro', o: [['franchise', 'Non, franchise en base de TVA', 'Le cas général'], ['assujetti', 'Oui, je facture la TVA', ''], ['nsp', 'Je ne sais pas', 'On compte la franchise en base']] },
    { k: 'periode', q: 'Tu déclares…', h: 'La fréquence choisie auprès de l\'URSSAF.', type: 'choice', show: a => a.statut === 'micro', o: [['M', 'Chaque mois', ''], ['T', 'Chaque trimestre', '']] },
  ];
}
