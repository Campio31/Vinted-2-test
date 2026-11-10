import { app } from '../state.js';
import { $ } from './core.js';
import { go } from './nav.js';

/* ---------- bouton Retour du téléphone ---------- */
/* Une fenêtre ouverte ou un changement d'onglet ajoute une entrée à l'historique du navigateur :
   Retour ferme la fenêtre, ou revient à l'onglet précédent, au lieu de quitter l'appli.
   Au premier écran sans fenêtre, Retour quitte l'appli comme d'habitude. */
let quiet = false;   // navigation provoquée par Retour : on n'empile pas
let selfBack = 0;    // retours que nous déclenchons nous-mêmes (fermeture d'une fenêtre) : à ignorer
const kind = () => history.state && history.state.max;

history.replaceState({ max: 'view', v: app.view || 'add' }, '');

app.onView = v => {
  if (quiet) return;
  if (kind() === 'view' && history.state.v === v) return;
  /* la redirection de démarrage (mode simple, accueil) ne doit pas créer une étape de retour */
  if (performance.now() < (app.histBootMs ?? 4000)) history.replaceState({ max: 'view', v }, '');
  else history.pushState({ max: 'view', v }, '');
};

new MutationObserver(() => {
  if (!$('sheet').hidden) { if (kind() !== 'sheet') history.pushState({ max: 'sheet' }, ''); }
  else if (kind() === 'sheet') { selfBack++; history.back(); }
}).observe($('sheet'), { attributes: true, attributeFilter: ['hidden'] });

addEventListener('popstate', () => {
  if (selfBack > 0) { selfBack--; return; }
  const s = history.state;
  if (!$('sheet').hidden) { $('sheet').hidden = true; return; }
  if (s && s.max === 'sheet') { selfBack++; history.back(); return; }   // entrée de fenêtre restée dans l'historique
  if (s && s.max === 'view' && s.v && s.v !== app.view) { quiet = true; try { go(s.v); } finally { quiet = false; } }
});
