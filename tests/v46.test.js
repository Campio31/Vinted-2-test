import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav, tools;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
  tools = await import('../src/modules/tools-index.js');
});
afterEach(() => { $('sheet').hidden = true; });

describe('v49 : Ajouter, 4 étapes guidées', () => {
  it('quatre étapes ; chacune ne montre que ses paramètres, un par un', async () => {
    nav.go('add'); app.addForm.draw(); await tick(20);
    const f = $('fadd'), noms = () => [...f.querySelectorAll('.grp')].map(g => g.dataset.sec);
    expect(f.querySelectorAll('.steps [data-step]')).toHaveLength(4);
    expect(f.querySelector('.stb.cur').dataset.step).toBe('0');
    expect(noms()).toEqual(['cat', 'marque', 'genre']);
    f.querySelector('[data-step="1"]').click();
    expect(noms()).toEqual(['taille', 'coul', 'mat', 'dim', 'madein']);
    expect(f.querySelectorAll('.grp.open')).toHaveLength(1);
    f.querySelector('[data-step="2"]').click();
    expect(noms()).toEqual(['grade', 'photo', 'etat']);
    f.querySelector('[data-step="3"]').click();
    expect(noms()).toEqual(expect.arrayContaining(['achat', 'prov', 'ballot', 'dates', 'det']));
    expect(f.querySelectorAll('.stb.done')).toHaveLength(3);
  });
  it('remplir l\'étape 1 paramètre après paramètre amène à l\'étape 2', async () => {
    nav.go('add'); app.addForm.draw(); await tick(10);
    const f = $('fadd'), S = app.addForm.state;
    Object.assign(S, { cat: '', sub: '', marque: '', genre: '' });
    f.querySelector('[data-step="0"]').click();
    expect(f.querySelector('.grp.open').dataset.sec).toBe('cat');
    for (let i = 0; i < 6 && f.querySelector('.stb.cur').dataset.step === '0'; i++) {
      const g = f.querySelector('.grp.open'), k = g.dataset.sec;
      if (k === 'marque') g.querySelector('[data-next]').click(); else g.querySelector('[data-f]').click();
    }
    expect(f.querySelector('.stb.cur').dataset.step).toBe('1');
    expect(f.querySelector('.grp.open').dataset.sec).toBe('taille');
    expect(f.querySelectorAll('.stb.done')).toHaveLength(1);
  });
});
describe('v46 : outils', () => {
  it('Dépenses, Compléter et Nettoyer ne sont plus des outils séparés', () => {
    const k = tools.TOOLS.map(x => x.k);
    ['depenses', 'complete', 'merge'].forEach(x => expect(k).not.toContain(x));
    ['fiches', 'journee', 'setup'].forEach(x => expect(k).toContain(x));
  });
  it('le nouvel outil réunit compléter et nettoyer', async () => {
    await app.openTool('fiches'); await tick(10);
    expect($('shc').querySelector('[data-fx="complete"]')).not.toBeNull();
    expect($('shc').querySelector('[data-fx="merge"]')).not.toBeNull();
    $('shc').querySelector('[data-fx="merge"]').click(); await tick(20);
    expect($('sheet').hidden).toBe(false);
  });
  it('les dépenses restent dans le Bilan', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    expect($('dsh').querySelector('h3[data-sec="Dépenses"]')).not.toBeNull();
  });
});

describe('v46 : Bilan', () => {
  it('plus de courbe, plus de plafond ni de rapport en carte ; le rapport est dans l\'en-tête', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    expect($('dsh').querySelector('[data-ck="courbe"]')).toBeNull();
    expect($('dsh').querySelector('[data-tool="rapport"]')).toBeNull();
    expect($('rptb').hidden).toBe(false);
    nav.go('list'); await tick(10);
    expect($('rptb').hidden).toBe(true);
    nav.go('dash');
    $('rptb').click(); await tick(30);
    expect($('sheet').hidden).toBe(false);
  });
});

describe('v46 : Ma journée terminée', () => {
  it('se replie en une ligne quand tout est fait, et se rouvre depuis l\'outil', async () => {
    const A = await import('../src/modules/autopilot.js');
    /* toutes les règles coupées et aucune tâche : on vide le stock disponible */
    const sauv = app.P.slice();
    app.P = app.P.filter(p => p.statut === 'Vendu').map(p => Object.assign({}, p, { fin: '2026-01-01', exp: '2026-01-01', grade: 'A', etat: 'Très bon état', code: p.code || 'X-1' }));
    app.setCfg({ apSnooze: {}, rules: {} }, true);
    const { LSs, today } = await import('../src/modules/core.js');
    LSs('lastBackup', today());
    nav.go('dash'); app.renderDash(); await tick(30);
    expect(A.tasksToday().map(x => x.id)).toEqual([]);
    {
      const c = $('dsh').querySelector('.ap');
      expect(c.classList.contains('apdone')).toBe(true);
      c.querySelector('[data-ap="jopen"]').click(); await tick(20);
      expect($('dsh').querySelector('.ap').classList.contains('apdone')).toBe(false);
      $('dsh').querySelector('[data-ap="jclose"]').click(); await tick(20);
      expect($('dsh').querySelector('.ap').classList.contains('apdone')).toBe(true);
      await app.openTool('journee'); await tick(30);
      expect(app.view).toBe('dash');
      expect($('dsh').querySelector('.ap').classList.contains('apdone')).toBe(false);
    }
    app.P = sauv;
  });
});

describe('v46 : premier lancement', () => {
  it('une fenêtre liste les questionnaires des indicateurs et se coche', async () => {
    app.setCfg({ setupDone: false, goal: 0, goalCA: 0 }, true);
    await app.openTool('setup'); await tick(10);
    expect(app.cfg.setupDone).toBe(true);
    const lignes = [...$('shc').querySelectorAll('[data-su]')].map(b => b.dataset.su);
    expect(lignes).toEqual(['goal', 'seuil', 'fourn', 'treso']);
    expect($('shc').querySelector('[data-su="goal"]').classList.contains('su-ok')).toBe(false);
    $('shc').querySelector('[data-su="seuil"]').click(); await tick(30);
    expect($('sheet').hidden).toBe(false);
  });
});
describe('v49 : objectif dépassé', () => {
  it('objectif dépassé : arc plein, 2e tour doré et mention du dépassement', async () => {
    const goals = await import('../src/modules/goals.js');
    const d = { kind: 'net', per: 'm', g: 100, cur: 130, pct: 1.3, exp: 50, left: 5, reste: 0, proj: 130, projPct: 1.3, rate: 0 };
    const h = document.createElement('div'); h.innerHTML = goals.gaugeHTML(d);
    expect(h.querySelector('.gfg')).not.toBeNull();
    expect(h.querySelector('.gov2')).not.toBeNull();
    expect(h.querySelector('.gov').textContent).toMatch(/30/);
    expect(h.querySelector('.gpc').textContent).toMatch(/130/);
    const e = document.createElement('div'); e.innerHTML = goals.gaugeHTML(Object.assign({}, d, { cur: 100, pct: 1 }));
    expect(e.querySelector('.gov2')).toBeNull();
    const f = document.createElement('div'); f.innerHTML = goals.gaugeHTML(Object.assign({}, d, { cur: 250, pct: 2.5 }));
    expect(f.querySelector('.gov2')).not.toBeNull();
  });
});