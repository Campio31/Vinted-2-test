import '../mode.css';
import { app } from '../state.js';
import { $, age, avail, eur, eurR, ok, profit, sold, today } from './core.js';
import { CFG0 } from './settings-core.js';
import { go } from './nav.js';
import { TOOLS } from './tools-index.js';

/* ---------- mode simple / avancé et écran « Aujourd'hui » ---------- */
/* Mode avancé (par défaut pour les comptes existants) : tout est visible, comme avant.
   Mode simple (proposé aux nouveaux) : 8 outils choisis selon le profil, « Plus d'outils » pour le reste, et le Bilan se limite à « Aujourd'hui ». */
Object.assign(CFG0, { mode: 'avance', onb: null });

const isSimple = () => app.cfg.mode === 'simple';
let showAll = false;
let touched = false;

/* les 8 outils du mode simple : ceux qui servent à ton profil d'abord, puis les basiques */
export function essentials() {
  /* depuis la v43 : les 6 outils majeurs sont les mêmes pour tout le monde */
  return ['colis', 'trophees', 'qr', 'vintage', 'buyers', 'rapport'].filter(k => TOOLS.some(x => x.k === k));
}

/* Onglet Outils : 6 grandes tuiles (ceux de ton profil), puis tous les autres en liste compacte (tools-index.js).
   Le mode simple ne change plus que le Bilan ; il garde le lien « Revoir l'accueil ». */
app.essentials = () => essentials().slice(0, 6);
app.toolsView = function () {
  const simple = isSimple();
  const head = `<div class="chips" style="margin-bottom:12px"><button type="button" class="chip sm${simple ? ' on' : ''}" data-mode="simple">${t('Mode simple')}</button><button type="button" class="chip sm${simple ? '' : ' on'}" data-mode="avance">${t('Mode avancé')}</button></div>`;
  const replay = `<div class="wfoot"><button type="button" class="wlnk" data-wreplay="1">${t('Revoir l\'accueil')}</button></div>`;
  return { list: TOOLS, head, foot: simple ? replay : '' };
};
$('tv').addEventListener('click', e => {
  const m = e.target.closest('[data-mode]');
  if (m) { app.setCfg({ mode: m.dataset.mode }, true); showAll = false; app.renderAll(); return app.renderTools(); }
  if (e.target.closest('[data-wreplay]')) { $('sheet').hidden = true; app.openWelcome(); }
});

/* ---------- « Aujourd'hui » : 4 choses seulement ---------- */
export function todayData() {
  const A = app.P.filter(avail), td = today(), mo = td.slice(0, 7);
  const sT = app.P.filter(p => sold(p) && p.dv === td);
  const sM = app.P.filter(p => sold(p) && (p.dv || '').slice(0, 7) === mo);
  const useCA = app.cfg.goalMode === 'ca';
  const goal = (useCA ? +app.cfg.goalCA : +app.cfg.goal) || 0;
  const net = sM.reduce((a, p) => a + profit(p), 0), ca = sM.reduce((a, p) => a + (p.pv || 0), 0), val = useCA ? ca : net;
  return {
    toPub: A.filter(p => !ok(p.pub)).length,
    soldN: sT.length, soldCA: sT.reduce((a, p) => a + (p.pv || 0), 0),
    stale: A.filter(p => age(p) >= 60).length,
    month: val, goal, pct: goal > 0 ? Math.max(0, Math.min(100, Math.round(val / goal * 100))) : 0, useCA,
    empty: !app.P.length, examples: app.P.filter(p => p.ex).length,
  };
}

const exHTML = d => d.examples ? `<div class="tdx"><span>${t('{n} pièces d\'exemple dans ton stock.', { n: d.examples })}</span><button type="button" class="btn sec" data-td="delex">${t('Supprimer les exemples')}</button></div>` : '';
export function todayHTML() {
  const d = todayData();
  const tile = (act, big, label, small, extra) => `<button type="button" class="tdt" data-td="${act}"><b>${big}</b><span>${label}</span>${extra || ''}<small>${small}</small></button>`;
  const tiles = [
    tile('list', d.toPub, t('à publier'), t('Disponibles, pas encore en ligne')),
    tile('sales', d.soldN, d.soldN > 1 ? t('vendues aujourd\'hui') : t('vendue aujourd\'hui'), d.soldCA ? t('{c} encaissés', { c: eur(d.soldCA) }) : t('Touche pour voir tes ventes')),
    tile('list', d.stale, t('à relancer'), t('En stock depuis 60 jours ou plus')),
    tile('month', eur(d.month), d.useCA ? t('de CA ce mois-ci') : t('de bénéfice ce mois-ci'), d.goal > 0 ? t('{p} % de ton objectif de {g}', { p: d.pct, g: eurR(d.goal) }) : t('Fixe un objectif dans Réglages'), d.goal > 0 ? `<div class="tdp"><i style="width:${d.pct}%"></i></div>` : ''),
  ].join('');
  const cta = d.empty ? `<div class="tdc"><button type="button" class="btn" data-td="add">${t('Ajouter ma première pièce')}</button><button type="button" class="btn sec" data-td="examples">${t('Charger des pièces d\'exemple')}</button></div>` : '';
  const ex = exHTML(d);
  return `<div class="card tdy" data-ck="today" data-lb="${t('Aujourd\'hui')}"><h3 style="margin:0 0 10px">${t('Aujourd\'hui')}</h3><div class="tdg">${tiles}</div>${cta}${ex}</div>`;
}

const todayHidden = () => !!(app.cfg.dash && Array.isArray(app.cfg.dash.hide) && app.cfg.dash.hide.includes('today'));
const renderDash25 = app.renderDash;
app.renderDash = function () {
  renderDash25();
  const box = $('dsh');
  if (!box || !app.loaded) return;
  const compact = isSimple() && !showAll;
  [...box.children].forEach(el => { if (compact) el.style.display = 'none'; });
  box.querySelectorAll('.card.empty').forEach(el => { el.style.display = 'none'; });
  let jr = app.journeeHTML && app.P.length ? app.journeeHTML() : '';
  if (jr) jr = jr.replace(/<\/div>\s*$/, exHTML(todayData()) + '</div>');
  box.insertAdjacentHTML('afterbegin', jr || todayHTML());
  if (todayHidden() && !compact) box.firstElementChild.style.display = 'none';
  if (isSimple() && app.P.length) box.insertAdjacentHTML('beforeend', `<button type="button" class="btn sec" data-td="${showAll ? 'compact' : 'full'}" style="margin-top:4px">${showAll ? t('Revenir à l\'essentiel') : t('Voir le bilan complet')}</button>`);
  $('per').style.display = compact ? 'none' : '';
};

$('dsh').addEventListener('click', async e => {
  const b = e.target.closest('[data-td]');
  if (!b) return;
  const a = b.dataset.td;
  if (a === 'list' || a === 'sales' || a === 'add') return go(a);
  if (a === 'month') { if (todayData().goal > 0) app.openTool('courbe'); else go('set'); return; }
  if (a === 'examples') return app.loadExamples();
  if (a === 'delex') { for (const x of app.P.filter(p => p.ex)) await app.remove(x.id); return app.toast(t('Exemples supprimés')); }
  if (a === 'full' || a === 'compact') { showAll = a === 'full'; app.renderDash(); }
});

/* au démarrage, un compte en mode simple arrive directement sur « Aujourd'hui » */
$('nav').addEventListener('click', () => { touched = true; }, true);
setTimeout(() => { if (isSimple() && app.view === 'add' && !touched && app.P.length) go('dash'); }, 1200);
