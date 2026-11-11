import { app } from '../state.js';
import { $, LSg, LSs, esc } from './core.js';
import { go } from './nav.js';
import { TOOLS, TI, sheetHead, showSheet } from './tools-index.js';

/* ---------- Tutoriel : des chapitres à lire et une visite guidée sur les vrais écrans ---------- */
/* Le tutoriel se reprend à tout moment : la position (chapitre et étape) est gardée, les chapitres vus sont cochés.
   Il s'ouvre depuis Outils, Tutoriel, et une fois à la fin de l'accueil. */
const wide = () => window.matchMedia && window.matchMedia('(min-width:900px)').matches;
const tick = ms => new Promise(r => setTimeout(r, ms));
const crmOn = on => () => { if (app.setStockMode) app.setStockMode(on ? 'crm' : 'stock'); };

/** Les chapitres (calculés à l'appel : la langue peut changer). Une étape : { view, sel, t, x, pre, when }. */
export function chapters() {
  const ess = (app.essentials ? app.essentials() : []).map(k => TOOLS.concat(app.toolsView ? app.toolsView().list : []).find(x => x.k === k)).filter(Boolean);
  return [
    { id: 'add', n: t('Ajouter un article'), d: t('Les 4 étapes pour enregistrer une pièce en moins d\'une minute'), steps: [
      { view: 'add', sel: '#fadd .steps', t: t('Les 4 étapes'), x: t('Article, Caractéristiques, État, puis Achat et gestion. Touche une étape pour y aller : la barre montre où tu en es.') },
      { view: 'add', sel: '#fadd .grp.open', t: t('Un paramètre à la fois'), x: t('Choisis une valeur et le paramètre suivant s\'ouvre tout seul. « Passer » saute ce que tu ne connais pas.') },
      { view: 'add', sel: '#fprev', when: wide, t: t('La fiche se construit ici'), x: t('Sur ordinateur, la fiche de l\'article se remplit à droite pendant que tu saisis.') },
      { view: 'add', sel: '#pot', t: t('Le potentiel de vente'), x: t('Avec tes ventes passées, Syno estime si la pièce partira vite et propose un prix de vente conseillé.') },
      { view: 'add', sel: '#cdp', t: t('Le code article'), x: t('Chaque pièce reçoit un code unique du type 2611-K7QF : écris-le sur l\'étiquette pour la retrouver.') },
      { view: 'add', sel: '#fok', t: t('Enregistrer'), x: t('« Ajouter » met la pièce en stock. « Ajouter et dupliquer » garde les champs pour une pièce presque identique.') },
    ] },
    { id: 'stock', n: t('Gérer le stock'), d: t('Retrouver, filtrer, publier et suivre tes pièces'), steps: [
      { view: 'list', pre: crmOn(false), sel: '#q', t: t('Chercher une pièce'), x: t('Tape une marque, un type, un code ou une taille : la liste se filtre à mesure.') },
      { view: 'list', pre: crmOn(false), sel: '#flt', t: t('Filtres et sélection'), x: t('« Filtres » trie par statut, catégorie, marque, bac, compte… « Sélection » permet d\'agir sur plusieurs pièces à la fois (bac, compte, prix).') },
      { view: 'list', pre: crmOn(false), sel: '#lst .tl', t: t('Une carte, une pièce'), x: t('Le contour prend la couleur du grade : vert A, jaune B, rouge C. Touche la photo pour ouvrir la fiche.') },
      { view: 'list', pre: crmOn(false), sel: '#lst .tl .vb', t: t('Publié et Vendu'), x: t('« Publié » enregistre la mise en ligne, « Vendu » ouvre la vente (prix, acheteur, frais). Glisse une carte : à droite pour vendre, à gauche pour marquer publiée.') },
      { view: 'list', pre: crmOn(false), sel: '#smode', t: t('Deux vues du stock'), x: t('Passe de « Stock » (la liste) à « CRM » (le suivi de tes pièces et de tes acheteurs, en test).') },
      { view: 'list', pre: crmOn(true), sel: '#crm .cxks', t: t('Tes priorités du jour'), x: t('Offres en cours, colis à expédier, acheteurs à relancer, annonces dormantes : ce qu\'il faut traiter aujourd\'hui.') },
      { view: 'list', pre: crmOn(true), sel: '#crm .cxp', t: t('Le pipeline'), x: t('Chaque colonne est une étape : à publier, en ligne, offre reçue, à expédier, expédié, finalisé. Touche « ⋯ » sur une carte pour la faire avancer ; sur ordinateur, glisse-la.') },
      { view: 'list', pre: crmOn(true), sel: '#crm .chips', t: t('Acheteurs et activité'), x: t('L\'onglet Acheteurs donne une fiche par pseudo (achats, note, relance). Activité montre les derniers événements de ton stock.') },
    ] },
    { id: 'vente', n: t('Vendre et expédier'), d: t('Suivre tes ventes de la commande à l\'argent reçu'), steps: [
      { view: 'sales', sel: '#ssum', t: t('Tes ventes'), x: t('Quatre tuiles : nombre de ventes, encaissé, bénéfice et marge, avec une flèche par rapport à la période d\'avant.') },
      { view: 'sales', sel: '#sflt', t: t('Filtres des ventes'), x: t('Choisis une période, une plateforme, un compte ou un statut (à finaliser…).') },
      { view: 'sales', sel: '#slst .li', t: t('Une vente'), x: t('Touche une vente pour voir le bénéfice, la modifier, enregistrer un retour ou la marquer finalisée une fois l\'argent reçu.') },
    ] },
    { id: 'bilan', n: t('Suivre ton activité'), d: t('Objectifs, indicateurs et graphiques du Bilan'), steps: [
      { view: 'dash', sel: '#dsh .ap', t: t('Ma journée'), x: t('Les tâches du jour. Glisse vers la droite pour la faire, vers la gauche pour la reporter. Tu peux réduire la carte avec ▴.') },
      { view: 'dash', sel: '#dsh .gcard', t: t('Tes objectifs'), x: t('Les jauges montrent où tu en es sur le mois : le violet est la projection à ton rythme, le doré un dépassement.') },
      { view: 'dash', sel: '#dsh .btabs', t: t('Finances, Activité, Stock'), x: t('Trois onglets en couleurs, chacun avec 6 indicateurs et leur flèche de hausse ou de baisse.') },
      { view: 'dash', sel: '#dsh .bchips', t: t('Un graphique à la fois'), x: t('Les pastilles changent de graphique pour que tout tienne sur un écran.') },
      { view: 'dash', sel: '#rptb', t: t('Rapport PDF'), x: t('Ce bouton en haut génère le rapport du mois, prêt à enregistrer en PDF.') },
    ] },
    { id: 'outils', n: t('Les outils'), d: t('Tout ce que Syno sait faire en plus du stock'), steps: [
      { view: 'tools', sel: '#tv .tools', t: t('Les 6 outils majeurs'), x: t('Colis, défis et trophées, QR et étiquettes, datation vintage, acheteurs et rapport PDF.') },
      ...ess.map(o => ({ view: 'tools', sel: `#tv .tool[data-tool="${o.k}"]`, t: t(o.t), x: t(o.d) })),
      { view: 'tools', sel: '#tv .tools2', t: t('Tous les autres outils'), x: t('Ligne fiscale, fiches à compléter, Wrapped, rappels, trésorerie, seuil de rentabilité… Touche un outil pour l\'ouvrir.') },
    ] },
    { id: 'reglages', n: t('Réglages et sauvegarde'), d: t('Compte, synchronisation et sauvegarde'), steps: [
      { view: 'set', sel: '#sy', t: t('Synchronisation'), x: t('Connecte-toi pour retrouver ton stock sur tous tes appareils. Sans compte, tout reste sur cet appareil.') },
      { view: 'set', sel: '#bkc', t: t('Sauvegarde'), x: t('Fais une sauvegarde de temps en temps : elle te permet de tout restaurer.') },
      { view: 'set', sel: '#trc', t: t('Corbeille'), x: t('Une pièce supprimée par erreur reste 30 jours dans la corbeille.') },
    ] },
  ];
}
const stepsOf = ch => ch.steps.filter(s => !s.when || s.when());

/* ---- position et chapitres vus ---- */
const pos = () => LSg('tourPos', null);
const done = () => LSg('tourDone', {});
const markDone = id => { const d = done(); d[id] = 1; LSs('tourDone', d); };

/* ---- la visite guidée ---- */
let tour = null;      /* { c: index du chapitre, i: index de l'étape, first } */
let raf = 0;
function ensureOverlay() {
  if ($('tour')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="tour" hidden><div class="tmask"></div><div class="tcard" role="dialog" aria-live="polite"><div class="tmeta"></div><h3 class="tt"></h3><p class="tx"></p><div class="tbtns"><button type="button" class="btn sec sm" data-tn="prev"></button><button type="button" class="lnk" data-tn="quit"></button><button type="button" class="btn sm" data-tn="next"></button></div></div></div>`);
  $('tour').addEventListener('click', e => {
    const b = e.target.closest('[data-tn]'); if (!b) return;
    if (b.dataset.tn === 'next') next(); else if (b.dataset.tn === 'prev') prev(); else quit();
  });
  document.addEventListener('keydown', e => { if (tour && e.key === 'Escape') quit(); else if (tour && e.key === 'ArrowRight') next(); else if (tour && e.key === 'ArrowLeft') prev(); });
  window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
}
function place() {
  if (!tour) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const m = document.querySelector('#tour .tmask'), card = document.querySelector('#tour .tcard'); if (!tour || !m || !card) return;
    const st = tour.step, el = st && st.sel ? document.querySelector(st.sel) : null;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!el || !el.getClientRects().length) { m.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`; card.style.cssText = 'top:50%;bottom:auto;transform:translateY(-50%)'; return; }
    const r = el.getBoundingClientRect(), pad = 6;
    m.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const below = r.top + r.height / 2 < vh * 0.5;
    card.style.cssText = below ? 'top:auto;bottom:84px;transform:none' : 'top:12px;bottom:auto;transform:none';
  });
}
async function show() {
  ensureOverlay();
  const C = chapters(), ch = C[tour.c], S = stepsOf(ch), st = S[tour.i];
  tour.step = st; LSs('tourPos', { c: ch.id, i: tour.i });
  $('sheet').hidden = true;
  if (st.view && app.view !== st.view) go(st.view);
  if (st.pre) st.pre();
  $('tour').hidden = false;
  await tick(160);
  if (!tour || tour.step !== st) return;      /* quitté ou changé d'étape pendant l'attente */
  const el = st.sel ? document.querySelector(st.sel) : null;
  if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'auto' }); await tick(60); }
  if (!tour || tour.step !== st) return;
  const card = document.querySelector('#tour .tcard');
  card.querySelector('.tmeta').textContent = t('{c} · étape {a} sur {b}', { c: ch.n, a: tour.i + 1, b: S.length });
  card.querySelector('.tt').textContent = st.t;
  card.querySelector('.tx').textContent = st.x;
  const last = tour.c === C.length - 1 && tour.i === S.length - 1;
  card.querySelector('[data-tn=prev]').textContent = t('Précédent');
  card.querySelector('[data-tn=prev]').hidden = tour.c === 0 && tour.i === 0;
  card.querySelector('[data-tn=quit]').textContent = t('Quitter');
  const nx = card.querySelector('[data-tn=next]'); nx.textContent = last ? t('Terminer') : tour.i === S.length - 1 ? t('Chapitre suivant') : t('Suivant');
  place(); nx.focus({ preventScroll: true });
}
export function startTour(chId, i = 0, first = false) {
  const C = chapters(), c = Math.max(0, C.findIndex(x => x.id === chId));
  tour = { c, i, first };
  show();
}
function next() {
  const C = chapters(), S = stepsOf(C[tour.c]);
  if (tour.i < S.length - 1) { tour.i++; return show(); }
  markDone(C[tour.c].id);
  if (tour.c < C.length - 1) { tour.c++; tour.i = 0; return show(); }
  end(true);
}
function prev() {
  if (tour.i > 0) { tour.i--; return show(); }
  if (tour.c > 0) { tour.c--; tour.i = stepsOf(chapters()[tour.c]).length - 1; return show(); }
}
function end(complete) {
  const first = tour && tour.first;
  tour = null; $('tour').hidden = true;
  if (complete) { LSs('tourPos', null); LSs('tutoSeen', 1); app.toast(t('Visite terminée. Retrouve-la dans Outils, Tutoriel.')); }
  else app.toast(t('Tu peux la reprendre à tout moment dans Outils, Tutoriel.'));
  if (app.setStockMode) app.setStockMode('stock');
  if (first && !app.cfg.setupDone && app.openSetup) setTimeout(() => app.openSetup(), 300);
}
function quit() { end(false); }

/* ---- l'accueil du tutoriel : reprendre, chapitres, détail ---- */
function hub(first) {
  const C = chapters(), p = pos(), dn = done(), cur = p ? C.findIndex(x => x.id === p.c) : -1;
  const reprise = cur >= 0 ? `<button type="button" class="tool tuto-go" data-tg="resume"><span class="tic">${TI('<path d="M8 5v14l11-7z"/>')}</span><span class="tx"><b>${t('Reprendre où tu t\'es arrêté')}</b><small>${esc(t('Reprendre : {c} · étape {a} sur {b}', { c: C[cur].n, a: (p.i || 0) + 1, b: stepsOf(C[cur]).length }))}</small></span></button>` : '';
  showSheet(sheetHead(first ? t('Bienvenue sur Syno') : t('Tutoriel')) + `<p class="sub">${first ? t('Une visite rapide te montre chaque écran. Tu peux l\'arrêter et la reprendre quand tu veux, depuis Outils.') : t('Découvre chaque écran et chaque outil. Tu peux t\'arrêter et reprendre quand tu veux.')}</p>
   <div class="tools">${first ? `<button type="button" class="tool tuto-go" data-tg="start"><span class="tic">${TI('<path d="M8 5v14l11-7z"/>')}</span><span class="tx"><b>${t('Commencer la visite')}</b><small>${t('Pas à pas, sur les vrais écrans')}</small></span></button>` : reprise}</div>
   <h3 class="tl2h">${t('Chapitres')}</h3>
   <div class="tools">${C.map((c, i) => `<button type="button" class="tool" data-tc="${c.id}"><span class="tic tuto-n${dn[c.id] ? ' ok' : ''}">${dn[c.id] ? '✓' : i + 1}</span><span class="tx"><b>${esc(c.n)}</b><small>${esc(c.d)} · ${tn(stepsOf(c).length, 'étape', 'étapes')}</small></span></button>`).join('')}</div>
   <div class="acts">${first ? `<button type="button" class="btn sec" data-tg="later">${t('Plus tard')}</button>` : `<button type="button" class="btn sec" data-tg="restart">${t('Tout revoir depuis le début')}</button>`}</div>`);
  $('shc').onclick = e => {
    const g = e.target.closest('[data-tg]'), c = e.target.closest('[data-tc]');
    if (c) return chapter(c.dataset.tc, first);
    if (!g) return;
    const k = g.dataset.tg;
    if (k === 'start' || k === 'restart') return startTour(C[0].id, 0, first);
    if (k === 'resume') return startTour(p.c, p.i || 0);
    if (k === 'later') { $('sheet').hidden = true; LSs('tutoSeen', 1); if (!app.cfg.setupDone && app.openSetup) setTimeout(() => app.openSetup(), 200); }
  };
}
function chapter(id, first) {
  const C = chapters(), ch = C.find(x => x.id === id), S = stepsOf(ch);
  const tools = id === 'outils' ? (app.toolsView ? app.toolsView().list : TOOLS) : [];
  showSheet(sheetHead(esc(ch.n)) + `<p class="sub">${esc(ch.d)}</p>
   <div class="card"><ol class="tuto-l">${S.map(s => `<li><b>${esc(s.t)}</b><span>${esc(s.x)}</span></li>`).join('')}</ol></div>
   ${tools.length ? `<h3 class="tl2h">${t('Tous les outils')}</h3><div class="tools">${tools.map(o => `<button type="button" class="tool" data-open="${o.k}"><span class="tic">${o.i || ''}</span><span class="tx"><b>${t(o.t)}</b><small>${t(o.d)}</small></span></button>`).join('')}</div>` : ''}
   <div class="acts two"><button type="button" class="btn" data-tg="show">${t('Me montrer sur l\'écran')}</button><button type="button" class="btn sec" data-tg="back">${t('Retour')}</button></div>`);
  $('shc').onclick = e => {
    const o = e.target.closest('[data-open]'), g = e.target.closest('[data-tg]');
    if (o) { $('sheet').hidden = true; return app.openTool(o.dataset.open); }
    if (!g) return;
    if (g.dataset.tg === 'show') startTour(id, 0, first && id === C[0].id);
    else hub(first);
  };
}
export function openTuto(o) { hub(!!(o && o.first)); }
app.openTuto = openTuto;
app.startTour = startTour;
export const tourActive = () => !!tour;
