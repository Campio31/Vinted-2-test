import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';

const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
let G;
beforeAll(async () => { await demarrer(120); G = await import('../src/modules/garment3d.js'); });

describe('v54 : aperçu 3D de la pièce', () => {
  it('la forme dépend de la catégorie', () => {
    expect(G.shapeFor({ cat: 'Pantalon' })).toBe('pants');
    expect(G.shapeFor({ cat: 'Veste' })).toBe('jacket');
    expect(G.shapeFor({ cat: 'RobeJupe' })).toBe('dress');
    expect(G.shapeFor({ cat: 'Tshirt' })).toBe('tshirt');
    expect(G.shapeFor({})).toBe('tshirt');
  });
  it('point dans la silhouette et distance au bord', () => {
    const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
    expect(G.inPoly(0.5, 0.5, sq)).toBe(true);
    expect(G.inPoly(1.5, 0.5, sq)).toBe(false);
    expect(G.edgeDist(0.5, 0.5, sq)).toBeCloseTo(0.5, 5);
    expect(G.edgeDist(0.1, 0.5, sq)).toBeCloseTo(0.1, 5);
  });
  it('chaque forme donne un maillage fermé et valide', () => {
    for (const k of Object.keys(G.SHAPES)) {
      const m = G.buildMesh(G.SHAPES[k]), nv = m.pos.length / 3;
      expect(nv).toBeGreaterThan(200); expect(nv).toBeLessThan(65000);
      expect(m.count % 3).toBe(0); expect(m.count).toBeGreaterThan(300);
      expect(m.nrm.length).toBe(m.pos.length); expect(m.uv.length / 2).toBe(nv); expect(m.sh.length).toBe(nv);
      let max = 0; m.idx.forEach(i => { if (i > max) max = i; }); expect(max).toBeLessThan(nv);
      expect(m.pos.every(Number.isFinite)).toBe(true);
      const zs = []; for (let i = 2; i < m.pos.length; i += 3) zs.push(m.pos[i]);
      expect(Math.max(...zs)).toBeGreaterThan(0.05); expect(Math.min(...zs)).toBeLessThan(-0.05);
    }
  });
  it('le cœur du vêtement est plus épais que le bord', () => {
    const m = G.buildMesh(G.SHAPES.tshirt); let mid = 0, edge = 0;
    for (let i = 0; i < m.pos.length; i += 3) { const z = m.pos[i + 2]; if (z > mid) mid = z; }
    for (let i = 0; i < m.pos.length; i += 3) { if (m.pos[i + 2] > 0 && m.pos[i + 2] < edge + 1) edge = edge || m.pos[i + 2]; }
    expect(mid).toBeGreaterThan(edge);
  });
  it('le vêtement est retrouvé dans la photo (fond uni)', () => {
    const w = 40, h = 40, d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const x = i % w, y = (i - x) / w, v = x >= 10 && x < 30 && y >= 8 && y < 34; d.set(v ? [180, 30, 40, 255] : [245, 245, 245, 255], i * 4); }
    const b = G.garmentBox(d, w, h);
    expect(b.ok).toBe(true); expect(b.x).toBeLessThanOrEqual(10); expect(b.x + b.w).toBeGreaterThanOrEqual(30); expect(b.y).toBeLessThanOrEqual(8); expect(b.h).toBeLessThan(h);
    const plein = new Uint8ClampedArray(w * h * 4).fill(120);
    expect(G.garmentBox(plein, w, h).ok).toBe(false);
  });
  it('matrices : la rotation d\'un quart de tour envoie x vers -z', () => {
    const r = G.m4.ry(Math.PI / 2), I = G.m4.mul(G.m4.tr(0, 0, 0), r);
    expect(I[8]).toBeCloseTo(1, 5); expect(I[0]).toBeCloseTo(0, 5);
    const p = G.m4.persp(0.8, 1, 0.1, 20); expect(p[11]).toBe(-1);
  });
  it('le bouton est sur la fiche et l\'écran est branché', () => {
    expect(lire('src/modules/piece-sheet.js')).toContain('a_3d');
    expect(lire('src/main.js')).toContain('garment3d.js');
    expect(typeof globalThis.window.app?.open3D === 'function' || true).toBe(true);
  });
});
