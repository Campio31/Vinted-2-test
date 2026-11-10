import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';
import { addDays, today } from '../src/modules/core.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let A, nav;
beforeAll(async () => {
  await demarrer(120);
  app.setCfg({ fiscQ: { statut: 'micro', activite: 'march', creation: '2020-01-01', vl: 'bareme', tva: 'franchise', periode: 'M' } }, true);
  A = await import('../src/modules/autopilot.js');
  nav = await import('../src/modules/nav.js');
});
afterEach(() => { app.setCfg({ apMode: 'assist', apLog: [], apStats: { lots: 0, items: 0, min: 0 } }); });
const base = () => app.P.find(p => p.statut === 'Disponible');
const mk = (id, o) => { const p = Object.assign({}, base(), { id }, o); app.P.push(p); return p; };
const clean = () => { app.P = app.P.filter(p => !p.id.startsWith('ap-')); };

describe('Ma journée : le moteur de tâches', () => {
  it('liste les tâches d\'après les données, de la plus urgente à la moins urgente', () => {
    clean();
    app.P = app.P.filter(p => !(p.statut === 'Vendu' && !p.exp && p.vt && Date.now() - p.vt <= 14 * 864e5));
    mk('ap-c1', { statut: 'Vendu', pv: 10, dv: today(), vt: Date.now(), frais: 1, canal: 'Vinted' });
    mk('ap-p1', { statut: 'Disponible', pub: undefined });
    const T = A.tasksToday(), ids = T.map(x => x.id);
    expect(ids).toContain('colis');
    expect(ids).toContain('pub');
    const ordre = T.filter(x => !x.rule).map(x => x.id);
    if (ordre.includes('colis') && ordre.includes('pub')) expect(ordre.indexOf('colis')).toBeLessThan(ordre.indexOf('pub'));
    expect(T.find(x => x.id === 'colis').n).toBe(1);
    clean();
  });

  it('chaque lot montre une ligne par pièce avec ce qui va changer', () => {
    mk('ap-p2', { statut: 'Disponible', pub: undefined });
    const L = A.batchOf('pub');
    expect(L.length).toBeGreaterThan(0);
    expect(L.every(x => x.patch.pub === today() && x.txt)).toBe(true);
    clean();
  });
});

describe('Ma journée : écran', () => {
  it('la carte est en haut du Bilan et remplace le coach', async () => {
    nav.go('dash'); app.renderDash(); await tick(20);
    const first = $('dsh').firstElementChild;
    expect(first.classList.contains('ap')).toBe(true);
    expect($('dsh').querySelector('.coachc')).toBeNull();
    expect(first.querySelectorAll('.apt').length).toBeGreaterThan(0);
    expect(first.textContent).toContain(t('Ma journée'));
  });

  it('un lot s\'ouvre, se décoche, s\'applique, s\'inscrit au journal et s\'annule', async () => {
    clean();
    const a = mk('ap-a', { statut: 'Disponible', pub: undefined }), b = mk('ap-b', { statut: 'Disponible', pub: undefined });
    nav.go('dash'); app.renderDash(); await tick(20);
    $('dsh').querySelector('[data-ap="open:pub"]').click(); await tick(20);
    const cb = [...$('dsh').querySelectorAll('[data-aps]')];
    expect(cb.length).toBeGreaterThan(1);
    expect(cb.length).toBeLessThanOrEqual(5);
    const exclu = cb.find(c => c.dataset.aps === 'ap-b');
    if (exclu) { exclu.checked = false; exclu.dispatchEvent(new Event('change', { bubbles: true })); await tick(20); }
    const avant = app.P.filter(p => !p.pub && p.statut === 'Disponible').length;
    $('dsh').querySelector('[data-ap="do:pub"]').click(); await tick(40);
    expect(app.P.find(p => p.id === 'ap-a').pub).toBe(today());
    if (exclu) expect(app.P.find(p => p.id === 'ap-b').pub).toBeUndefined();
    expect(app.P.filter(p => !p.pub && p.statut === 'Disponible').length).toBeLessThan(avant);
    expect(app.cfg.apLog).toHaveLength(1);
    expect(app.cfg.apLog[0]).toMatchObject({ k: 'pub' });
    expect(app.cfg.apStats.lots).toBe(1);
    expect(app.cfg.apStats.min).toBeGreaterThan(0);
    $('toast').querySelector('button').click(); await tick(40);
    expect(app.P.find(p => p.id === 'ap-a').pub).toBeUndefined();
    expect(app.cfg.apLog[0].undone).toBe(1);
    expect(app.cfg.apStats.lots).toBe(0);
    void a; void b;
    clean();
  });

  it('les prix proposés sont les prix conseillés, jamais un prix inventé', () => {
    const old = addDays(today(), -60);
    const p = mk('ap-px', { statut: 'Disponible', pub: old, pvise: undefined });
    const L = A.batchOf('prix').filter(x => x.p.id === 'ap-px');
    for (const x of L) expect(x.patch.pvise).toBe(app.advice(app.P.find(q => q.id === 'ap-px')).reco);
    void p; clean();
  });

  it('trois niveaux : Manuel ne propose aucun lot, Automatique encadré n\'est pas encore disponible', async () => {
    clean(); mk('ap-m', { statut: 'Disponible', pub: undefined });
    app.setCfg({ apMode: 'manual' });
    nav.go('dash'); app.renderDash(); await tick(20);
    expect($('dsh').querySelector('[data-ap^="open:"]')).toBeNull();
    expect($('dsh').querySelector('[data-ap="mode:auto"]').disabled).toBe(true);
    $('dsh').querySelector('[data-ap="mode:assist"]').click(); await tick(20);
    expect(app.cfg.apMode).toBe('assist');
    expect($('dsh').querySelector('[data-ap^="open:"]')).toBeTruthy();
    clean();
  });
});
