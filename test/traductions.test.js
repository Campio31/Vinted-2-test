import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

/* Parcourt tout l'appli en anglais et note chaque texte sans traduction (I18N.miss).
   Sert à deux choses : garder la liste des traductions à jour, et empêcher un nouveau texte oublié (voir TRADUIT ci-dessous). */
const OUT = process.env.COLLECTE_OUT || '';
const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav, tools;

beforeAll(async () => {
  await demarrer(150);
  nav = await import('../src/modules/nav.js');
  tools = await import('../src/modules/tools-index.js');
  await import('../src/modules/wrapped.js');
});

describe('traductions : aucun texte oublié', () => {
  it('chaque texte affiché a sa traduction (hors historique des nouveautés et réponses de l\'aide)', async () => {
    expect(I18N.lang).not.toBe('fr');
    const sheet = () => { $('sheet').hidden = true; };
    for (const v of ['add', 'quick', 'sales', 'list', 'dash', 'tools', 'set']) { nav.go(v); await tick(30); }
    /* formulaire Ajouter : ouvre toutes les sections */
    nav.go('add'); await tick(20);
    for (const h of [...$('fadd').querySelectorAll('.gh')]) { h.click(); await tick(5); }
    /* accueil */
    app.openWelcome(); for (const v of ['micro', 'both', 'comp']) { const b = $('welcome').querySelector('[data-wo]'); b && b.click(); } $('welcome').hidden = true;
    /* outils, dans les deux modes */
    for (const mode of ['simple', 'avance']) {
      app.setCfg({ mode, onb: { statut: 'micro', canal: 'both', obj: 'comp' } }, true);
      nav.go('tools'); await tick(20);
      for (const k of tools.TOOLS.map(x => x.k).concat(['treso', 'rapport', 'calcom', 'planning', 'defis', 'importo', 'lives', 'cohortes', 'help', 'news', 'idee', 'wrapped'])) {
        if (k === 'scan' || k === 'live') continue;
        try { await app.openTool(k); } catch (e) { /* un outil qui échoue sera vu par les autres tests */ }
        await tick(15); sheet();
      }
    }
    /* défis et trophées : 3 onglets ; coach ; rappels */
    const P = await import('../src/modules/progress.js');
    for (const tab of ['now', 'trophees', 'amis']) { P.openProgress(tab); await tick(15); }
    sheet();
    /* fiche d'une pièce, tous les modes */
    for (const mode of [undefined, 'edit', 'sell', 'ann', 'del']) { const p = app.P.find(x => x.statut === 'Disponible'); app.openSheet(p.id, mode); await tick(10); }
    for (const mode of [undefined, 'esale', 'ret']) { const p = app.P.find(x => x.statut === 'Vendu' && x.acheteur); app.openSheet(p.id, mode); await tick(10); }
    sheet();
    /* stock : vente rapide, sélection */
    nav.go('list'); await tick(20);
    document.querySelector('#lst [data-id]')?.click(); sheet();
    const sel = await import('../src/modules/selection.js');
    sel.selSet(true); app.P.filter(p => p.statut === 'Disponible').slice(0, 3).forEach(p => sel.SEL.add(p.id)); document.querySelector('[data-sa=act]')?.click(); await tick(10); sel.selSet(false); sheet();
    /* bilan : calendrier, sections */
    nav.go('dash'); await tick(20);
    document.querySelector('#dsh [data-dcust]')?.click(); await tick(10); sheet();
    const ev = app.commEventsAll().find(e => e.date >= new Date().toISOString().slice(0, 10));
    app.calM = ev.date.slice(0, 7); app.calD = ev.date; app.renderDash();
    /* réglages : section compte */
    nav.go('set'); await tick(20); $('ac_del')?.click();
    /* Live */
    nav.go('quick'); await tick(20);
    /* images du Wrapped : les textes sont écrits dans des canvas, avec ou sans mode discret */
    const ctx = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });
    HTMLCanvasElement.prototype.getContext = () => ctx; document.fonts = { load: () => Promise.resolve() };
    const Wr = await import('../src/modules/wrapped.js');
    const d0 = new Date(); d0.setDate(1); d0.setMonth(d0.getMonth() - 1);
    for (const per of [d0.toISOString().slice(0, 7), String(d0.getFullYear())]) for (const disc of [false, true]) await Wr.makeWrapped(Wr.wrappedData(per), disc);
    const miss = [...I18N.miss].sort();
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(miss, null, 1), 'utf8');
    /* l'historique des nouveautés et les réponses de l'aide sont longs : ils restent en français pour l'instant */
    const { CHANGELOG, FAQ } = await import('../src/modules/help-news.js');
    const permis = new Set(['Vinted', 'TikTok Live', 'Vinted et lives', 'max']);
    CHANGELOG.forEach(c => c.t.forEach(x => permis.add(x)));
    FAQ.forEach(([q, r]) => { permis.add(q); permis.add(r); });
    const manquants = miss.filter(k => !permis.has(k) && !k.startsWith('{"pieces"'));
    expect(manquants, 'ajoute ces textes à public/i18n.js avec K(...) : ' + JSON.stringify(manquants)).toEqual([]);
  }, 60000);
});
