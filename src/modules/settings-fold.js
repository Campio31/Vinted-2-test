import { app } from '../state.js';
import { $, LSg, LSs } from './core.js';

/* ---------- Réglages : chaque carte se replie, sauf celles du compte ---------- */
/* Une seule carte reste ouverte : en ouvrir une referme la précédente.
   Toutes les cartes de préférences, de données et d'aide sont repliées au départ ; on ouvre celle dont on a besoin.
   Les cartes sont réécrites par leur module à chaque affichage : un observateur remet le pli sur le titre. */
const FOLD = ['lgc', 'thc', 'cfgc', 'cptc', 'rlc', 'cfc', 'bkc', 'trc', 'inst', 'xic', 'hlp', 'abo'];
let open = LSg('setOpen', []);
open = Array.isArray(open) ? open.slice(0, 1) : [];

function apply() {
  FOLD.forEach(id => {
    const c = $(id); if (!c) return;
    const h = [...c.children].find(el => el.tagName === 'H3'); if (!h) return;
    c.classList.add('cs', 'sfold');
    h.classList.add('hd');
    h.dataset.sec = id;
    h.setAttribute('role', 'button');
    h.tabIndex = 0;
    const shut = !open.includes(id);
    c.classList.toggle('shut', shut);
    h.setAttribute('aria-expanded', String(!shut));
  });
}

function toggle(id) {
  open = open.includes(id) ? [] : [id];          /* une seule carte ouverte à la fois : ouvrir l'une ferme l'autre */
  LSs('setOpen', open);
  apply();
}

/** Ouvre une carte des Réglages (pour les liens qui y renvoient). */
app.openSetCard = id => { if (!open.includes(id)) { open = [id]; LSs('setOpen', open); apply(); } };

const host = $('v-set');
host.addEventListener('click', e => {
  const h = e.target.closest('h3[data-sec]');
  if (h && host.contains(h) && h.parentNode.classList.contains('sfold')) toggle(h.dataset.sec);
});
host.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const h = e.target.closest && e.target.closest('h3[data-sec]');
  if (h && h === e.target && h.parentNode.classList.contains('sfold')) { e.preventDefault(); toggle(h.dataset.sec); }
});
new MutationObserver(apply).observe(host, { childList: true, subtree: true });
apply();
