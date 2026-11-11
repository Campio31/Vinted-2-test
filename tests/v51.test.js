import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
let nav, F, CRM, TU;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
  F = await import('../src/modules/form.js');
  CRM = await import('../src/modules/crm.js');
  TU = await import('../src/modules/tutorial.js');
});
afterEach(() => { $('sheet').hidden = true; });

describe('v51 : Syno, nom et logo', () => {
  it('l\'appli s\'appelle Syno partout', () => {
    expect(lire('index.html')).toContain('<title>Syno</title>');
    expect(lire('public/manifest.webmanifest')).toMatch(/"name": "Syno"/);
    expect(lire('public/i18n.js')).not.toMatch(/\bMax\b/);
    expect(lire('src/modules/tools-register.js')).not.toMatch(/\bMax\b/);
  });
  it('le mouton est le logo : page, icônes de l\'appli', () => {
    expect(lire('index.html')).toContain('viewBox="0 0 200 200"');
    expect(lire('public/icons/logo.svg')).toContain('#f3ead7');
    for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
      const b = fs.readFileSync(path.resolve(process.cwd(), 'public/icons', f));
      expect(b.subarray(1, 4).toString()).toBe('PNG');
      expect(b.length).toBeGreaterThan(3000);
    }
  });
});

describe('v51 : code article court et daté', () => {
  it('année + mois + 4 caractères sans ambiguïté, unique, et qui ne change plus', () => {
    const vus = new Set();
    for (let i = 0; i < 300; i++) { const c = F.newCode(); expect(c).toMatch(/^\d{4}-[A-HJ-NP-Z2-9]{4}$/); vus.add(c); }
    expect(vus.size).toBeGreaterThan(295);
    const d = new Date(), ym = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0');
    expect(F.newCode().slice(0, 4)).toBe(ym);
    expect(F.genCode({ code: 'ANCIEN-001' })).toBe('ANCIEN-001');
    expect(F.genCode({ _code: '2611-ABCD' })).toBe('2611-ABCD');
    app.P.forEach(p => { p.code = '2611-AAAA'; });
    expect(F.newCode()).not.toBe('2611-AAAA');
  });
  it('le formulaire affiche un code stable et l\'attribue à la pièce ajoutée', async () => {
    nav.go('add'); app.addForm.draw(); await tick(20);
    const lu = () => $('cdp').textContent;
    const a = lu(); app.addForm.draw(); await tick(10);
    expect(lu()).toBe(a);
    expect(a).toMatch(/\d{4}-[A-HJ-NP-Z2-9]{4}/);
    const S = app.addForm.state; Object.assign(S, { cat: 'Short', sub: 'Sport', marque: 'Nike', achat: '3' });
    const avant = app.P.length; app.addForm.draw();
    $('fok').click(); await tick(30);
    expect(app.P.length).toBe(avant + 1);
    expect(app.P[0].code).toBe(a.match(/\d{4}-[A-HJ-NP-Z2-9]{4}/)[0]);
    expect(app.P[0]._code).toBeUndefined();
  });
});

describe('v51 : Ajouter sur ordinateur, fiche à droite', () => {
  it('la fiche se construit pendant la saisie', async () => {
    nav.go('add'); await tick(10);
    expect($('fprev')).not.toBeNull();
    expect($('fadd').nextElementSibling).toBe($('fprev'));
    const S = app.addForm.state; Object.assign(S, { cat: 'Pantalon', sub: 'Slim', marque: 'Levis', taille: 'M', grade: 'A', coul: ['Bleu'] });
    app.addForm.draw(); await tick(20);
    const p = $('fprev');
    expect(p.textContent).toContain('Levis');
    expect(p.querySelector('.pill.g-A')).not.toBeNull();
    expect(p.querySelector('.fpc')).not.toBeNull();
    expect(p.querySelector('.fpm i').style.width).not.toBe('0%');
    expect(p.querySelector('.fpc2').textContent).toMatch(/\d{4}-/);
  });
});

describe('v51 : tutoriel', () => {
  it('chapitres dans Outils, détail et visite guidée reprenable', async () => {
    expect(app.toolsView().list.some(x => x.k === 'tuto')).toBe(true);
    localStorage.removeItem('tourPos'); localStorage.removeItem('tourDone');
    await app.openTool('tuto'); await tick(10);
    const ch = [...$('shc').querySelectorAll('[data-tc]')].map(b => b.dataset.tc);
    expect(ch).toEqual(['add', 'stock', 'vente', 'bilan', 'outils', 'reglages']);
    expect($('shc').querySelector('[data-tg="resume"]')).toBeNull();
    /* détail d'un chapitre : étapes écrites + bouton pour se faire montrer */
    $('shc').querySelector('[data-tc="outils"]').click(); await tick(10);
    expect($('shc').querySelectorAll('.tuto-l li').length).toBeGreaterThan(6);
    expect($('shc').querySelectorAll('[data-open]').length).toBeGreaterThan(8);
    $('shc').querySelector('[data-tg="show"]').click(); await tick(300);
    expect($('tour').hidden).toBe(false);
    expect(TU.tourActive()).toBe(true);
    expect(app.view).toBe('tools');
    expect($('tour').querySelector('.tmeta').textContent).toMatch(/1 /);
    $('tour').querySelector('[data-tn=next]').click(); await tick(250);
    expect($('tour').querySelector('.tt').textContent.length).toBeGreaterThan(2);
    /* on quitte : la position est gardée et le tutoriel propose de reprendre */
    $('tour').querySelector('[data-tn=quit]').click();
    expect($('tour').hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem('tourPos'))).toMatchObject({ c: 'outils', i: 1 });
    await app.openTool('tuto'); await tick(10);
    expect($('shc').querySelector('[data-tg="resume"]')).not.toBeNull();
    $('shc').querySelector('[data-tg="resume"]').click(); await tick(300);
    expect($('tour').hidden).toBe(false);
    expect($('tour').querySelector('.tmeta').textContent).toMatch(/2 /);
    $('tour').querySelector('[data-tn=quit]').click();
  });
  it('terminer tous les chapitres les coche ; chaque étape s\'affiche sans erreur', async () => {
    localStorage.removeItem('tourPos'); localStorage.removeItem('tourDone');
    TU.startTour('add', 0); await tick(250);
    let n = 0;
    while (TU.tourActive() && n < 80) { const b = $('tour').querySelector('[data-tn=next]'); if (/Terminer|Finish/.test(b.textContent)) { b.click(); break; } b.click(); await tick(220); n++; }
    expect(TU.tourActive()).toBe(false);
    expect($('tour').hidden).toBe(true);
    const dn = JSON.parse(localStorage.getItem('tourDone'));
    ['add', 'stock', 'vente', 'bilan', 'outils', 'reglages'].forEach(k => expect(dn[k], k).toBe(1));
    expect(localStorage.getItem('tourPos')).toBe('null');
  }, 30000);
});

describe('v51 : Stock en mode CRM', () => {
  it('un onglet CRM (test) : pipeline en 6 colonnes, chaque pièce dans la bonne', async () => {
    app.filt = 'Tous'; nav.go('list'); await tick(20);
    expect($('smode').querySelectorAll('[data-smode]')).toHaveLength(2);
    $('smode').querySelector('[data-smode="crm"]').click(); await tick(20);
    expect($('crm').hidden).toBe(false);
    expect($('lst').hidden).toBe(true);
    expect($('crm').querySelectorAll('.cxcol')).toHaveLength(6);
    expect($('crm').querySelectorAll('.cxks .cxk')).toHaveLength(4);
    const dispo = app.P.filter(p => p.statut === 'Disponible');
    dispo.slice(0, 3).forEach(p => expect(['brouillon', 'ligne', 'offre']).toContain(CRM.stageOf(p)));
    const n = s => $('crm').querySelector(`[data-stage="${s}"] .cxn`).textContent;
    expect(+n('brouillon')).toBe(dispo.filter(p => !p.pub).length);
    expect(+n('ligne')).toBe(dispo.filter(p => p.pub && p.crm !== 'offre').length);
    $('smode').querySelector('[data-smode="stock"]').click(); await tick(20);
    expect($('lst').hidden).toBe(false);
    expect($('crm').hidden).toBe(true);
  });
  it('faire avancer une pièce enregistre vraiment l\'action', async () => {
    const p = app.P.find(x => x.statut === 'Disponible' && !x.pub);
    CRM.moveTo(p.id, 'ligne');
    expect(app.P.find(x => x.id === p.id).pub).toBe(new Date().toISOString().slice(0, 10));
    expect(CRM.stageOf(app.P.find(x => x.id === p.id))).toBe('ligne');
    CRM.moveTo(p.id, 'brouillon');
    expect(app.P.find(x => x.id === p.id).pub).toBeUndefined();
    /* offre reçue : une fenêtre demande pseudo et montant */
    CRM.moveTo(p.id, 'offre'); await tick(10);
    $('of_a').value = '@lea_test'; $('of_m').value = '12,5';
    $('of_ok').click(); await tick(10);
    const q = app.P.find(x => x.id === p.id);
    expect(q.crm).toBe('offre');
    expect(q.offre).toMatchObject({ a: 'lea_test', m: 12.5 });
    expect(CRM.stageOf(q)).toBe('offre');
    /* l'acheteur apparaît, avec son offre */
    const c = CRM.contacts().find(x => x.k === 'lea_test');
    expect(c).toBeTruthy();
    expect(c.offres).toHaveLength(1);
    expect(c.tag).toBe('offre');
    CRM.moveTo(p.id, 'ligne');
    expect(CRM.contacts().find(x => x.k === 'lea_test')).toBeUndefined();
  });
  it('une vente avance de « à expédier » à « finalisé »', async () => {
    const v = app.P.find(x => x.statut === 'Vendu');
    Object.assign(v, { vt: Date.now(), dv: new Date().toISOString().slice(0, 10) }); delete v.exp; delete v.fin;
    expect(CRM.stageOf(v)).toBe('envoyer');
    CRM.moveTo(v.id, 'expedie');
    expect(app.P.find(x => x.id === v.id).exp).toBeTruthy();
    expect(CRM.stageOf(app.P.find(x => x.id === v.id))).toBe('expedie');
    CRM.moveTo(v.id, 'finalise');
    expect(app.P.find(x => x.id === v.id).fin).toBeTruthy();
    expect(CRM.stageOf(app.P.find(x => x.id === v.id))).toBe('finalise');
    CRM.moveTo(v.id, 'envoyer');
    expect(CRM.stageOf(app.P.find(x => x.id === v.id))).toBe('envoyer');
  });
  it('fiche acheteur : note et relance enregistrées, message prêt à copier', async () => {
    const v = app.P.filter(x => x.statut === 'Vendu').slice(0, 2);
    v[0].acheteur = '@marie_crm'; v[1].acheteur = '@marie_crm';
    app.setStockMode('crm'); nav.go('list'); await tick(10);
    $('crm').querySelector('[data-crs="buyers"]').click(); await tick(10);
    const ligne = $('crm').querySelector('[data-ct="marie_crm"]');
    expect(ligne).not.toBeNull();
    ligne.click(); await tick(10);
    expect($('shc').textContent).toContain('marie_crm');
    $('ct_n').value = 'Aime le vintage, taille M';
    $('shc').querySelector('[data-rl="7"]').click();
    expect($('ct_r').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    $('ct_ok').click(); await tick(10);
    const c = CRM.contacts().find(x => x.k === 'marie_crm');
    expect(c.note).toBe('Aime le vintage, taille M');
    expect(c.relance).toMatch(/^\d{4}-/);
    expect(c.n).toBeGreaterThanOrEqual(1);
    app.setStockMode('stock');
  });
  it('le journal d\'activité liste les derniers événements', () => {
    const p = app.P[0]; p.h = [...(p.h || []), { t: Date.now(), e: 'Publiée' }];
    expect(CRM.activity(5)[0].e).toBe('Publiée');
  });
});
