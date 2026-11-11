import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
const td = () => new Date().toISOString().slice(0, 10);
let W, C;
beforeAll(async () => { await demarrer(120); C = await import('../src/modules/crm.js'); W = await import('../src/modules/warehouse3d.js'); });
afterEach(() => { app.setCfg({ crm: {} }, true); });

describe('v56 : quartier des acheteurs', () => {
  const vendus = () => app.P.filter(p => p.statut === 'Vendu');
  it('un immeuble par acheteur, les plus gros acheteurs au centre et plus hauts', () => {
    vendus().slice(0, 6).forEach((p, i) => app.save(Object.assign({}, p, { acheteur: i < 3 ? 'gros_t56' : 'p' + i + '_t56', pv: i < 3 ? 80 : 12 })));
    const T = W.layoutTown(C.contacts());
    expect(T.buildings.length).toBe(C.contacts().length);
    const g = T.buildings.find(b => b.nom === 'gros_t56'), p = T.buildings.find(b => b.nom === 'p4_t56');
    expect(g.h).toBeGreaterThan(p.h);
    const cx = (T.bounds.minX + T.bounds.maxX) / 2, cz = (T.bounds.minZ + T.bounds.maxZ) / 2;
    expect(Math.hypot(g.x - cx, g.z - cz)).toBeLessThanOrEqual(Math.hypot(p.x - cx, p.z - cz) + 0.01);
    T.buildings.forEach(b => { expect([b.x, b.z, b.h].every(Number.isFinite)).toBe(true); expect(b.x).toBeGreaterThan(T.bounds.minX); expect(b.x).toBeLessThan(T.bounds.maxX); });
  });
  it('pins : relance due ou liste noire en rouge, offre en orange', () => {
    const p = vendus()[0]; app.save(Object.assign({}, p, { acheteur: 'relance_t56' }));
    const k = C.contacts().find(c => c.nom === 'relance_t56').k;
    app.setCfg({ crm: { c: { [k]: { relance: '2020-01-01' } } } }, true);
    const T = W.layoutTown(C.contacts(), { today: td() });
    expect(T.pins.some(x => x.buyerKey === k && x.kind === 'alert')).toBe(true);
    app.setCfg({ crm: { c: { [k]: { bl: true } } } }, true);
    expect(W.layoutTown(C.contacts()).pins.find(x => x.buyerKey === k).text).toBe('×');
    app.setCfg({ crm: {} }, true);
    const o = app.P.find(q => q.statut === 'Disponible' && !q.crm);
    app.save(Object.assign({}, o, { crm: 'offre', pub: td(), offre: { a: 'offre_t56', m: 9, d: td() } }));
    const kk = C.contacts().find(c => c.nom === 'offre_t56').k;
    expect(W.layoutTown(C.contacts()).pins.find(x => x.buyerKey === kk).kind).toBe('offre');
  });
  it('un filtre grise les immeubles écartés', () => {
    const T = W.layoutTown(C.contacts(), { keep: c => c.nom === 'gros_t56' });
    expect(T.buildings.filter(b => !b.dim).map(b => b.nom)).toEqual(['gros_t56']);
  });
  it('au plus 80 immeubles, le reste est compté', () => {
    const fake = Array.from({ length: 100 }, (_, i) => ({ k: 'k' + i, nom: 'n' + i, n: 1, ca: i, score: 60, bl: false, tag: 'nouveau', offres: [], relance: '' }));
    const T = W.layoutTown(fake); expect(T.shown).toBe(80); expect(T.total).toBe(100);
  });
});

describe('v56 : la 3D est la vue de base du CRM', () => {
  it('la vue de départ est la 3D, avec repli sur le pipeline quand la 3D n\'est pas disponible', () => {
    expect(lire('src/modules/crm.js')).toContain("LSg('crmSub', '3d')");
    expect(W.canGL()).toBe(false);
    app.setStockMode('crm'); app.crmSub('3d');
    expect(document.querySelector('#crm .cxcol')).toBeTruthy();
    expect(document.querySelector('#crm [data-crs="3d"]')).toBeNull();
    app.setStockMode('stock');
  });
  it('la scène survit aux redessins du CRM : elle est déplacée, jamais recréée', () => {
    const s = lire('src/modules/warehouse3d.js');
    expect(s).toContain('slot.appendChild(S.host)');
    expect(s).toContain('if (!host.isConnected) return;');
    expect(s).not.toMatch(/openSheet\(.*wh/);
  });
  it('toucher un immeuble ouvre la fiche de l\'acheteur, et la fiche est exportée', () => {
    expect(typeof C.openContact).toBe('function'); expect(typeof app.openContact).toBe('function');
    expect(lire('src/modules/warehouse3d.js')).toContain('app.openContact(h.building)');
  });
  it('le panneau propose entrepôt et quartier, filtres et recentrage', () => {
    const h = W.whPanel();
    ['data-whv="wh"', 'data-whv="town"', 'id="wh_slot"', 'id="wh_rc"', 'id="wh_al"', 'id="wh_m"', 'id="wh_c"', 'id="wh_b"'].forEach(x => expect(h).toContain(x));
  });
  it('l\'entrepôt est un vrai bâtiment : murs, quais, camions, chariots, personnel', () => {
    const s = lire('src/modules/warehouse3d.js');
    ['quais de chargement', 'forklift', 'worker', 'truck', 'GridHelper'].forEach(x => expect(s).toContain(x));
  });
});
