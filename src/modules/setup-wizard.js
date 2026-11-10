import { app } from '../state.js';
import { $, esc } from './core.js';
import { go } from './nav.js';
import { CFG0 } from './settings-core.js';
import { sheetHead, showSheet } from './tools-index.js';
import { openSeuilQ } from './analytics.js';
import { openFournQ } from './supplies-planning.js';

Object.assign(CFG0, { setupDone: false });
app.openSetup = openSetup;

/* ---------- premier lancement : les questionnaires qui servent aux indicateurs ---------- */
/* Une fenêtre liste ce qu'il faut renseigner (objectifs, frais fixes, fournitures, trésorerie) : chaque ligne ouvre
   son questionnaire et se coche quand c'est fait. Elle s'ouvre toute seule une fois, à la fin de l'accueil, puis reste dans Outils. */
const hasCash = () => app.cfg.cash !== null && app.cfg.cash !== undefined && app.cfg.cash !== '';
export const SETUP = [
  ['goal', 'Objectifs', 'Ton objectif du mois, en bénéfice ou en chiffre d\'affaires', () => (+app.cfg.goal > 0 || +app.cfg.goalCA > 0), () => { go('set'); setTimeout(() => app.openSetCard && app.openSetCard('cfgc'), 60); }],
  ['seuil', 'Seuil de rentabilité', 'Tes frais fixes du mois, pour savoir combien de ventes les couvrent', () => !!app.cfg.seuilQ, () => openSeuilQ()],
  ['fourn', 'Fournitures', 'Sachets, cartons, scotch : le coût réel d\'un colis', () => !!app.cfg.fournQ, () => openFournQ()],
  ['treso', 'Trésorerie', 'Ton solde actuel, pour la prévision à 15 et 30 jours', hasCash, () => app.openTreso()],
];
export function openSetup() {
  if (!app.cfg.setupDone) app.setCfg({ setupDone: true }, true);
  const n = SETUP.filter(s => s[3]()).length;
  showSheet(sheetHead(t('Configure tes indicateurs')) + `<p class="sub">${t('Quelques questions pour que le Bilan soit juste. Chaque ligne ouvre son questionnaire, tu peux les faire plus tard depuis Outils.')}</p>
   <div class="tools">${SETUP.map(([k, l, d, done]) => `<button type="button" class="tool${done() ? ' su-ok' : ''}" data-su="${k}"><span class="tic su-c">${done() ? '✓' : '·'}</span><span class="tx"><b>${t(l)}</b><small>${t(d)}</small></span></button>`).join('')}</div>
   <div class="hint">${esc(t('{a} sur {b} faits', { a: n, b: SETUP.length }))}</div>
   <div class="acts"><button type="button" class="btn" id="su_ok">${t('Terminer')}</button></div>`);
  $('su_ok').onclick = () => { $('sheet').hidden = true; };
  $('shc').onclick = e => { const b = e.target.closest('[data-su]'); if (b) SETUP.find(s => s[0] === b.dataset.su)[4](); };
}