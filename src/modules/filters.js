import { app } from '../state.js';
import { $, esc } from './core.js';
import { sheetHead } from './tools-index.js';
import { closeSheet } from './piece-sheet.js';

/* ---------- filtres communs au Stock et aux Ventes ---------- */
/* Une fenêtre « Filtres » : des groupes de choix (un seul choix par groupe, un deuxième appui l'enlève).
   Chaque changement s'applique tout de suite derrière la fenêtre ; le bouton du bas dit combien il reste de résultats. */

/** Valeurs les plus fréquentes d'un champ : [[valeur, nombre], …] */
export function facet(list, fn, max = 12) {
  const o = {};
  list.forEach(p => { const v = fn(p); if (v) o[v] = (o[v] || 0) + 1; });
  return Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max);
}

/** Nombre de filtres actifs (le tri ne compte pas). */
export const activeCount = (state, keys) => keys.filter(k => state[k]).length;

/** Texte du bouton « Filtres » */
export const filterLabel = n => t('Filtres') + (n ? ' · ' + n : '');

/** Puces des filtres actifs, chacune avec sa croix. labels: { clé: (valeur) => texte } */
export function activeChips(state, keys, labels) {
  const on = keys.filter(k => state[k]);
  return on.length ? `<div class="chips fact" style="grid-column:1/-1;margin:0 0 6px">${on.map(k => `<button type="button" class="chip sm on" data-fclr="${esc(k)}" aria-label="${esc(t('Retirer le filtre'))}">${esc(labels[k] ? labels[k](state[k]) : state[k])} ×</button>`).join('')}<button type="button" class="chip sm" data-fclr="*">${t('Tout effacer')}</button></div>` : '';
}

/**
 * Ouvre la fenêtre de filtres.
 *  title   : titre
 *  state   : objet modifié sur place
 *  groups  : () => [{ k, l, o: [[valeur, texte, nombre?]] }]  (recalculé à chaque affichage)
 *  changed : () => void   appelé après chaque changement (enregistrement + nouvel affichage de la liste)
 *  count   : () => nombre de résultats avec les filtres actuels
 *  clear   : () => void   remet tout à zéro
 */
export function openFilters({ title, state, groups, changed, count, clear }) {
  const body = () => {
    const n = count();
    return sheetHead(title) + groups().map(g => `<div class="fld fg"><span class="l">${esc(g.l)}</span><div class="chips">${g.o.map(([v, l, c]) => `<button type="button" class="chip sm${state[g.k] === v ? ' on' : ''}" data-fg="${esc(g.k)}" data-fv="${esc(v)}">${esc(l)}${c == null ? '' : ' · ' + c}</button>`).join('')}</div></div>`).join('')
      + `<div class="acts two"><button type="button" class="btn sec" id="fl_rs">${t('Tout effacer')}</button><button type="button" class="btn" id="fl_ok">${t(n > 1 ? 'Voir {n} résultats' : 'Voir {n} résultat', { n })}</button></div>`;
  };
  $('shc').onchange = null;
  $('sheet').hidden = false;
  $('shc').innerHTML = body();
  $('sheet').firstElementChild.scrollTop = 0;
  $('shc').onclick = e => {
    const b = e.target.closest('[data-fg]');
    if (b) {
      const k = b.dataset.fg, v = b.dataset.fv;
      state[k] = state[k] === v ? '' : v;
      changed();
      const sc = $('sheet').firstElementChild.scrollTop;
      $('shc').innerHTML = body();
      $('sheet').firstElementChild.scrollTop = sc;
      return;
    }
    if (e.target.closest('#fl_rs')) {
      clear(); changed();
      const sc = $('sheet').firstElementChild.scrollTop;
      $('shc').innerHTML = body();
      $('sheet').firstElementChild.scrollTop = sc;
      return;
    }
    if (e.target.closest('#fl_ok')) closeSheet();
  };
}

app.openFilters = openFilters;
