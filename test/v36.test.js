import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
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
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-11T12:00:00')); });
afterEach(() => { app.setCfg({ rules: {}, ruleSnooze: {}, apLog: [], apStats: { lots: 0, items: 0, min: 0 } }); localStorage.removeItem('ruleSeen'); app.P = app.P.filter(p => !p.id.startsWith('ru-')); vi.useRealTimers(); });
const base = () => app.P.find(p => p.statut === 'Disponible');
const mk = (id, o) => { const p = Object.assign({}, base(), { id }, o); app.P.push(p); return p; };

describe('Règles de Max : définition et réglages', () => {
  it('neuf règles prêtes, toutes actives au départ, réglables dans Réglages', async () => {
    expect(A.RULES).toHaveLength(9);
    expect(A.RULES.every(r => A.ruleOn(r.id))).toBe(true);
    nav.go('set'); app.renderSet(); await tick(30);
    expect($('rlc').querySelectorAll('[data-ru]')).toHaveLength(9);
    expect($('rlc').classList.contains('shut')).toBe(true);
    $('rlc').querySelector('[data-ru="colis"]').checked = false;
    $('rlc').querySelector('[data-ru="colis"]').dispatchEvent(new Event('change', { bubbles: true }));
    expect(A.ruleOn('colis')).toBe(false);
  });
  it('les paramètres restent dans leurs limites', async () => {
    expect(A.ruleParam('dormant')).toBe(45);
    nav.go('set'); app.renderSet(); await tick(30);
    const i = $('rp_dormant'); i.value = '3'; i.dispatchEvent(new Event('change', { bubbles: true }));
    expect(A.ruleParam('dormant')).toBe(14);
    $('rp_dormant').value = '60'; $('rp_dormant').dispatchEvent(new Event('change', { bubbles: true }));
    expect(A.ruleParam('dormant')).toBe(60);
  });
});

describe('Règles de Max : effet sur « Ma journée »', () => {
  it('une règle coupée fait disparaître sa tâche', () => {
    mk('ru-1', { statut: 'Disponible', pub: undefined });
    expect(A.tasksToday().some(x => x.id === 'pub')).toBe(true);
    A.setRule('pub', { on: false });
    expect(A.tasksToday().some(x => x.id === 'pub')).toBe(false);
  });
  it('« Nouvelles pièces » se déclenche au-delà du seuil réglé et marque la tâche', () => {
    A.setRule('pub', { p: 3 });
    for (let i = 0; i < 5; i++) mk('ru-p' + i, { statut: 'Disponible', pub: undefined });
    const T = A.tasksToday(), x = T.find(y => y.id === 'pub');
    expect(x.rule).toBe('pub');
    expect(T[0].rule).toBeTruthy();
  });
  it('« Colis en retard » marque un colis vendu depuis 2 jours', () => {
    app.P = app.P.filter(p => !(p.statut === 'Vendu' && !p.exp && p.vt && Date.now() - p.vt <= 14 * 864e5));
    mk('ru-c', { statut: 'Vendu', pv: 10, dv: addDays(today(), -3), vt: Date.now() - 3 * 864e5, frais: 1, canal: 'Vinted' });
    expect(A.tasksToday().find(x => x.id === 'colis').rule).toBe('colis');
  });
  it('le coach du lundi n\'existe plus : aucune tâche de bilan, même un lundi', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-02T10:00:00'));
    expect(A.tasksToday().some(x => x.id === 'r-lundi')).toBe(false);
    vi.setSystemTime(new Date('2026-11-04T10:00:00'));
    expect(A.tasksToday().some(x => x.id === 'r-lundi')).toBe(false);
  });
  it('le dernier jour du mois : rapport du mois', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-30T10:00:00'));
    expect(A.tasksToday().some(x => x.id === 'r-rapport')).toBe(true);
    vi.setSystemTime(new Date('2026-11-29T10:00:00'));
    expect(A.tasksToday().some(x => x.id === 'r-rapport')).toBe(false);
  });
  it('au plus 3 tâches marquées par jour', () => {
    A.setRule('pub', { p: 3 });
    for (let i = 0; i < 5; i++) mk('ru-q' + i, { statut: 'Disponible', pub: undefined });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-30T18:00:00'));
    expect(A.tasksToday().filter(x => x.rule).length).toBeLessThanOrEqual(3);
  });
  it('« Pas maintenant » reporte la règle à demain et l\'inscrit au journal', async () => {
    A.setRule('pub', { p: 3 });
    for (let i = 0; i < 5; i++) mk('ru-s' + i, { statut: 'Disponible', pub: undefined });
    nav.go('dash'); app.renderDash(); await tick(20);
    $('dsh').querySelector('[data-ap="later:pub"]').click(); await tick(30);
    expect(A.tasksToday().some(x => x.id === 'pub')).toBe(false);
    expect(app.cfg.apLog[0]).toMatchObject({ k: 'rule', res: 'later' });
  });
  it('appliquer un lot issu d\'une règle l\'inscrit avec le nom de la règle', async () => {
    A.setRule('pub', { p: 3 });
    for (let i = 0; i < 5; i++) mk('ru-a' + i, { statut: 'Disponible', pub: undefined });
    nav.go('dash'); app.renderDash(); await tick(20);
    $('dsh').querySelector('[data-ap="open:pub"]').click(); await tick(20);
    $('dsh').querySelector('[data-ap="do:pub"]').click(); await tick(40);
    expect(app.cfg.apLog[0].rule).toBe('Nouvelles pièces');
  });
  it('une règle ignorée 3 jours de suite propose de se désactiver', () => {
    A.setRule('pub', { p: 3 });
    for (let i = 0; i < 5; i++) mk('ru-i' + i, { statut: 'Disponible', pub: undefined });
    localStorage.setItem('ruleSeen', JSON.stringify({ pub: { d: addDays(today(), -1), n: 2, h: false } }));
    expect(A.tasksToday().find(x => x.id === 'pub').ignored).toBe(true);
  });
});