import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
});
afterEach(() => { $('sheet').hidden = true; });

describe('v44 : cartes du stock', () => {
  it('le grade remplace le prix visé et la marge', async () => {
    app.filt = 'Tous'; nav.go('list'); app.renderList(); await tick(30);
    const tuiles = [...$('lst').querySelectorAll('.tl.vit')];
    expect(tuiles.length).toBeGreaterThan(0);
    tuiles.forEach(c => {
      expect(c.querySelector('.mg')).toBeNull();
      expect(c.querySelector('.dot')).toBeNull();
      expect(c.querySelector('.pr small')).toBeNull();
    });
    /* v48 : le grade n'est plus une pastille, il colore le contour de la carte */
    tuiles.forEach(c => expect(c.querySelector('.pr.gr')).toBeNull());
    const avecGrade = tuiles.find(c => /(^| )gr-[ABC]( |$)/.test(c.className));
    expect(avecGrade).toBeTruthy();
  });
});

describe('v44 : colis à préparer', () => {
  it('plus d\'indicateur dans l\'onglet Vente, une pastille sur l\'outil Colis', async () => {
    nav.go('sales'); app.salesFilter('all'); await tick(30);
    expect($('ssum').querySelector('[data-sprep]')).toBeNull();
    expect($('slst').querySelector('.tag.x')).toBeNull();
    const n = app.colisCount();
    nav.go('tools'); app.renderTools(); await tick(20);
    const b = $('tv').querySelector('[data-tool="colis"] .tbd');
    if (n) { expect(b).not.toBeNull(); expect(b.textContent).toBe(String(n)); } else expect(b).toBeNull();
  });
});

describe('v44 : Ajouter sans prix visé', () => {
  it('plus de champ de prix visé ; le prix conseillé est dans le potentiel de vente', async () => {
    nav.go('add'); app.addForm.draw(); await tick(20);
    expect($('fv')).toBeNull();
    expect($('fadd').querySelector('[data-sec="renta"]')).toBeNull();
    const S = app.addForm.state, p0 = app.P.find(x => x.statut === 'Vendu');
    S.cat = p0.cat; S.marque = p0.marque; app.addForm.draw(); await tick(20);
    const ra = app.advice(S);
    if (ra.ok && ra.reco > 0) expect($('pot').textContent).toMatch(/conseillé|Suggested/i);
    expect($('pot')).not.toBeNull();
  });
});

describe('v44 : comptes, Ajouter et Stock', () => {
  it('une pièce peut être rattachée à un compte, et le stock se range par compte', async () => {
    app.setCfg({ comptes: [{ id: 'c1', n: 'Vinted perso', pf: 'Vinted', fiscal: true }, { id: 'c2', n: 'Vinted pro', pf: 'Vinted', fiscal: true }], cptMain: 'c1' }, true);
    nav.go('add'); app.addForm.draw(); await tick(20);
    $('fadd').querySelector('[data-step="3"]').click();
    const sec = $('fadd').querySelector('[data-sec="stk"]');
    expect(sec).not.toBeNull();
    $('fadd').querySelector('[data-tg="stk"]').click();
    $('fadd').querySelector('[data-f="stk"][data-v="c2"]').click();
    expect(app.addForm.state.stk).toBe('c2');
    /* deux pièces en stock, l'une sur chaque compte */
    const dispo = app.P.filter(p => p.statut === 'Disponible');
    app.save(Object.assign({}, dispo[0], { stk: 'c1' }));
    app.save(Object.assign({}, dispo[1], { stk: 'c2' }));
    app.filt = 'Tous'; nav.go('list'); app.renderList(); await tick(20);
    $('flt').querySelector('[data-fadv]').click();
    expect($('shc').querySelector('[data-fg="stk"][data-fv="c2"]')).not.toBeNull();
    $('shc').querySelector('[data-fg="stk"][data-fv="c2"]').click();
    $('fl_ok').click(); await tick(20);
    const ids = [...$('lst').querySelectorAll('.tl[data-id], .tl .im')].map(e => e.dataset.id);
    expect(ids).toContain(dispo[1].id);
    expect(ids).not.toContain(dispo[0].id);
    /* regroupé par compte : un titre par compte */
    $('lst').querySelector('[data-fclr="*"]').click(); await tick(20);
    $('flt').querySelector('[data-fadv]').click();
    $('shc').querySelector('[data-fg="grp"][data-fv="stk"]').click();
    $('fl_ok').click(); await tick(20);
    const titres = [...$('lst').querySelectorAll('.stkh')].map(h => h.textContent);
    expect(titres.some(x => x.includes('Vinted pro'))).toBe(true);
    expect(titres.some(x => x.includes('Vinted perso'))).toBe(true);
    /* la vente propose le compte du stock */
    const vendu = app.save(Object.assign({}, app.P.find(x => x.id === dispo[1].id), { statut: 'Vendu', pv: 20, dv: new Date().toISOString().slice(0, 10), canal: 'Vinted' }));
    expect(vendu.cpt).toBe('c2');
    $('lst').querySelector('[data-fclr="*"]') && $('lst').querySelector('[data-fclr="*"]').click();
    app.setCfg({ comptes: [], cptMain: '' }, true);
  });
});

describe('v44 : Bilan en onglets', () => {
  it('trois onglets : chaque carte est dans un seul, les autres sont masquées', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const box = $('dsh'), bar = box.querySelector('.btabs');
    expect(bar).not.toBeNull();
    expect(bar.querySelectorAll('[data-bt]')).toHaveLength(3);
    expect(box.dataset.bt).toBe('m');
    const tous = [...box.children].filter(el => /(^| )bt-[mas]( |$)/.test(el.className));
    expect(tous.length).toBeGreaterThan(3);
    tous.forEach(el => expect(el.className.match(/bt-[mas]/g)).toHaveLength(1));
    const de = k => tous.filter(el => el.classList.contains('bt-' + k));
    ['m', 'a', 's'].forEach(k => expect(de(k).length, k).toBeGreaterThan(0));
    expect(box.querySelector('.btiles.bt-m [data-tool="treso"]')).not.toBeNull();
    expect(box.querySelector('.btiles.bt-a [data-tool="trophees"]')).not.toBeNull();
    bar.querySelector('[data-bt="a"]').click();
    expect(box.dataset.bt).toBe('a');
    expect(bar.querySelector('[data-bt="a"]').classList.contains('on')).toBe(true);
    /* la barre est placée juste avant la première carte classée */
    expect(bar.nextElementSibling).toBe(tous[0]);
    /* l'onglet est gardé après un nouveau dessin */
    app.renderDash(); await tick(20);
    expect($('dsh').dataset.bt).toBe('a');
    $('dsh').querySelector('[data-bt="m"]').click();
  });
});
