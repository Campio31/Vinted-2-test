import { describe, it, expect } from 'vitest';
import * as P from '../src/modules/plan3d.js';

const bacs = n => Array.from({ length: n }, (_, i) => 'Bac ' + (i + 1));
const pc = (id, o) => Object.assign({ id, statut: 'Disponible', cat: 'Tshirt', marque: 'X', pub: '2026-11-01' }, o);
const F = (stageMap = {}) => ({ inPipeline: () => true, stageOf: p => stageMap[p.id] || 'ligne', expired: () => false, slowParcel: () => false, title: p => p.id });

describe('v57 plan : les trois lieux et leurs plans de départ', () => {
  it.each(['room', 'house', 'wh'])('le plan de départ de « %s » est valide : rien ne chevauche ni ne sort', place => {
    const tpl = P.template(place), plan = P.defaultPlan(place, bacs(20));
    expect(plan.items.length).toBeGreaterThan(5);
    plan.items.forEach(it => expect(P.canPlace(plan, tpl, it), it.type + '@' + it.x + ',' + it.z).toBe(true));
    ['offre', 'envoyer', 'expedie', 'finalise'].forEach(s => expect(plan.items.some(i => i.stage === s), s).toBe(true));
    expect(plan.items.some(i => P.TYPES[i.type].kind === 'store')).toBe(true);
    expect(new Set(plan.items.map(i => i.id)).size).toBe(plan.items.length);
  });
  it('les bacs sont attribués dans l\'ordre aux meubles de rangement', () => {
    const plan = P.defaultPlan('wh', bacs(3)), st = plan.items.filter(i => i.type === 'rack');
    expect(st.slice(0, 3).map(i => i.bac)).toEqual(['Bac 1', 'Bac 2', 'Bac 3']); expect(st[3].bac).toBeUndefined();
  });
  it('un plan enregistré est repris, sinon plan de départ', () => {
    const saved = { plans: { room: { items: [{ id: 'a', type: 'shelf', x: 3, z: 1, rot: 0 }] } } };
    expect(P.getPlan(saved, 'room', []).items).toHaveLength(1);
    expect(P.getPlan(saved, 'house', bacs(2)).items.length).toBeGreaterThan(5);
  });
});

describe('v57 plan : emplacements et rangement des pièces', () => {
  it('chaque type de meuble a des emplacements au bon endroit, tournés avec le meuble', () => {
    const rack = { id: 'r', type: 'rack', x: 10, z: 5, rot: 0 }, s0 = P.slotsOf(rack);
    expect(s0).toHaveLength(24); s0.forEach(s => { expect(Math.abs(s.x - 10)).toBeLessThanOrEqual(2.3); expect(s.z).toBeCloseTo(5, 5); });
    const s1 = P.slotsOf(Object.assign({}, rack, { rot: 1 })); s1.forEach(s => { expect(Math.abs(s.z - 5)).toBeLessThanOrEqual(2.31); expect(Math.abs(s.x - 10)).toBeLessThan(0.01); });
    expect(P.slotsOf({ id: 'w', type: 'wardrobe', x: 0, z: 0, rot: 0 }).every(s => s.hang)).toBe(true);
    expect(P.slotsOf({ id: 'z', type: 'zone', x: 0, z: 0, rot: 0 }).length).toBeGreaterThan(10);
    expect(P.slotsOf({ id: 'd', type: 'sofa', x: 0, z: 0, rot: 0 })).toHaveLength(0);
  });
  it('une pièce va sur le meuble de son bac, une pièce d\'étape dans la zone de son étape', () => {
    const plan = P.defaultPlan('room', ['Penderie', 'Haut']), P0 = [pc('a', { bac: 'Penderie' }), pc('b', { bac: 'Haut' }), pc('c'), pc('d')];
    const r = P.placePieces(P0, plan, F({ c: 'offre', d: 'envoyer' })), by = id => r.boxes.find(b => b.id === id), it = id => plan.items.find(i => i.id === by(id).where);
    expect(it('a').type).toBe('wardrobe'); expect(it('a').bac).toBe('Penderie'); expect(by('a').hang).toBe(true);
    expect(it('b').bac).toBe('Haut');
    expect(it('c').stage).toBe('offre'); expect(it('d').stage).toBe('envoyer');
    expect(r.unplaced).toEqual([]);
  });
  it('un bac sans meuble déborde sur un meuble libre, sinon sur le moins rempli, et c\'est signalé', () => {
    const plan = P.defaultPlan('room', ['Penderie']), r = P.placePieces([pc('a', { bac: 'Inconnu' })], plan, F());
    expect(r.boxes).toHaveLength(1); expect(plan.items.find(i => i.id === r.boxes[0].where).bac).toBeUndefined();
    const full = { items: [{ id: 's', type: 'shelf', x: 3, z: 3, rot: 0, bac: 'A' }] }, r2 = P.placePieces([pc('a', { bac: 'B' })], full, F());
    expect(r2.boxes).toHaveLength(1); expect(r2.misplaced).toEqual(['a']);
  });
  it('sans zone pour une étape, la pièce est signalée comme sans emplacement', () => {
    const plan = { items: [{ id: 's', type: 'shelf', x: 3, z: 3, rot: 0, bac: '' }] };
    const r = P.placePieces([pc('a')], plan, F({ a: 'expedie' })); expect(r.unplaced).toEqual(['a']); expect(r.boxes).toHaveLength(0);
  });
  it('la capacité est respectée, les pièces en trop sont signalées', () => {
    const plan = { items: [{ id: 's', type: 'shelf', x: 3, z: 3, rot: 0, bac: '' }] }, many = Array.from({ length: 20 }, (_, i) => pc('p' + String(i).padStart(2, '0')));
    const r = P.placePieces(many, plan, F()); expect(r.boxes).toHaveLength(12); expect(r.unplaced).toHaveLength(8); expect(r.usage.s).toEqual({ n: 12, cap: 12 });
  });
  it('les emplacements restent stables quand une pièce change d\'étape', () => {
    const plan = P.defaultPlan('wh', bacs(4)), L = Array.from({ length: 10 }, (_, i) => pc('p' + i, { bac: 'Bac 1' }));
    const a = P.placePieces(L, plan, F()), b = P.placePieces(L, plan, F({ p9: 'offre' }));
    L.slice(0, 9).forEach(p => { const x = a.boxes.find(q => q.id === p.id), y = b.boxes.find(q => q.id === p.id); expect([x.x, x.y, x.z]).toEqual([y.x, y.y, y.z]); });
  });
  it('un filtre grise sans retirer, une alerte donne un pin rouge, une zone un pin avec le nombre', () => {
    const plan = P.defaultPlan('room', ['A']), L = [pc('a'), pc('b')];
    const r = P.placePieces(L, plan, Object.assign(F({ b: 'offre' }), { keep: p => p.id === 'a', expired: p => p.id === 'b' }));
    expect(r.boxes.find(x => x.id === 'b').dim).toBe(true); expect(r.boxes.find(x => x.id === 'a').dim).toBe(false);
    expect(r.pins.some(p => p.kind === 'alert' && p.pieceId === 'b')).toBe(true); expect(r.pins.find(p => p.zoneId && p.stage === 'offre').text).toBe('1');
  });
  it('les mouvements sont repérés d\'un rangement à l\'autre et ont un rôle', () => {
    const plan = P.defaultPlan('wh', ['A']), L = [pc('a', { bac: 'A' })], a = P.placePieces(L, plan, F()), prev = new Map(a.boxes.map(b => [b.id, b]));
    const b = P.placePieces(L, plan, F({ a: 'envoyer' })), mv = P.diffMoves(prev, b.boxes);
    expect(mv).toHaveLength(1); expect(mv[0].id).toBe('a'); expect(P.roleFor(mv[0], plan)).toBe('cariste');
    const c = P.placePieces(L, plan, F({ a: 'expedie' })), mv2 = P.diffMoves(new Map(b.boxes.map(x => [x.id, x])), c.boxes); expect(P.roleFor(mv2[0], plan)).toBe('quai');
    const d = P.placePieces(L, plan, F({ a: 'offre' })), mv3 = P.diffMoves(new Map(b.boxes.map(x => [x.id, x])), d.boxes); expect(P.roleFor(mv3[0], plan)).toBe('prep');
  });
});

describe('v57 plan : l\'éditeur refuse ce qui est impossible dans la vraie vie', () => {
  const tpl = P.template('room');
  it('déplacer : calé sur la grille, refusé si ça chevauche ou sort', () => {
    const plan = { items: [{ id: 'a', type: 'shelf', x: 2, z: 1, rot: 0 }, { id: 'b', type: 'shelf', x: 5, z: 1, rot: 0 }] };
    const ok = P.moveItem(plan, tpl, 'a', 2.3, 2.1); expect(ok.items[0].x).toBe(2.5); expect(ok.items[0].z).toBe(2);
    expect(P.moveItem(plan, tpl, 'a', 5.5, 1)).toBeNull();
    expect(P.moveItem(plan, tpl, 'a', -3, 1)).toBeNull();
    expect(P.moveItem(plan, tpl, 'a', 3, 6)).toBeNull();
  });
  it('tourner : quart de tour, refusé si le meuble ne tient plus', () => {
    const plan = { items: [{ id: 'a', type: 'rack', x: 3.5, z: 0.8, rot: 0 }] };
    expect(P.rotateItem(plan, tpl, 'a')).toBeNull();
    const ok = P.rotateItem({ items: [{ id: 'a', type: 'rack', x: 3.5, z: 2.8, rot: 0 }] }, tpl, 'a'); expect(ok.items[0].rot).toBe(1);
  });
  it('ajouter trouve une place libre, supprimer et dupliquer marchent, une pièce pleine refuse', () => {
    let plan = { items: [] }; const r = P.addItem(plan, tpl, 'table'); expect(r.plan.items).toHaveLength(1); expect(P.canPlace(r.plan, tpl, r.plan.items[0])).toBe(true);
    const d = P.dupItem(r.plan, tpl, r.id); expect(d.plan.items).toHaveLength(2); expect(d.plan.items[1].id).not.toBe(r.id);
    expect(P.removeItem(d.plan, r.id).items).toHaveLength(1);
    plan = P.defaultPlan('room', []); let n = 0; for (let i = 0; i < 60; i++) { const q = P.addItem(plan, tpl, 'chest'); if (!q) break; plan = q.plan; n++; } expect(n).toBeLessThan(60);
  });
  it('une zone peinte au sol accepte un meuble dedans, mais deux zones ne se chevauchent pas', () => {
    const plan = { items: [{ id: 'z', type: 'zone', x: 3.5, z: 3, rot: 0, stage: 'offre', w: 3, d: 3 }] };
    expect(P.canPlace(plan, tpl, { id: 't', type: 'table', x: 3.5, z: 3, rot: 0 })).toBe(true);
    expect(P.canPlace(plan, tpl, { id: 'z2', type: 'zone', x: 4, z: 3, rot: 0, stage: 'envoyer', w: 3, d: 3 })).toBe(false);
  });
  it('les murs de la maison bloquent la pose', () => {
    const h = P.template('house'), plan = { items: [] };
    expect(P.canPlace(plan, h, { id: 'x', type: 'shelf', x: 7, z: 1, rot: 0 })).toBe(false);
    expect(P.canPlace(plan, h, { id: 'x', type: 'shelf', x: 3, z: 1, rot: 0 })).toBe(true);
  });
});

describe('v57 plan : chemins des personnages', () => {
  it('le chemin contourne les meubles et ne traverse jamais un obstacle', () => {
    const tpl = P.template('wh'), plan = P.defaultPlan('wh', bacs(12)), nav = P.buildNav(plan, tpl);
    const a = { x: 1, z: 1 }, b = { x: 30, z: 24 }, path = P.findPath(nav, a, b);
    expect(path).toBeTruthy(); const last = path[path.length - 1]; expect(Math.hypot(last.x - b.x, last.z - b.z)).toBeLessThan(1.2);
    let c = a; path.forEach(q => { for (let i = 0; i <= 20; i++) expect(P.walkable(nav, c.x + (q.x - c.x) * i / 20, c.z + (q.z - c.z) * i / 20)).toBe(true); c = q; });
    expect(P.pathLen(a, path)).toBeGreaterThanOrEqual(Math.hypot(b.x - a.x, b.z - a.z) - 0.01);
  });
  it('un mur plein oblige à passer par la porte', () => {
    const h = P.template('house'), plan = { items: [] }, nav = P.buildNav(plan, h), path = P.findPath(nav, { x: 3, z: 2 }, { x: 11, z: 2 });
    expect(path).toBeTruthy(); const through = path.some(q => q.z > 3.5 && q.z < 5.3 && Math.abs(q.x - 7) < 1.2); expect(through).toBe(true);
  });
  it('un point enfermé n\'a pas de chemin', () => {
    const tpl = { bounds: { minX: 0, maxX: 6, minZ: 0, maxZ: 6 }, walls: [{ x0: 2.5, x1: 3.5, z0: 0, z1: 6, h: 3 }] }, nav = P.buildNav({ items: [] }, tpl);
    expect(P.findPath(nav, { x: 1, z: 3 }, { x: 5, z: 3 })).toBeNull();
  });
  it('le point de service est devant le meuble, côté allée, et libre', () => {
    const plan = P.defaultPlan('wh', bacs(12)), nav = P.buildNav(plan, P.template('wh')), rack = plan.items.find(i => i.type === 'rack'), sp = P.standPoint(nav, rack);
    expect(P.walkable(nav, sp.x, sp.z)).toBe(true); expect(Math.abs(sp.z - rack.z)).toBeLessThan(2.5);
  });
  it('le personnage avance à vitesse constante et arrive', () => {
    const w = { x: 0, z: 0, rot: 0, speed: 2, path: [{ x: 4, z: 0 }, { x: 4, z: 3 }] }; let t = 0; while (!P.advance(w, 0.1) && t < 100) t++;
    expect(w.x).toBe(4); expect(w.z).toBe(3); expect(t).toBeGreaterThan(30); expect(t).toBeLessThan(40);
  });
  it('les cases libres les plus proches sont trouvées quand on vise un meuble', () => {
    const plan = { items: [{ id: 'a', type: 'rack', x: 5, z: 5, rot: 0 }] }, nav = P.buildNav(plan, { bounds: { minX: 0, maxX: 12, minZ: 0, maxZ: 12 }, walls: [] });
    expect(P.walkable(nav, 5, 5)).toBe(false); const f = P.nearestFree(nav, 5, 5); expect(P.walkable(nav, f.x, f.z)).toBe(true);
  });
});
