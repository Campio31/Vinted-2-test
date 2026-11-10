import { describe, it, expect, beforeAll } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
});

describe('v45 : pastille colis sur Outils', () => {
  it('la pastille de la barre est sur Outils, plus sur Vente', async () => {
    const bg = $('nbg');
    expect(bg.closest('button').dataset.v).toBe('tools');
    expect(document.querySelector('nav [data-v="sales"] .nbg')).toBeNull();
    app.renderAll(); await tick(10);
    const n = app.colisCount();
    expect(bg.hidden).toBe(!n);
    if (n) expect(bg.textContent).toBe(String(n));
  });
});

describe('v45 : Bilan', () => {
  it('le bénéfice net est juste sous la carte Objectifs, hors onglets', async () => {
    app.setCfg({ goal: 800, goalMode: 'net', goalCA: 0 }, true);
    nav.go('dash'); app.renderDash(); await tick(30);
    const box = $('dsh'), hero = box.querySelector('.hero');
    expect(hero).not.toBeNull();
    expect(hero.previousElementSibling.classList.contains('gcard')).toBe(true);
    expect(hero.className).not.toMatch(/bt-[mas]/);
    app.setCfg({ goal: 0, goalMode: 'net', goalCA: 0 }, true);
  });
  it('chaque onglet montre 6 indicateurs ; les anciennes cartes d\'indicateurs ont disparu', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const box = $('dsh');
    for (const k of ['m', 'a', 's']) expect(box.querySelectorAll(`.btiles.bt-${k} .bkt`), k).toHaveLength(6);
    expect(box.querySelector('[data-tool="fisc"]')).toBeNull();
    expect(box.querySelector('details.bdrop')).toBeNull();
    expect(box.querySelectorAll(':scope > .kpis, :scope > .minic')).toHaveLength(0);
    /* « Personnaliser » retrouve toujours chaque carte */
    box.querySelector('[data-dcust]').click(); await tick(20);
    expect($('shc').querySelectorAll('.dcr').length).toBeGreaterThan(4);
    $('sheet').hidden = true;
  });
});
describe('v45 : compte en sélection', () => {
  it('la sélection peut être rangée dans un compte, ou en être retirée', async () => {
    app.setCfg({ comptes: [{ id: 'c1', n: 'Vinted perso', pf: 'Vinted', fiscal: true }, { id: 'c2', n: 'Vinted pro', pf: 'Vinted', fiscal: true }], cptMain: 'c1' }, true);
    const sel = await import('../src/modules/selection.js');
    const L = app.P.filter(p => p.statut === 'Disponible').slice(0, 2);
    sel.selSet(true); L.forEach(p => sel.SEL.add(p.id));
    document.querySelector('[data-sa=act]').click(); await tick(10);
    const b = $('shc').querySelector('[data-sx="cpt"]');
    expect(b).not.toBeNull();
    b.click(); await tick(10);
    $('shc').querySelector('[data-sc="c2"]').click(); await tick(20);
    L.forEach(p => expect(app.P.find(x => x.id === p.id).stk).toBe('c2'));
    sel.selSet(true); L.forEach(p => sel.SEL.add(p.id));
    document.querySelector('[data-sa=act]').click(); await tick(10);
    $('shc').querySelector('[data-sx="cpt"]').click(); await tick(10);
    $('shc').querySelector('[data-sc="-"]').click(); await tick(20);
    L.forEach(p => expect(app.P.find(x => x.id === p.id).stk).toBeUndefined());
    app.setCfg({ comptes: [], cptMain: '' }, true);
    $('sheet').hidden = true;
  });
});
describe('v47 : onglets du Bilan', () => {
  it('un seul graphique par onglet : les pastilles changent de graphique, le choix est gardé', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const box = $('dsh');
    for (const k of ['m', 'a', 's']) {
      const cartes = [...box.querySelectorAll(`.card.bt-${k}.bsel0`)];
      expect(cartes.length, k).toBeGreaterThan(1);
      expect(cartes.filter(c => c.classList.contains('bsel')), k).toHaveLength(1);
      expect(cartes.filter(c => !c.classList.contains('bnot')), k).toHaveLength(1);
      expect(box.querySelectorAll(`.bchips.bt-${k} .chip`)).toHaveLength(cartes.length);
    }
    const p = box.querySelectorAll('.bchips.bt-m .chip')[1];
    p.click();
    const sel = box.querySelector('.card.bt-m.bsel');
    expect(sel.dataset.bk).toBe(p.dataset.bk);
    app.renderDash(); await tick(20);
    expect($('dsh').querySelector('.card.bt-m.bsel').dataset.bk).toBe(p.dataset.bk);
    $('dsh').querySelector('.bchips.bt-m .chip').click();
  });  it('chaque onglet a sa couleur (classe de l\'onglet sur le Bilan)', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const bar = $('dsh').querySelector('.btabs');
    for (const k of ['m', 'a', 's']) {
      bar.querySelector(`[data-bt="${k}"]`).click();
      expect($('dsh').dataset.bt).toBe(k);
      expect(bar.querySelector(`[data-bt="${k}"]`).classList.contains('on')).toBe(true);
    }
    bar.querySelector('[data-bt="m"]').click();
  });
  it('les objectifs sont des jauges demi-cercle avec la projection en violet', async () => {
    const vendu = app.P.find(x => x.statut === 'Vendu' && (x.pv || 0) > (x.achat || 0)), dv0 = vendu.dv;
    vendu.dv = new Date().toISOString().slice(0, 10);
    app.setCfg({ goal: 100000, goalMode: 'both', goalCA: 100000 }, true);
    nav.go('dash'); app.renderDash(); await tick(30);
    const g = $('dsh').querySelector('.gcard.gaus');
    expect(g.querySelectorAll('.gau')).toHaveLength(2);
    expect(g.querySelector('.gau svg .gnd')).not.toBeNull();
    expect(g.querySelector('.gau .gpc').textContent).toMatch(/%/);
    vendu.dv = dv0;
    app.setCfg({ goal: 0, goalCA: 0, goalMode: 'net' }, true);
  });
});

describe('v47 : Ma journée se réduit à tout moment', () => {
  it('même avec des tâches, on peut réduire la carte, puis la rouvrir', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const A = await import('../src/modules/autopilot.js');
    expect(A.tasksToday().length).toBeGreaterThan(0);
    const c = $('dsh').querySelector('.ap');
    expect(c.classList.contains('apdone')).toBe(false);
    c.querySelector('[data-ap="jclose"]').click(); await tick(20);
    const r = $('dsh').querySelector('.ap');
    expect(r.classList.contains('apdone')).toBe(true);
    expect(r.querySelector('.apok').textContent.trim()).toBe(String(A.tasksToday().length));
    r.querySelector('[data-ap="jopen"]').click(); await tick(20);
    expect($('dsh').querySelector('.ap').classList.contains('apdone')).toBe(false);
  });
});
describe('v48 : flèches des indicateurs', () => {
  it('chaque tuile avec historique a une flèche, et la couleur dit si c\'est bon ou mauvais', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const box = $('dsh');
    for (const k of ['m', 'a', 's']) expect(box.querySelectorAll(`.btiles.bt-${k} .bkt .bka`), k).toHaveLength(6);
    const ts = [...box.querySelectorAll('.bka.up, .bka.dn')];
    expect(ts.length).toBeGreaterThan(2);
    ts.forEach(a => expect(/(^| )(ok|ko)( |$)/.test(a.className)).toBe(true));
    expect(box.querySelector('.hero')).not.toBeNull();
  });
});
