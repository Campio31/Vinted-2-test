import { app } from '../state.js';
import { LSs } from './core.js';
import { go } from './nav.js';

/* ---------- démo : l'appli dans un cadre sur la page de présentation (presentation.html, adresse ?demo=1) ---------- */
/* env.js range les données de la démo à part (jamais celles de l'utilisateur) et coupe le serveur. Ici on prépare l'écran :
   pièces d'exemple, ventes de ce mois-ci, offre et colis pour que le Bilan et le CRM soient vivants, puis on ouvre l'écran demandé (?v=add, list, dash, tools ; &crm=1 pour le CRM). */
if (window.STOCK_ENV === 'demo') {
  const q = new URLSearchParams(location.search), view = q.get('v') || 'list';
  LSs('welcomed', 1); LSs('tutoSeen', 1);
  document.documentElement.dataset.env = 'demo';
  const wait = setInterval(async () => {
    if (!app.loaded) return;
    clearInterval(wait);
    app.setCfg({ onb: { skipped: 1 }, setupDone: true, goal: 800, goalMode: 'net', mode: 'avance' }, true);
    if (!app.P.length) await app.loadExamples();
    const d = new Date(), pre = d.toISOString().slice(0, 8), td = d.toISOString().slice(0, 10);
    app.P.filter(p => p.statut === 'Vendu').slice(0, 6).forEach((p, i) => { p.dv = pre + String(Math.max(1, d.getDate() - i)).padStart(2, '0'); p.pv = Math.max(p.pv || 0, 30) + i * 12; });
    const A = app.P.filter(p => p.statut === 'Disponible'), v = app.P.find(p => p.statut === 'Vendu');
    if (A[0]) A[0].pub = td;
    if (A[1]) { A[1].crm = 'offre'; A[1].offre = { a: 'lea_m', m: 15, d: td }; }
    if (v) { Object.assign(v, { vt: Date.now(), acheteur: '@marie_p' }); delete v.exp; }
    LSs('jShut', td);
    if (app.setStockMode) app.setStockMode(q.get('crm') ? 'crm' : 'stock');
    go(view);
    if (view === 'add' && app.addForm) app.addForm.reset(Object.assign({}, app.addForm.state, { cat: 'Pantalon', sub: 'Slim', marque: 'Levis', genre: 'Homme', taille: 'M', coul: ['Bleu'] }), true);
  }, 200);
}