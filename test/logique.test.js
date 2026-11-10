import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/state.js';
import { demarrer } from './helpers.js';

let nav, gs, core;
const $ = id => document.getElementById(id);
beforeAll(async () => {
  await demarrer(200);
  nav = await import('../src/modules/nav.js');
  gs = await import('../src/modules/group-sale.js');
  core = await import('../src/modules/core.js');
});
const enStock = n => app.P.filter(p => p.statut === 'Disponible').slice(0, n);

describe('calculs', () => {
  it('bénéfice = prix - achat - frais', () => { expect(core.profit({ pv: 20, achat: 5, frais: 1.5 })).toBe(13.5); });
  it('num lit les virgules', () => { expect(core.num('12,5')).toBe(12.5); expect(core.num('abc')).toBeNaN(); });
});

describe('vente groupée', () => {
  it('répartit le prix et les frais sans perdre un centime, puis annule', () => {
    app.setCfg({ fourn: [{ id: 'f1', n: 'Sachets', q: 12, seuil: 10, c: 0.08, u: 1, s: 0 }] });
    const ids = enStock(3).map(p => p.id);
    gs.openGroupSale(ids);
    $('gs_p').value = '37,33'; $('gs_p').dispatchEvent(new Event('input', { bubbles: true }));
    $('gs_f').value = '1,01'; $('gs_f').dispatchEvent(new Event('input', { bubbles: true }));
    $('gs_ok').click();
    const L = ids.map(id => app.P.find(p => p.id === id));
    expect(L.every(p => p.statut === 'Vendu' && p.lot === L[0].lot)).toBe(true);
    expect(Math.round(L.reduce((a, p) => a + p.pv, 0) * 100)).toBe(3733);
    expect(Math.round(L.reduce((a, p) => a + p.frais, 0) * 100)).toBe(101);
    expect(app.cfg.fourn[0].q).toBe(11); // un seul colis, un seul sachet
    $('tu').click(); // annuler
    expect(ids.every(id => app.P.find(p => p.id === id).statut === 'Disponible')).toBe(true);
    expect(app.cfg.fourn[0].q).toBe(12);
  });
});

describe('fournitures', () => {
  it('le stock baisse à chaque vente et remonte si on annule la vente', () => {
    const p = enStock(1)[0];
    app.save({ ...p, statut: 'Vendu', pv: 10, dv: core.today(), frais: 1, canal: 'Vinted', vt: Date.now() });
    expect(app.cfg.fourn[0].q).toBe(11);
    app.save(p);
    expect(app.cfg.fourn[0].q).toBe(12);
  });
});

describe('acheteurs', () => {
  it('la liste noire est signalée dans le formulaire de vente', () => {
    app.setCfg({ noirs: { tomtom31: { nom: 'tomtom31', m: 'Retour abusif', t: 1 } } });
    const p = enStock(1)[0];
    app.openSheet(p.id, 'sell');
    const i = $('s_ps'); i.value = '@Tomtom31'; i.dispatchEvent(new Event('input', { bubbles: true }));
    expect($('s_ps_w').textContent).toMatch(/liste noire/i);
  });
});

describe('enveloppes de fonctions (save, renderDash…)', () => {
  it('les fonctions enveloppées par plusieurs modules restent appelables', () => {
    for (const k of ['save', 'renderDash', 'renderList', 'renderAll', 'openSheet', 'toast', 'setCfg', 'openTool', 'printHTML', 'reportHTML', 'rappelsList', 'logoMark']) expect(typeof app[k], k).toBe('function');
  });
  it('le bilan reste affiché après plusieurs rendus', () => { nav.go('dash'); for (let i = 0; i < 3; i++) app.renderDash(); expect(document.querySelectorAll('[data-ck]').length).toBe(6); expect(document.querySelectorAll('[data-ck="today"]').length).toBe(1); });
});