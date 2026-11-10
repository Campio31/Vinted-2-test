import { app } from '../state.js';
import { addDays, ok, sold, today } from './core.js';

/* ---------- ventes finalisées ---------- */
/* Pour l'URSSAF, une vente compte quand elle est finalisée (l'argent est reçu), pas le jour où elle est faite.
   - Tu peux la finaliser toi-même (champ `fin` = date), par exemple quand Vinted libère l'argent.
   - Sans action de ta part, elle est finalisée automatiquement `finJours` jours après la date de vente (21 par défaut).
   - Une vente en main propre (canal « Autre ») est finalisée le jour même.
   - Les ventes faites avant FIN_START gardent leur date de vente, pour ne pas bouger les mois déjà déclarés. */
export const FIN_START = '2026-10-31';
export const FIN_JOURS = 21;

export function finJours() {
  const n = app.cfg.finJours;
  return n === undefined || n === '' || n === null || !isFinite(+n) || +n < 0 ? FIN_JOURS : Math.round(+n);
}

/** Date de finalisation d'une vente (réelle ou prévue), ou null si ce n'est pas une vente datée. */
export function finDate(p) {
  if (!p || !sold(p) || !ok(p.dv)) return null;
  if (ok(p.fin)) return p.fin;
  if (p.dv < FIN_START || p.canal === 'Autre') return p.dv;
  return addDays(p.dv, finJours());
}
export const finManual = p => !!p && ok(p.fin);
export const isFinal = (p, now = today()) => { const d = finDate(p); return !!d && d <= now; };
/* ventes pas encore finalisées, seulement celles qui comptent pour la déclaration (un compte non pris en compte n'a rien à finaliser) */
export const pendingSales = (now = today()) => app.P.filter(p => { const d = finDate(p); return d && d > now && (!app.countsForFisc || app.countsForFisc(p)); });

app.finDate = finDate;
app.isFinal = isFinal;
app.pendingSales = pendingSales;
app.finalize = list => {
  const old = list.map(p => Object.assign({}, p)), d = today();
  list.forEach(p => app.save(Object.assign({}, p, { fin: d })));
  return old;
};
