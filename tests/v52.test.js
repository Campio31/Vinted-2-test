import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
let nav, SH, AD, LI, PS, AP;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
  SH = await import('../src/modules/shipping.js');
  AD = await import('../src/modules/advice.js');
  LI = await import('../src/modules/listing.js');
  PS = await import('../src/modules/photo-studio.js');
  AP = await import('../src/modules/autopilot.js');
});
afterEach(() => { $('sheet').hidden = true; app.setCfg({ shipOn: false }, true); });

describe('v52 : écran Ajouter sur ordinateur', () => {
  it('la vue active est marquée sur le body (pour la mise en page)', () => {
    nav.go('add'); expect(document.body.dataset.view).toBe('add');
    nav.go('list'); expect(document.body.dataset.view).toBe('list');
  });
  it('la feuille de style libère la largeur pour la vue Ajouter', () => {
    expect(lire('src/mode.css')).toMatch(/body\[data-view="add"\] #app\{max-width:none/);
  });
});

describe('v52 : frais de port réels', () => {
  it('le barème donne le prix de la classe de poids', () => {
    expect(SH.shipPrice(0.3, 'mr')).toBe(3.5);
    expect(SH.shipPrice(1.5, 'col')).toBe(8.2);
    expect(SH.shipPrice(50, 'vgo')).toBe(9);
  });
  it('les prix corrigés dans les réglages passent avant ceux de départ', () => {
    app.setCfg({ shipT: { mr: { 1: 6 } } }, true);
    expect(SH.shipPrice(1, 'mr')).toBe(6);
    app.setCfg({ shipT: {} }, true);
  });
  it('le poids vient de la pièce, sinon de la catégorie', () => {
    expect(SH.weightOf({ poids: 2 })).toBe(2);
    expect(SH.weightOf({ cat: 'Veste' })).toBe(2);
  });
  it('les frais préremplis suivent le barème quand il est activé', () => {
    const p = { cat: 'Veste', poids: 5 };
    app.setCfg({ shipOn: true, shipCar: 'col' }, true);
    expect(app.shipFor(p)).toBe(11);
    const avec = app.defFrais(50, 'Vinted', undefined, p);
    app.setCfg({ shipOn: false }, true);
    const sans = app.defFrais(50, 'Vinted', undefined, p);
    expect(avec).not.toEqual(sans);
  });
});

describe('v52 : prix de départ et baisse automatique', () => {
  const ex = () => app.P.find(p => p.statut === 'Vendu') || app.P[0];
  it('le plan donne un départ au-dessus du plancher et des baisses décroissantes', () => {
    const sp = AD.startPlan(Object.assign({}, ex(), { statut: 'Disponible' }));
    if (!sp) return;
    expect(sp.start).toBeGreaterThanOrEqual(sp.floor);
    expect(sp.steps).toHaveLength(3);
    for (let i = 1; i < sp.steps.length; i++) expect(sp.steps[i].price).toBeLessThanOrEqual(sp.steps[i - 1].price);
    expect(sp.steps.every(s => s.price >= sp.floor)).toBe(true);
  });
  it('une pièce en ligne depuis longtemps reçoit une baisse, pas une récente', () => {
    const d = new Date(); const iso = n => new Date(d.getTime() - n * 864e5).toISOString().slice(0, 10);
    const base = { id: 'zz1', statut: 'Disponible', cat: 'Pantalon', achat: 5, pvise: 40 };
    app.setCfg({ dropOn: true, dropDays: 21, dropPct: 10 }, true);
    expect(AD.nextDrop(Object.assign({}, base, { pub: iso(3) }))).toBeNull();
    const r = AD.nextDrop(Object.assign({}, base, { pub: iso(30) }));
    expect(r).not.toBeNull(); expect(r.price).toBeLessThan(40);
    app.setCfg({ dropOn: false }, true);
    expect(AD.nextDrop(Object.assign({}, base, { pub: iso(30) }))).toBeNull();
    app.setCfg({ dropOn: true }, true);
  });
});

describe('v52 : annonce pour chaque plateforme', () => {
  const p = { id: 'zz2', cat: 'Pantalon', sub: 'Slim', marque: 'Levis', genre: 'Homme', taille: 'M', coul: ['Bleu'], etat: 'Très bon état', achat: 6 };
  it('trois plateformes, trois textes différents', () => {
    expect(LI.PLATFORMS.map(x => x[0])).toEqual(['vinted', 'lbc', 'tiktok']);
    const v = LI.annonceFor(p, 'vinted'), l = LI.annonceFor(p, 'lbc'), t = LI.annonceFor(p, 'tiktok');
    for (const a of [v, l, t]) { expect(a.title.length).toBeGreaterThan(3); expect(a.desc.length).toBeGreaterThan(10); }
    expect(l.title.length).toBeLessThanOrEqual(70);
    expect(t.title.length).toBeLessThanOrEqual(60);
    expect(t.tags).toMatch(/^#|\s#/);
    expect(new Set([v.desc, l.desc, t.desc]).size).toBe(3);
  });
});

describe('v52 : photos, détourage et formats', () => {
  it('le détourage retrouve un fond uni et laisse le vêtement', () => {
    const w = 20, h = 20, d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const x = i % w, y = (i - x) / w, in_ = x >= 7 && x < 13 && y >= 7 && y < 13; d.set(in_ ? [200, 20, 20, 255] : [250, 250, 250, 255], i * 4); }
    const r = PS.detourMask(d, w, h, 40);
    expect(r.mask[0]).toBe(1); expect(r.mask[10 * w + 10]).toBe(0);
    expect(r.part).toBeGreaterThan(0.6);
    PS.paintBackground(d, r.mask, w, h, [10, 20, 30]);
    expect(Array.from(d.slice(0, 3))).toEqual([10, 20, 30]);
    const c = (10 * w + 10) * 4; expect(d[c]).toBe(200);
  });
  it('chaque format a le bon rapport', () => {
    const q = PS.fitRect(1000, 500, 'sq', 'cover'); expect(q.cw).toBe(q.ch);
    expect(q.sw / q.sh).toBeCloseTo(1, 2);
    const v = PS.fitRect(1000, 1000, 'vinted', 'contain'); expect(v.cw / v.ch).toBeCloseTo(0.8, 2);
    expect(v.dx).toBeGreaterThanOrEqual(0); expect(v.dw).toBeLessThanOrEqual(v.cw);
    const t = PS.fitRect(1000, 1000, 'tiktok', 'cover'); expect(t.cw / t.ch).toBeCloseTo(9 / 16, 2);
    expect(PS.fitRect(4000, 3000, 'orig', 'contain').cw).toBe(1600);
  });
});

describe('v52 : relances, annonces dormantes et alerte de marge dans Ma journée', () => {
  it('quatre nouvelles tâches existent et la règle de baisse est proposée', () => {
    const src = lire('src/modules/autopilot.js');
    for (const k of ['baisse', 'relance', 'offre', 'marge']) expect(src).toContain(k);
    expect(typeof AP.lowMargins).toBe('function');
    expect(Array.isArray(AP.lowMargins())).toBe(true);
  });
  it('sans seuil, aucune alerte de marge', () => {
    app.setCfg({ margeAlert: 0 }, true);
    expect(AP.lowMargins()).toHaveLength(0);
  });
});

describe('v52 : réglages et formulaire', () => {
  it('les réglages montrent le barème, la baisse et le seuil de marge', () => {
    nav.go('set'); app.renderSet();
    for (const id of ['c_shipOn', 'c_dropOn', 'c_dropDays', 'c_dropPct', 'c_margeAlert']) expect($(id), id).toBeTruthy();
  });
  it('le formulaire propose le poids du colis à l\'étape 4', () => {
    const src = lire('src/modules/form.js');
    expect(src).toContain('Poids du colis');
    expect(src).toMatch(/\['achat','prov','envoi'/);
    expect(src).toContain('data-f="poids"');
  });
});

describe('v52 : version de présentation', () => {
  it('la page existe, sans prix, avec l\'essai de l\'appli', () => {
    const h = lire('public/presentation.html');
    expect(h).toContain('./index.html');
    expect(h).toContain('demo=1');
    expect(h).not.toMatch(/€|\/mois|abonnement/i);
  });
  it('le mode démo range les données à part et reste hors du cache hors ligne', () => {
    expect(lire('public/env.js')).toContain("'demo'");
    expect(lire('vite.config.js')).toContain('presentation');
    expect(lire('src/main.js')).toContain('demo.js');
  });
});
