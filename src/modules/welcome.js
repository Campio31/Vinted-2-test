import { app } from '../state.js';
import { $, LSg, LSs, today } from './core.js';
import { go } from './nav.js';

/* ---------- accueil : 3 questions pour personnaliser Max ---------- */
/* Proposé une seule fois, à un compte sans pièce. Les réponses sont gardées dans les réglages (donc sur tous les appareils)
   et servent à choisir les 8 outils du mode simple et un objectif de départ. */
const STEPS = [
  { k: 'statut', q: 'Tu vends en tant que…', h: 'Ça sert à te montrer les bons outils (impôts, plafonds).', o: [
    ['part', 'Particulier', 'Je vide mon dressing ou je fais quelques ventes'],
    ['micro', 'Micro-entrepreneur', 'Auto-entrepreneur déclaré'],
    ['pro', 'Autre statut professionnel', 'Société, EI, etc.'],
  ] },
  { k: 'canal', q: 'Où vends-tu surtout ?', h: 'Tu pourras vendre partout, c\'est juste pour commencer.', o: [
    ['vinted', 'Vinted', 'Annonces et ventes à distance'],
    ['live', 'TikTok Live', 'Ventes en direct'],
    ['both', 'Les deux', 'Vinted et lives'],
    ['autre', 'Ailleurs', 'Leboncoin, vide-greniers, Instagram…'],
  ] },
  { k: 'obj', q: 'Quel est ton objectif ?', h: 'Max s\'en sert pour te dire si tu es en avance ou en retard. Modifiable dans Réglages.', o: [
    ['poche', 'De l\'argent de poche', 'Environ 100 € de bénéfice par mois'],
    ['comp', 'Un complément de revenu', 'Environ 500 € de bénéfice par mois'],
    ['vivre', 'En vivre', 'Environ 2 000 € de bénéfice par mois'],
  ] },
];
const GOALS = { poche: 100, comp: 500, vivre: 2000 };

let step = 0;
let ans = {};
let wantEx = true;
let open = false;

const ov = () => $('welcome');

function draw() {
  const s = STEPS[step], last = step === STEPS.length - 1;
  ov().innerHTML = `<div class="wbox">
    <div class="wst">${step ? '' : t('Bienvenue sur Max') + ' · '}${t('Question {i} sur {n}', { i: step + 1, n: STEPS.length })}</div>
    <div class="wbar">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <h2 id="wq">${t(s.q)}</h2><p class="sub">${t(s.h)}</p>
    ${s.o.map(([v, l, d]) => `<button type="button" class="wopt${ans[s.k] === v ? ' on' : ''}" data-wo="${v}"><b>${t(l)}</b><small>${t(d)}</small></button>`).join('')}
    ${last ? `<label class="chk" style="margin:6px 0 14px"><input type="checkbox" id="w_ex"${wantEx ? ' checked' : ''}><span>${t('Charger quelques pièces d\'exemple pour essayer (tu les supprimes en un clic)')}</span></label>
      <button type="button" class="btn" data-wgo="1"${ans[s.k] ? '' : ' disabled'}>${t('Commencer')}</button>` : ''}
    <div class="wfoot"><button type="button" class="wlnk" data-wback="1"${step ? '' : ' hidden'}>${t('Retour')}</button><button type="button" class="wlnk" data-wskip="1">${t('Passer')}</button></div>
  </div>`;
  ov().scrollTop = 0;
}

function close() {
  open = false;
  ov().hidden = true;
}

function finish(skip) {
  const p = { onb: skip ? { skipped: 1, d: today() } : Object.assign({ d: today() }, ans), mode: 'simple' };
  if (!skip && !(+app.cfg.goal) && GOALS[ans.obj]) p.goal = GOALS[ans.obj];
  app.setCfg(p, true);
  LSs('welcomed', 1);
  close();
  if (!skip && wantEx && !app.P.length) app.loadExamples();
  go('dash');
  /* premier lancement : les questionnaires des indicateurs s'ouvrent une fois */
  if (!app.cfg.setupDone) setTimeout(() => { if (!app.cfg.setupDone && app.openSetup) app.openSetup(); }, 500);
}

export function openWelcome() {
  step = 0; ans = Object.assign({}, (app.cfg.onb && !app.cfg.onb.skipped) ? app.cfg.onb : {}); wantEx = !app.P.length; open = true;
  ov().hidden = false;
  draw();
}
app.openWelcome = openWelcome;

document.body.insertAdjacentHTML('beforeend', '<div id="welcome" role="dialog" aria-modal="true" aria-labelledby="wq" hidden></div>');
ov().addEventListener('click', e => {
  const o = e.target.closest('[data-wo]');
  if (o) { ans[STEPS[step].k] = o.dataset.wo; if (step < STEPS.length - 1) { step++; } draw(); return; }
  if (e.target.closest('[data-wback]')) { step = Math.max(0, step - 1); return draw(); }
  if (e.target.closest('[data-wskip]')) return finish(true);
  if (e.target.closest('[data-wgo]')) finish(false);
});
ov().addEventListener('change', e => { if (e.target.id === 'w_ex') wantEx = e.target.checked; });

/* Quand l'afficher : compte sans pièce, jamais présenté, connecté si la synchronisation est active.
   On attend un peu après la connexion pour laisser arriver les réglages et le stock d'un autre appareil. */
let since = 0;
const tick = setInterval(() => {
  if (open) return;
  if (!app.loaded) return;
  if (app.cfg.onb || LSg('welcomed', false) || app.P.length) { if (app.P.length || app.cfg.onb) LSs('welcomed', 1); return clearInterval(tick); }
  if (app.cloud && !app.user) { since = 0; return; }
  if (!since) since = Date.now();
  if (app.cloud && Date.now() - since < 3000) return;
  if ($('auth') && !$('auth').hidden) return;
  openWelcome();
}, 1000);
