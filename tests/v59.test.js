import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FURN, furnModel, propsFor, buildingModel, charModel, fitScale, BASE } from '../src/modules/models3d.js';
import { template, defaultPlan } from '../src/modules/plan3d.js';

const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
const glb = f => path.resolve(process.cwd(), 'public/models', f + '.glb');
const tous = [];

describe('v59 : modèles 3D importés', () => {
  it('les fichiers du pack existent, avec les crédits CC0', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/models/CREDITS.txt'))).toBe(true);
    expect(lire('public/models/CREDITS.txt')).toContain('CC0');
    ['sofa', 'bed', 'desk', 'plant'].forEach(t => { [{ w: 1, d: 1, h: 1 }, { w: 3, d: 2, h: 1 }].forEach(m => tous.push(furnModel({ type: t }, m).f)); });
    ['prep', 'quai', 'cariste', 'inconnu'].forEach(r => [0, 1, 2, 3].forEach(i => tous.push(charModel(r, i))));
    for (let i = 0; i < 60; i++) { tous.push(buildingModel({ k: 'k' + i, h: 5, w: 3 })); tous.push(buildingModel({ k: 'k' + i, h: 30, w: 3 })); }
    [...new Set(tous)].forEach(f => expect(fs.existsSync(glb(f)), f).toBe(true));
  });
  it('chaque fichier est un vrai GLB', () => {
    [...new Set(tous)].forEach(f => { const b = fs.readFileSync(glb(f)); expect(b.slice(0, 4).toString()).toBe('glTF'); });
  });
  it('les meubles de rangement gardent leurs étages, les autres sont remplacés', () => {
    ['rack', 'shelf', 'wardrobe', 'chest', 'table', 'zone', 'dock', 'pallet'].forEach(t => expect(furnModel({ type: t }, { w: 1, d: 1, h: 1 })).toBeNull());
    expect(Object.keys(FURN).sort()).toEqual(['bed', 'desk', 'plant', 'sofa']);
  });
  it('un grand canapé et un grand lit changent de modèle', () => {
    expect(furnModel({ type: 'sofa' }, { w: 3, d: 1, h: 1 }).f).toContain('Long');
    expect(furnModel({ type: 'bed' }, { w: 2, d: 1.8, h: 1 }).f).toContain('Double');
    expect(furnModel({ type: 'bed' }, { w: 2, d: 0.9, h: 1 }).f).toContain('Single');
  });
  it('un immeuble garde toujours le même modèle, les grands sont des gratte-ciel', () => {
    expect(buildingModel({ k: 'abc', h: 5, w: 3 })).toBe(buildingModel({ k: 'abc', h: 6, w: 3 }));
    expect(buildingModel({ k: 'abc', h: 30, w: 3 })).toContain('skyscraper');
    expect(buildingModel({ k: 'abc', h: 4, w: 3 })).not.toContain('skyscraper');
  });
  it('la mise à l\'échelle tient dans la cible', () => {
    const u = fitScale({ w: 2, h: 1, d: 1 }, { w: 4, d: 2 }, 'free'); expect(u).toEqual({ x: 2, y: 2, z: 2 });
    const f = fitScale({ w: 2, h: 1, d: 1 }, { w: 4, d: 1, h: 3 }, 'free'); expect(f).toEqual({ x: 2, y: 3, z: 1 });
    const g = fitScale({ w: 1, h: 2, d: 1 }, { h: 1.7 }, 'uniform'); expect(g.y).toBeCloseTo(0.85); expect(g.x).toBeCloseTo(0.85);
  });
  it('des accessoires pour la pièce et la maison, aucun pour l\'entrepôt', () => {
    const r = template('room', defaultPlan('room')), h = template('house', defaultPlan('house'));
    expect(propsFor(r).length).toBeGreaterThan(1); expect(propsFor(h).length).toBeGreaterThan(propsFor(r).length);
    expect(propsFor(template('wh', defaultPlan('wh')))).toEqual([]);
    propsFor(h).forEach(p => { expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true); expect(fs.existsSync(glb(p.f)), p.f).toBe(true); });
  });
  it('branchement : chargé à la demande, repli sur les formes simples, hors du cache de départ', () => {
    const s = lire('src/modules/scene3d.js'), w = lire('src/modules/warehouse3d.js');
    expect(w).toContain('GLTFLoader'); expect(w).toContain('SkeletonUtils'); expect(w).not.toMatch(/^import .* from 'three/m);
    ['createLibrary', 'AnimationMixer', "playClip(a, 'walk')", "'pick-up'", 'userData.shared', 'buildingModel(bl)'].forEach(x => expect(s).toContain(x));
    expect(lire('vite.config.js')).toContain('models');
    expect(BASE).toBe('./models/');
    expect(lire('src/modules/models3d.js')).not.toMatch(/^import /m);
  });
});
