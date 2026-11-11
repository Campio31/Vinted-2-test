import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as P from '../src/modules/plan3d.js';

const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');

describe('v58 : agrandir les lieux', () => {
  it.each(['room', 'house', 'wh'])('« %s » grandit vers la droite et le fond, les murs et les quais suivent', place => {
    const a = P.template(place), b = P.template(place, { ex: 6, ez: 4 });
    expect(b.bounds.maxX - a.bounds.maxX).toBe(6); expect(b.bounds.maxZ - a.bounds.maxZ).toBe(4);
    if (place === 'house') { expect(b.walls.some(w => w.x1 === 21)).toBe(true); expect(b.rooms[2].x1).toBe(21); expect(b.rooms[2].z1).toBe(14); }
    if (place === 'wh') { b.docks.forEach(d => expect(d.x).toBe(48)); expect(b.docks.every((d, i) => d.z > (i ? b.docks[i - 1].z : 0))).toBe(true); }
  });
  it('la taille se lit en mètres', () => { expect(P.sizeOf('wh')).toEqual({ w: 42, d: 26 }); expect(P.sizeOf('room', { ex: 2, ez: -1 })).toEqual({ w: 9, d: 4.5 }); });
  it('agrandir est accepté, les nouveaux meubles tiennent dans l\'espace gagné', () => {
    const plan = P.defaultPlan('room', ['A']), n = P.resizePlan(plan, 'room', 4, 2); expect(n.ex).toBe(4); expect(n.ez).toBe(2);
    const tpl = P.template('room', n), r = P.addItem(n, tpl, 'rack', 12, 7); expect(r).toBeTruthy(); expect(r.plan.ex).toBe(4);
    expect(P.canPlace(n, tpl, { id: 'x', type: 'shelf', x: 9.5, z: 7, rot: 0 })).toBe(true);
  });
  it('réduire est refusé si un meuble ne tient plus, ou si le lieu devient trop petit, ou trop grand', () => {
    const plan = P.defaultPlan('room', []); expect(P.resizePlan(plan, 'room', -2, 0)).toBeNull();
    expect(P.resizePlan({ items: [], ex: 0, ez: 0 }, 'room', -4, 0)).toBeNull();
    expect(P.resizePlan({ items: [], ex: 0, ez: 0 }, 'wh', 60, 0)).toBeNull();
    expect(P.resizePlan({ items: [], ex: 0, ez: 0 }, 'wh', -2, -2)).toBeTruthy();
  });
  it('les opérations de l\'éditeur gardent la taille choisie', () => {
    const plan = Object.assign(P.defaultPlan('wh', ['A']), { ex: 8, ez: 6 }), tpl = P.template('wh', plan), id = plan.items[0].id;
    [P.moveItem(plan, tpl, id, 5, 5), P.rotateItem(P.removeItem(plan, plan.items[1].id), tpl, id), P.setProps(plan, id, { bac: 'Z' }), P.removeItem(plan, id), P.addItem(plan, tpl, 'plant').plan, P.dupItem(plan, tpl, id).plan]
      .filter(Boolean).forEach(n => { expect(n.ex).toBe(8); expect(n.ez).toBe(6); });
  });
  it('un plan enregistré garde sa taille', () => {
    const saved = { plans: { wh: { items: [{ id: 'a', type: 'shelf', x: 3, z: 1, rot: 0 }], ex: 6, ez: 2 } } }, plan = P.getPlan(saved, 'wh', []);
    expect(plan.ex).toBe(6); expect(P.sizeOf('wh', plan)).toEqual({ w: 48, d: 28 });
  });
  it('les chemins couvrent le lieu agrandi', () => {
    const plan = Object.assign(P.defaultPlan('wh', []), { ex: 10, ez: 0 }), tpl = P.template('wh', plan), nav = P.buildNav(plan, tpl), path = P.findPath(nav, { x: 1, z: 1 }, { x: 50, z: 20 });
    expect(path).toBeTruthy(); const l = path[path.length - 1]; expect(Math.hypot(l.x - 50, l.z - 20)).toBeLessThan(1.2);
  });
});

describe('v58 : plein écran et graphismes', () => {
  const w = lire('src/modules/warehouse3d.js'), sc = lire('src/modules/scene3d.js');
  it('le plein écran couvre tout, se quitte avec Échap, et garde la scène vivante', () => {
    expect(w).toContain('id="wh_fs"'); expect(w).toContain("e.key === 'Escape'"); expect(w).toContain('fullscreenchange'); expect(w).toContain('whfs');
    expect(lire('src/mode.css')).toContain('.whw.whfs{position:fixed;inset:0');
  });
  it('les graphismes se règlent (léger ou élevé), léger par défaut sur téléphone', () => {
    expect(w).toContain("coarse() ? 'low' : 'high'"); expect(w).toContain('id="wh_q"'); expect(sc).toContain('setQuality');
    ['ACESFilmicToneMapping', 'PMREMGenerator', 'RoundedBoxGeometry', 'Fog'].forEach(k => expect(sc + w).toContain(k));
  });
  it('le détail ajouté : luminaires, extincteurs, bornes, tableaux, ombres sous les personnages', () => {
    ['lamp', 'CircleGeometry', 'decor', 'extincteur'.length ? '0xd23a3a' : ''].forEach(k => expect(sc.toLowerCase()).toContain(k.toLowerCase()));
  });
});