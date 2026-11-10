import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const jour = n => iso(new Date(Date.now() + n * 864e5));
let nav, fin;
beforeAll(async () => {
  await demarrer(150);
  app.setCfg({ fiscQ: { statut: 'micro', activite: 'march', creation: '2020-01-01', vl: 'bareme', tva: 'franchise', periode: 'M' } }, true);
  nav = await import('../src/modules/nav.js');
  fin = await import('../src/modules/finalisation.js');
});

const PRO = { id: 'cpro', n: 'Vinted pro', pf: 'Vinted', k: 'pro', fiscal: true, com: 5 };
const PERSO = { id: 'cperso', n: 'Vinted perso', pf: 'TikTok Live', k: 'perso', fiscal: false };
const avecComptes = () => app.setCfg({ comptes: [PRO, PERSO], cptMain: 'cpro' }, true);
const sansComptes = () => app.setCfg({ comptes: [], cptMain: '' }, true);
const montant = s => parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.'));
afterEach(() => { sansComptes(); app.P = app.P.filter(p => !p.id.startsWith('cp-')); $('sheet').hidden = true; localStorage.removeItem('lastCompte'); });

describe('comptes de vente : sans compte, rien ne change', () => {
  it('toutes les ventes comptent, la fenêtre de vente n\'a pas de choix de compte', async () => {
    expect(app.hasComptes()).toBe(false);
    expect(app.P.filter(p => p.statut === 'Vendu').every(app.countsForFisc)).toBe(true);
    const p = app.P.find(x => x.statut === 'Disponible');
    app.openSheet(p.id, 'sell'); await tick(20);
    expect($('s_cpt')).toBeNull();
  });
});

describe('comptes de vente : rattachement des ventes', () => {
  it('les ventes d\'avant les comptes vont au compte de leur plateforme, sinon au principal', () => {
    avecComptes();
    const vinted = app.P.find(p => p.statut === 'Vendu' && p.canal === 'Vinted'), live = app.P.find(p => p.statut === 'Vendu' && p.canal === 'TikTok Live');
    expect(app.compteOf(vinted).id).toBe('cpro');
    expect(app.compteOf(live).id).toBe('cperso');
    expect(app.compteOf({ canal: 'Autre' }).id).toBe('cpro');
  });
  it('une nouvelle vente reçoit son compte, une pièce remise en stock le perd', () => {
    avecComptes();
    const p = Object.assign({}, app.P.find(x => x.statut === 'Disponible'), { id: 'cp-1' });
    app.P.push(p);
    app.save(Object.assign({}, p, { statut: 'Vendu', pv: 30, dv: jour(-1), canal: 'TikTok Live', frais: 1, vt: Date.now() }));
    expect(app.P.find(x => x.id === 'cp-1').cpt).toBe('cperso');
    app.save(Object.assign({}, app.P.find(x => x.id === 'cp-1'), { statut: 'Disponible' }));
    expect(app.P.find(x => x.id === 'cp-1').cpt).toBeUndefined();
  });
  it('modifier une ancienne vente ne lui colle pas un compte à la volée', () => {
    avecComptes();
    const v = app.P.find(p => p.statut === 'Vendu' && p.canal === 'Vinted');
    app.save(Object.assign({}, v, { note: 'test' }));
    expect(app.P.find(x => x.id === v.id).cpt).toBeUndefined();
  });
});

describe('comptes de vente : frais', () => {
  it('la commission du compte remplace celle de la plateforme', () => {
    app.setCfg({ emb: 0.5, port: 0, comV: 10, comT: 0 }, true);
    expect(app.defFrais(100, 'Vinted')).toBe(10.5);
    avecComptes();
    expect(app.defFrais(100, 'Vinted', 'cpro')).toBe(5.5);
    expect(app.defFrais(100, 'Vinted')).toBe(5.5);
    expect(app.defFrais(100, 'TikTok Live', 'cperso')).toBe(0.5);
  });
});

describe('comptes de vente : fenêtre de vente', () => {
  it('propose les comptes, change plateforme et frais, et enregistre le compte choisi', async () => {
    app.setCfg({ emb: 0, port: 0, comV: 10, comT: 8 }, true);
    avecComptes();
    const p = Object.assign({}, app.P.find(x => x.statut === 'Disponible'), { id: 'cp-2' });
    app.P.push(p);
    app.openSheet('cp-2', 'sell'); await tick(20);
    expect($('s_cpt').querySelectorAll('[data-cptc]').length).toBe(2);
    expect($('s_cpt').dataset.sel).toBe('cpro');
    $('s_prix').value = '100'; $('s_prix').dispatchEvent(new Event('input', { bubbles: true }));
    expect(montant($('s_frais').value)).toBe(5);
    $('s_cpt').querySelector('[data-cptc="cperso"]').click(); await tick(20);
    expect($('s_cpt').dataset.sel).toBe('cperso');
    expect(app.pfKey($('s_plat').value)).toBe('TikTok Live');
    expect(montant($('s_frais').value)).toBe(8);
    $('s_ok').click(); await tick(30);
    const v = app.P.find(x => x.id === 'cp-2');
    expect(v.statut).toBe('Vendu');
    expect(v.cpt).toBe('cperso');
    expect(v.canal).toBe('TikTok Live');
    app.openSheet('cp-2'); await tick(20);
    expect($('shc').textContent).toContain('Vinted perso');
    expect($('shc').textContent).toMatch(/Hors déclaration|Not declared/);
    expect($('a_fin')).toBeNull();
  });
  it('changer la plateforme à la main change aussi le compte', async () => {
    avecComptes();
    const p = Object.assign({}, app.P.find(x => x.statut === 'Disponible'), { id: 'cp-3' });
    app.P.push(p);
    app.openSheet('cp-3', 'sell'); await tick(20);
    document.querySelector('[data-t="s_plat"][data-v="TikTok Live"]').click(); await tick(20);
    expect($('s_cpt').dataset.sel).toBe('cperso');
  });
});

describe('comptes de vente : déclaration URSSAF', () => {
  it('un compte non pris en compte est exclu du chiffre d\'affaires à déclarer et des ventes à finaliser', async () => {
    avecComptes();
    const base = app.P.find(x => x.statut === 'Disponible');
    const DV = jour(0) >= '2026-10-31' ? jour(0) : '2026-10-31';
    app.P.push(Object.assign({}, base, { id: 'cp-4', statut: 'Vendu', pv: 40, dv: DV, canal: 'Vinted', frais: 1, vt: Date.now(), cpt: 'cpro' }),
      Object.assign({}, base, { id: 'cp-5', statut: 'Vendu', pv: 60, dv: DV, canal: 'TikTok Live', frais: 1, vt: Date.now(), cpt: 'cperso' }));
    const ids = fin.pendingSales().map(p => p.id);
    expect(ids).toContain('cp-4');
    expect(ids).not.toContain('cp-5');
    const y = jour(0).slice(0, 4);
    const attendu = app.P.filter(p => { const d = fin.finDate(p); return d && d.startsWith(y) && d <= jour(0) && app.countsForFisc(p); }).reduce((a, p) => a + (p.pv || 0), 0);
    await app.openTool('fisc'); await tick(30);
    /* le gros chiffre est affiché en deux morceaux (euros, centimes) : on compare les chiffres seuls, en centimes */
    expect(document.querySelector('#shc .gbig').textContent.replace(/\D/g, '')).toBe(String(Math.round(attendu * 100)));
    expect($('shc').textContent).toMatch(/Vinted pro/);
    expect($('shc').textContent).toMatch(/Vinted perso/);
  });
});

describe('comptes de vente : Vente et Bilan', () => {
  it('l\'onglet Vente se filtre par compte', async () => {
    avecComptes();
    nav.go('sales'); app.salesFilter('all'); await tick(30);
    $('sflt').querySelector('[data-sfadv]').click();
    expect($('shc').querySelectorAll('[data-fg="cf"]').length).toBe(2);
    const tout = $('slst').querySelectorAll('.li').length;
    $('shc').querySelector('[data-fg="cf"][data-fv="cperso"]').click(); await tick(20); document.getElementById('fl_ok').click();
    const n = $('slst').querySelectorAll('.li').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(tout);
    $('sflt').querySelector('[data-sf="all"]').click(); await tick(20);
  });
  it('le Bilan se filtre par compte et affiche la carte Par compte', async () => {
    avecComptes();
    nav.go('dash'); app.period = 0; app.cptFilt = ''; app.renderDash(); await tick(30);
    $('per').querySelector('[data-badv]').click();
    expect($('shc').querySelectorAll('[data-fg="cf"]').length).toBe(2);
    document.getElementById('fl_ok').click();
    expect($('dsh').textContent).toMatch(/Par compte|By account/);
    const hero = () => $('dsh').querySelector('.hero .s').textContent;
    const tout = hero();
    $('per').querySelector('[data-badv]').click(); $('shc').querySelector('[data-fg="cf"][data-fv="cperso"]').click(); await tick(20); document.getElementById('fl_ok').click();
    expect(hero()).not.toBe(tout);
    app.cptFilt = ''; app.renderDash();
  });
});

describe('comptes de vente : Réglages', () => {
  it('ajouter, régler et supprimer un compte', async () => {
    nav.go('set'); await tick(30);
    expect($('cptc').textContent).toMatch(/Comptes de vente|Selling accounts/);
    $('cp_add').click(); await tick(20);
    expect(app.cfg.comptes.length).toBe(1);
    expect(app.cfg.cptMain).toBe(app.cfg.comptes[0].id);
    const id = app.cfg.comptes[0].id;
    $('cptc').querySelector('[data-ck="perso"]').click(); await tick(20);
    expect(app.cfg.comptes[0]).toMatchObject({ k: 'perso', fiscal: false });
    const c = $('cp_c_' + id); c.value = '3,5'; c.dispatchEvent(new Event('change', { bubbles: true })); await tick(20);
    expect(app.cfg.comptes[0].com).toBe(3.5);
    $('cptc').querySelector('[data-cdel]').click(); await tick(20);
    expect(app.cfg.comptes.length).toBe(0);
  });
});
