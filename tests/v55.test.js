import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
let W;
beforeAll(async () => { await demarrer(120); W = await import('../src/modules/warehouse3d.js'); });
afterEach(() => { app.setCfg({ crm: {} }, true); });

describe('v55 : entrepôt 3D, branchement', () => {
  it('Three.js est chargé à l\'ouverture seulement, hors du cache de départ', () => {
    expect(lire('src/modules/warehouse3d.js')).not.toMatch(/^import .* from 'three'/m);
    expect(lire('src/modules/warehouse3d.js')).toContain("import('three')");
    expect(lire('vite.config.js')).toContain('three');
    expect(JSON.parse(lire('package.json')).dependencies.three).toBeTruthy();
  });
  it('le bouton du CRM est présent et l\'ouverture sans WebGL retombe sur le pipeline', () => {
    app.setStockMode('crm'); app.crmSub('pipe');
    expect(document.querySelector('#crm [data-cxwh]')).toBeTruthy();
    W.openWarehouse();
    expect(document.getElementById('crm').querySelector('.cxcol')).toBeTruthy();
    app.setStockMode('stock');
  });
  it('la signature du stock change quand une pièce change d\'étape', async () => {
    const C = await import('../src/modules/crm.js'), s1 = W.signature(app.P), p = app.P.find(q => q.statut === 'Disponible' && !q.crm && q.pub);
    if (p) { C.moveTo(p.id, 'brouillon', { silent: true }); expect(W.signature(app.P)).not.toBe(s1); }
  });
});