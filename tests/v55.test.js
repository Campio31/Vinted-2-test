import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
const $ = id => document.getElementById(id);
let W, C;
const dispo = () => app.P.filter(p => p.statut === 'Disponible');
beforeAll(async () => { await demarrer(120); C = await import('../src/modules/crm.js'); W = await import('../src/modules/warehouse3d.js'); });
afterEach(() => { app.setCfg({ crm: {} }, true); });

describe('v55 : entrepôt 3D, mise en page', () => {
  it('une étagère par bac, une zone par étape de vente', () => {
    dispo().slice(0, 12).forEach((p, i) => app.save(Object.assign({}, p, { bac: i % 2 ? 'Bac A' : 'Bac B' })));
    const d = W.layoutWarehouse(app.P);
    expect(d.racks.map(r => r.key)).toEqual(expect.arrayContaining(['Bac A', 'Bac B']));
    expect(d.zones.map(z => z.id)).toEqual(['offre', 'envoyer', 'expedie', 'finalise']);
    expect(d.boxes.length).toBeGreaterThan(10);
    expect(d.total).toBeGreaterThan(10);
  });
  it('chaque colis a une position finie, et aucun ne sort de la scène', () => {
    const d = W.layoutWarehouse(app.P), b = d.bounds;
    d.boxes.forEach(x => { expect([x.x, x.y, x.z].every(Number.isFinite)).toBe(true); expect(x.x).toBeGreaterThan(b.minX); expect(x.x).toBeLessThan(b.maxX); expect(x.z).toBeGreaterThan(b.minZ); expect(x.z).toBeLessThan(b.maxZ); });
  });
  it('les pièces en stock sont sur les étagères, les autres dans leur zone', () => {
    const d = W.layoutWarehouse(app.P);
    d.boxes.forEach(x => { if (['brouillon', 'ligne'].includes(x.stage)) expect(x.where.startsWith('rack:')).toBe(true); else expect(x.where).toBe('zone:' + x.stage); });
  });
  it('les pièces sans bac vont sur l\'étagère « sans bac », en dernier', () => {
    const p = dispo().find(q => !q.bac && !q.ballot && !q.crm && q.pub); if (!p) return;
    const d = W.layoutWarehouse(app.P), k = d.racks.map(r => r.key);
    expect(k).toContain(''); expect(k[k.length - 1]).toBe('');
  });
  it('un filtre grise les pièces écartées sans les retirer', () => {
    const d = W.layoutWarehouse(app.P, { keep: p => p.marque === 'zzz-inconnue' });
    expect(d.boxes.every(b => b.dim)).toBe(true);
    expect(d.boxes.length).toBe(W.layoutWarehouse(app.P).boxes.length);
  });
  it('une réservation expirée donne un pin rouge', () => {
    const p = dispo().find(q => !q.crm), old = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    app.save(Object.assign({}, p, { crm: 'offre', pub: old, offre: { a: 'zz', m: 10, d: old } }));
    const d = W.layoutWarehouse(app.P);
    expect(d.pins.some(x => x.kind === 'alert' && x.pieceId === p.id)).toBe(true);
    expect(d.pins.some(x => x.zoneId === 'offre')).toBe(true);
  });
  it('une étape perso crée une zone', () => {
    app.setCfg({ crm: { x: [{ id: 'xlit', n: 'Litige' }] } }, true);
    expect(W.layoutWarehouse(app.P).zones.map(z => z.id)).toContain('xlit');
  });
  it('au-delà de la capacité, le surplus est compté', () => {
    const d = W.layoutWarehouse(app.P); d.racks.forEach(r => expect(r.over).toBe(Math.max(0, r.n - W.CAP)));
  });
  it('dépôt : zone sous le pointeur, stock, ou rien', () => {
    const d = W.layoutWarehouse(app.P), z = d.zones[0];
    expect(W.dropTarget(d, z.x, z.z)).toBe(z.id);
    expect(W.dropTarget(d, d.store.w / 2, d.store.d / 2)).toBe('hall');
    expect(W.dropTarget(d, -50, -50)).toBe('');
  });
  it('la signature change quand une pièce change d\'étape', () => {
    const s1 = W.signature(app.P), p = dispo().find(q => !q.crm && q.pub);
    if (p) { C.moveTo(p.id, 'brouillon', { silent: true }); expect(W.signature(app.P)).not.toBe(s1); }
  });
});

describe('v55 : entrepôt 3D, branchement', () => {
  it('Three.js est chargé à l\'ouverture seulement, hors du cache de départ', () => {
    expect(lire('src/modules/warehouse3d.js')).not.toMatch(/^import .* from 'three'/m);
    expect(lire('src/modules/warehouse3d.js')).toContain("import('three')");
    expect(lire('vite.config.js')).toContain('three');
    expect(JSON.parse(lire('package.json')).dependencies.three).toBeTruthy();
  });
  it('le bouton du CRM est présent et l\'écran s\'ouvre sans planter même sans WebGL', async () => {
    app.setStockMode('crm'); app.crmSub('pipe');
    expect(document.querySelector('#crm [data-cxwh]')).toBeTruthy();
    W.openWarehouse();
    expect($('crm').querySelector('.cxcol')).toBeTruthy();
    app.setStockMode('stock');
  });
});
