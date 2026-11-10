import { app } from '../state.js';
import { $ } from './core.js';
import { TI, sheetHead, showSheet } from './tools-index.js';

app.openFiches = openFiches;

/* ---------- Compléter et nettoyer les fiches : deux outils réunis en un ---------- */
const CHOIX = [
  ['complete', 'Compléter les fiches', 'Fiches sans grade, état ou code, 10 à la suite', '<path d="M5 12l4.5 4.5L19 7"/>'],
  ['merge', 'Nettoyer les doublons', 'Fusionne Aucun et Aucune, Brooks Brother et Brooks Brothers', '<path d="M6 4v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v3M6 20v-3M18 4v5"/>'],
];
export function openFiches() {
  showSheet(sheetHead(t('Compléter et nettoyer les fiches')) + `<div class="tools">${CHOIX.map(([k, l, d, i]) => `<button type="button" class="tool" data-fx="${k}"><span class="tic">${TI(i)}</span><span class="tx"><b>${t(l)}</b><small>${t(d)}</small></span></button>`).join('')}</div>`);
  $('shc').onclick = e => {
    const b = e.target.closest('[data-fx]'); if (!b) return;
    if (b.dataset.fx === 'complete') app.openComplete(); else app.openMerge();
  };
}