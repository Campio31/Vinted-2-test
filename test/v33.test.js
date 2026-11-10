import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';
import { addDays, today } from '../src/modules/core.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
const MICRO = { statut: 'micro', activite: 'march', creation: '2020-01-01', vl: 'bareme', tva: 'franchise', periode: 'M' };
let nav, tools, F, R, comp, dd, buy;
beforeAll(async () => {
  await demarrer(120);
  app.setCfg({ fiscQ: MICRO }, true);
  nav = await import('../src/modules/nav.js');
  tools = await import('../src/modules/tools-index.js');
  F = await import('../src/modules/fiscal.js');
  R = await import('../src/modules/fiscal-rules.js');
  comp = await import('../src/modules/complete.js');
  dd = await import('../src/modules/dedupe.js');
  buy = await import('../src/modules/buyers.js');
});
afterEach(() => { $('sheet').hidden = true; app.P = app.P.filter(p => !p.id.startsWith('v33-')); });
const base = () => app.P.find(p => p.statut === 'Disponible');

describe('Ligne fiscale : règles déduites du questionnaire', () => {
  it('micro-entrepreneur : plafond, TVA et cotisations', () => {
    const d = R.deriveFisc(MICRO);
    expect(d).toMatchObject({ fiscOn: true, plafond: 203100, plafondTva: 85000, tauxSoc: 12.3, vl: 0, periode: 'M' });
  });
  it('ACRE la première année, versement libératoire, TVA facturée, trimestre', () => {
    const d = R.deriveFisc({ statut: 'micro', creation: addDays(today(), -100), acre: 'oui', vl: 'liberatoire', tva: 'assujetti', periode: 'T' });
    expect(d.tauxSoc).toBe(9.23);
    expect(d).toMatchObject({ vl: 1, plafondTva: 0, periode: 'T', acreOn: true });
    expect(R.deriveFisc({ statut: 'micro', creation: '2020-01-01', acre: 'oui' }).tauxSoc).toBe(12.3);
  });
  it('particulier ou autre statut : pas de plafond', () => {
    expect(R.deriveFisc({ statut: 'part' }).plafond).toBe(0);
    expect(R.deriveFisc({ statut: 'autre' }).fiscOn).toBe(false);
  });
  it('le plafond est réduit au prorata la première année', () => {
    const y = new Date().getFullYear();
    app.setCfg({ fiscQ: Object.assign({}, MICRO, { creation: y + '-07-01' }) }, true);
    const p = R.prorata(203100, y);
    expect(p).toBeLessThan(203100);
    expect(p).toBeGreaterThan(80000);
    expect(R.prorata(203100, y - 1)).toBe(203100);
    app.setCfg({ fiscQ: MICRO }, true);
  });
  it('les réglages ne se tapent plus à la main', async () => {
    await app.openTool('fisc'); await tick(20);
    for (const id of ['f_pl', 'f_tx', 'f_tv', 'f_fj']) expect($(id), id).toBeNull();
    expect($('fs_q')).toBeTruthy();
    expect($('shc').textContent).toContain(t('Tes réglages fiscaux'));
  });
  it('sans réponse, Ligne fiscale pose les questions ; un particulier a son propre écran', async () => {
    app.setCfg({ fiscQ: null }, true);
    await app.openTool('fisc'); await tick(20);
    $('fs_q').click(); await tick(20);
    $('shc').querySelector('[data-wzgo]') && $('shc').querySelector('[data-wzgo]').click();
    $('shc').querySelector('[data-wzo="part"]').click(); await tick(20);
    expect(app.cfg.fiscQ.statut).toBe('part');
    expect(app.cfg.plafond).toBe(0);
    expect($('shc').textContent).toMatch(/30/);
    app.setCfg({ fiscQ: MICRO }, true); R.syncFisc();
  });
});

describe('Ligne fiscale : graphique et périodes', () => {
  it('le graphique montre le réel, la projection et le plafond, et plus de « marge confortable »', async () => {
    await app.openTool('fisc'); await tick(20);
    expect($('shc').querySelector('svg.fcg')).toBeTruthy();
    expect($('shc').querySelector('.fc-l')).toBeTruthy();
    expect($('shc').textContent).not.toMatch(/Marge confortable|Comfortable margin/i);
  });
  it('les périodes de déclaration partent de la plus ancienne pièce', () => {
    const old = F.oldestDate();
    for (const k of ['M', 'T']) {
      const L = F.periodsList(k);
      expect(L.length).toBeGreaterThan(0);
      const last = L[L.length - 1];
      expect(last.start <= old && old <= last.end || L.length === 1).toBe(true);
      expect(L[L.length - 2] ? L[L.length - 2].end >= old : true).toBe(true);
    }
    const p = Object.assign({}, base(), { id: 'v33-old', entree: '2024-02-10' });
    app.P.push(p);
    expect(F.oldestDate()).toBe('2024-02-10');
    expect(F.periodsList('M').pop().key).toBe('2024-02');
    expect(F.periodsList('T').pop().key).toBe('2024-T1');
  });
});

describe('Fiches à compléter', () => {
  it('une marque « Non identifié » n\'est jamais à compléter, une marque vide oui', () => {
    const p = Object.assign({}, base(), { id: 'v33-a', marque: 'Non identifié', grade: '', etat: '' });
    const q = Object.assign({}, p, { id: 'v33-b', marque: '' });
    expect(comp.incomplete(p)).toBe(false);
    expect(comp.incomplete(q)).toBe(true);
    expect(comp.missingFields(q)).toContain('marque');
  });
  it('la liste montre de quoi reconnaître la pièce et chaque ligne mène à sa fiche', async () => {
    app.P.push(Object.assign({}, base(), { id: 'v33-c', marque: 'Nike', grade: '', modele: 'Air Zoom', coul: ['Bleu'], bac: 'Z4', note: 'tache col' }));
    await app.openTool('complete'); await tick(20);
    const row = $('shc').querySelector('[data-cpone="v33-c"]');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Z4');
    row.click(); await tick(20);
    expect($('shc').querySelector('.cpd').textContent).toMatch(/Air Zoom/);
    expect($('shc').querySelector('.cpd').textContent).toMatch(/tache col/);
  });
});

describe('Nettoyer les doublons : le code ne change jamais', () => {
  it('fusionner deux orthographes de marque garde le code de chaque pièce', () => {
    const a = Object.assign({}, base(), { id: 'v33-m1', marque: 'Brooks Brother', code: 'ZZTEST-001' }), b = Object.assign({}, base(), { id: 'v33-m2', marque: 'Brooks Brothers', code: 'ZZTEST-002' });
    app.P.push(a, b);
    expect(dd.mergeValues('marque', 'Brooks Brother', 'Brooks Brothers')).toBe(1);
    expect(app.P.find(p => p.id === 'v33-m1')).toMatchObject({ marque: 'Brooks Brothers', code: 'ZZTEST-001' });
    expect(app.P.find(p => p.id === 'v33-m2').code).toBe('ZZTEST-002');
  });
});

describe('Réglages : Confort et Aide ne sont plus des outils', () => {
  it('la liste d\'outils ne les contient plus, les cartes sont dans Réglages et repliées', async () => {
    const k = tools.TOOLS.map(x => x.k);
    for (const x of ['aide', 'confort', 'seuil', 'fourn']) expect(k, x).not.toContain(x);
    localStorage.removeItem('setOpen');
    nav.go('set'); app.renderSet(); await tick(30);
    expect($('cfc').classList.contains('shut')).toBe(true);
    expect($('hlp').classList.contains('shut')).toBe(true);
    expect($('cc_o')).toBeTruthy();
    expect($('hlp').querySelector('[data-tool="aide"]')).toBeTruthy();
    $('cc_o').checked = true; $('cc_o').dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.cfg.onehand).toBe(true);
    $('cc_o').checked = false; $('cc_o').dispatchEvent(new Event('change', { bubbles: true }));
    $('hlp').querySelector('[data-tool="aide"]').click(); await tick(20);
    expect($('sheet').hidden).toBe(false);
  });
});

describe('Colis à préparer : filtre par jour', () => {
  it('chaque jour de vente a son bouton et filtre la liste', async () => {
    const mk = (id, dv) => Object.assign({}, base(), { id, statut: 'Vendu', pv: 10, dv, vt: Date.now(), frais: 1, canal: 'Vinted', acheteur: 'zed' });
    app.P = app.P.filter(p => !(p.statut === 'Vendu' && !p.exp && p.vt && Date.now() - p.vt <= 14 * 864e5));
    app.P.push(mk('v33-c1', today()), mk('v33-c2', today()), mk('v33-c3', addDays(today(), -1)));
    await app.openTool('colis'); await tick(20);
    const chips = [...$('shc').querySelectorAll('[data-cd]')];
    expect(chips).toHaveLength(3);
    expect($('colb').querySelectorAll('.pre').length).toBe(3);
    chips.find(c => c.dataset.cd === addDays(today(), -1)).click();
    expect($('colb').querySelectorAll('.pre').length).toBe(1);
    $('shc').querySelector('[data-cd=""]').click();
    expect($('colb').querySelectorAll('.pre').length).toBe(3);
  });
});

describe('Acheteurs : fidèle dès 2 achats, liste noire sur retour de sa faute', () => {
  it('un retour de sa faute met l\'acheteur en liste noire, un autre retour non', () => {
    const mk = (id, ps, f) => Object.assign({}, base(), { id, acheteur: ps, retours: [{ d: today(), p: 5, a: ps, m: 'Taille', f: f ? 1 : undefined }] });
    app.P.push(mk('v33-r1', 'mauvais_payeur', true), mk('v33-r2', 'gentil', false));
    expect(buy.buyerLine('mauvais_payeur')).toMatch(/liste noire|blacklist/i);
    expect(buy.buyerLine('gentil')).not.toMatch(/liste noire|blacklist/i);
  });
  it('la fiche de retour propose la case « de sa faute » et l\'enregistre', async () => {
    const s = Object.assign({}, base(), { id: 'v33-s', statut: 'Vendu', pv: 12, dv: today(), canal: 'Vinted', frais: 1, vt: Date.now(), acheteur: 'fautif' });
    app.P.push(s);
    app.openSheet('v33-s', 'ret'); await tick(20);
    expect($('r_f')).toBeTruthy();
    $('r_f').checked = true;
    $('r_ok').click(); await tick(20);
    const r = app.P.find(p => p.id === 'v33-s').retours[0];
    expect(r).toMatchObject({ f: 1, a: 'fautif' });
    expect(buy.buyerLine('fautif')).toMatch(/liste noire|blacklist/i);
  });
  it('un acheteur est fidèle dès 2 commandes', async () => {
    const mk = (id) => Object.assign({}, base(), { id, statut: 'Vendu', pv: 9, dv: today(), canal: 'Vinted', frais: 1, vt: Date.now(), acheteur: 'fidele_x' });
    app.P.push(mk('v33-f1'), mk('v33-f2'));
    await app.openTool('buyers'); await tick(20);
    expect($('shc').textContent).toContain('fidele_x');
    expect($('by_add')).toBeNull();
  });
});

describe('Seuil de rentabilité et fournitures : questionnaires, plus des outils', () => {
  it('le questionnaire du seuil remplace les frais fixes et crée l\'apport', async () => {
    app.setCfg({ fixes: [{ n: 'vieux', v: 5, p: 'M' }], apports: [] });
    await app.openTool('seuil'); await tick(20);
    $('sq_go').click(); await tick(10);
    $('shc').querySelector('[data-wzgo]').click(); await tick(10);
    $('wz_abo').value = '20'; $('wz_tel').value = '10';
    $('shc').querySelector('[data-wzn]').click(); await tick(10);
    $('wz_n').value = '15';
    $('shc').querySelector('[data-wzn]').click(); await tick(20);
    expect(app.cfg.fixes.map(f => f.v)).toEqual([20, 10]);
    expect(app.cfg.apports.some(a => a.v === 15 && a.q)).toBe(true);
    expect($('shc').textContent).toContain(t('Seuil de rentabilité'));
  });
  it('le questionnaire des fournitures crée les articles choisis', async () => {
    app.setCfg({ fourn: [] });
    await app.openTool('fourn'); await tick(20);
    $('fq_go').click(); await tick(10);
    $('shc').querySelector('[data-wzgo]').click(); await tick(10);
    $('shc').querySelector('[data-wzm="sachets"]').click();
    $('shc').querySelector('[data-wzn]').click(); await tick(10);
    $('wz_sachets_q').value = '100'; $('wz_sachets_c').value = '0,05'; $('wz_sachets_u').value = '1'; $('wz_sachets_seuil').value = '20';
    $('shc').querySelector('[data-wzn]').click(); await tick(20);
    expect(app.cfg.fourn).toHaveLength(1);
    expect(app.cfg.fourn[0]).toMatchObject({ id: 'q-sachets', q: 100, u: 1, seuil: 20 });
  });
  it('le Bilan affiche ces deux cartes d\'office, avec le bouton du questionnaire', async () => {
    app.setCfg({ dash: null });
    nav.go('dash'); app.renderDash(); await tick(30);
    for (const k of ['seuil', 'fourn']) {
      const c = document.querySelector(`#dsh [data-ck="${k}"]`);
      expect(c, k).toBeTruthy();
      expect(c.style.display, k).not.toBe('none');
      expect(c.querySelector('[data-qz]'), k).toBeTruthy();
    }
  });
});
