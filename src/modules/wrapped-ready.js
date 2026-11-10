import { app } from '../state.js';
import { $, LSg, LSs, ok, pad, sold } from './core.js';
import { showCb } from './coach.js';
import { openWrapped, perLabel } from './wrapped.js';

/* ---------- Wrapped prêt : bandeau, rappel du jour, notification ---------- */
/* Pendant les 7 premiers jours d'un mois, le Wrapped du mois écoulé est annoncé (celui de l'année en janvier), s'il y a eu des ventes.
   L'annonce disparaît dès que tu as ouvert ce Wrapped ou fermé le bandeau. Les pièces d'exemple ne comptent pas. */
export function wrappedDue() {
  const d = new Date();
  if (d.getDate() > 7) return null;
  const per = d.getMonth() === 0 ? String(d.getFullYear() - 1) : (() => { const p = new Date(d.getFullYear(), d.getMonth() - 1, 1); return p.getFullYear() + '-' + pad(p.getMonth() + 1, 2); })();
  if (!app.P.some(p => !p.ex && sold(p) && ok(p.dv) && p.dv.startsWith(per))) return null;
  return LSg('wrSeen', []).includes(per) ? null : per;
}
const msg = per => t('Ton Wrapped {l} est prêt', { l: per.length > 4 ? t('de {m}', { m: perLabel(per) }) : t('de {y}', { y: per }) });
const markSeen = per => { const s = LSg('wrSeen', []); if (!s.includes(per)) LSs('wrSeen', [...s, per].slice(-30)); };

/* carte « Rappels du jour » et notification locale */
const rappelsList0 = app.rappelsList;
app.rappelsList = function () {
  const R = rappelsList0();
  try { const per = wrappedDue(); if (per) R.push({ k: 'wrapped:' + per, tone: 'g', txt: msg(per), tool: 'wrapped' }); } catch (e) { /* le rappel ne doit jamais gêner */ }
  return R;
};
/* notification appli fermée : le 1er jour du mois à 10 h (voir pushItems dans reminders.js) */
app.pushExtra = (app.pushExtra || []).concat([(at, add) => { const per = wrappedDue(); if (per) add('wrapped:' + per, at(0, 10, 0), msg(per)); }]);

let bannerPer = null;
export function checkWrappedBanner() {
  const per = wrappedDue();
  if (!per || !app.loaded || !$('cb').hidden) return;
  bannerPer = per;
  showCb(msg(per), t('Voir'), () => { $('cb').hidden = true; markSeen(per); bannerPer = null; openWrapped(per); });
}
$('cb_x').addEventListener('click', () => { if (bannerPer) { markSeen(bannerPer); bannerPer = null; } });
app.checkWrappedBanner = checkWrappedBanner;
