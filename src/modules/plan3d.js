/* ---------- Plan 3D : lieux, meubles placés par toi, rangement des pièces, chemins des personnages ---------- */
/* Tout ce fichier est du calcul pur (pas de Three.js) : il se teste sans écran.
   - Un LIEU (une pièce, une maison, un entrepôt) fixe les murs, les portes et la taille.
   - Le PLAN est la liste des meubles que tu as posés (position, quart de tour, bac ou étape qui leur est attribué). Il est enregistré avec tes réglages.
   - Chaque pièce du pipeline est rangée sur le meuble de son bac (ou dans la zone de son étape), à un emplacement précis.
   - Les personnages cherchent leur chemin sur une grille (A*), en contournant les meubles et les murs. */

export const CELL = 0.5;
export const snap = v => Math.round(v / CELL) * CELL;
export const STORE_STAGES = ['brouillon', 'ligne'];

/* ---- catalogue des meubles ---- */
/* kind : store = range les pièces d'un bac · stage = reçoit les pièces d'une étape · decor = déco (bloque le passage)
   floor : simple marquage au sol, on peut marcher dessus et poser des meubles dedans */
export const TYPES = {
  rack: { n: 'Étagère', w: 4.6, d: 1.5, h: 2.7, kind: 'store' },
  shelf: { n: 'Bibliothèque', w: 2, d: 0.6, h: 2.1, kind: 'store' },
  wardrobe: { n: 'Penderie', w: 2.4, d: 0.7, h: 2.1, kind: 'store' },
  chest: { n: 'Commode', w: 1.4, d: 0.6, h: 1, kind: 'store' },
  table: { n: 'Table d\'emballage', w: 2.4, d: 1, h: 0.9, kind: 'stage' },
  zone: { n: 'Zone au sol', w: 6, d: 5, h: 0.1, kind: 'stage', floor: true },
  dock: { n: 'Quai d\'expédition', w: 5, d: 4, h: 0.1, kind: 'stage', floor: true },
  sofa: { n: 'Canapé', w: 2.2, d: 0.95, h: 0.9, kind: 'decor' },
  bed: { n: 'Lit', w: 2, d: 1.6, h: 0.6, kind: 'decor' },
  desk: { n: 'Bureau', w: 1.6, d: 0.8, h: 0.8, kind: 'decor' },
  plant: { n: 'Plante', w: 0.7, d: 0.7, h: 1.4, kind: 'decor' },
  pallet: { n: 'Palette', w: 1.2, d: 0.8, h: 0.2, kind: 'decor' },
};
export const typeLabel = k => (TYPES[k] || { n: k }).n;
export const isFloor = it => !!TYPES[it.type].floor;
export const dims = it => { const T = TYPES[it.type]; return { w: it.w || T.w, d: it.d || T.d, h: T.h }; };
export const rectOf = it => { const { w, d } = dims(it), q = (it.rot || 0) % 2, hx = (q ? d : w) / 2, hz = (q ? w : d) / 2; return { x0: it.x - hx, x1: it.x + hx, z0: it.z - hz, z1: it.z + hz }; };
export const overlaps = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;

/* ---- les trois lieux ---- */
export const PLACES = { room: 'Une pièce', house: 'Maison', wh: 'Entrepôt' };
const W = (x0, z0, x1, z1, h = 3) => ({ x0, z0, x1, z1, h });
/** Murs (rectangles pleins), taille et personnages de chaque lieu. Les portes sont des trous entre deux murs. */
export function template(place) {
  if (place === 'room') return { place, bounds: { minX: 0, maxX: 7, minZ: 0, maxZ: 5.5 }, walls: [], roles: ['prep'], shell: 'room', wallH: 2.8 };
  if (place === 'house') return {
    place, bounds: { minX: 0, maxX: 15, minZ: 0, maxZ: 10 }, roles: ['prep', 'quai'], shell: 'house', wallH: 2.8,
    walls: [W(6.9, 0, 7.1, 3.6), W(6.9, 5.2, 7.1, 10), W(7.1, 4.9, 10.2, 5.1), W(11.8, 4.9, 15, 5.1)],
    rooms: [{ n: 'Salon et chambre', x0: 0, z0: 0, x1: 7, z1: 10, c: 0xe9dcc8 }, { n: 'Bureau', x0: 7, z0: 0, x1: 15, z1: 5, c: 0xdde6ee }, { n: 'Garage', x0: 7, z0: 5, x1: 15, z1: 10, c: 0xc9ced2 }],
  };
  return { place: 'wh', bounds: { minX: 0, maxX: 42, minZ: 0, maxZ: 26 }, walls: [], roles: ['prep', 'prep', 'cariste', 'quai'], shell: 'wh', wallH: 5.2, docks: [{ x: 42, z: 5 }, { x: 42, z: 13 }, { x: 42, z: 21 }] };
}
let uid = 0;
const nid = () => 'i' + Date.now().toString(36) + (uid++).toString(36);
const mk = (type, x, z, rot, extra) => Object.assign({ id: nid(), type, x, z, rot: rot || 0 }, extra);
/** Plan de départ d'un lieu ; bacs = noms des bacs existants, attribués aux meubles de rangement dans l'ordre. */
export function defaultPlan(place, bacs = []) {
  const items = [];
  const give = () => { const b = bacs.shift(); return b === undefined ? undefined : b; };
  if (place === 'room') {
    items.push(mk('wardrobe', 1.6, 0.5, 0, { bac: give() }), mk('shelf', 3.9, 0.4, 0, { bac: give() }), mk('shelf', 5.9, 0.4, 0, { bac: give() }), mk('table', 5.6, 3.2, 0), mk('plant', 6.5, 2, 0));
    [['offre', 1.2], ['envoyer', 3.0], ['expedie', 4.8]].forEach(([s, x]) => items.push(mk('zone', x + 0.2, 4.4, 0, { stage: s, w: 1.6, d: 1.6 })));
    items.push(mk('zone', 1.2, 2.4, 0, { stage: 'finalise', w: 1.6, d: 1.6 }));
  } else if (place === 'house') {
    items.push(mk('wardrobe', 2, 0.5, 0, { bac: give() }), mk('wardrobe', 4.6, 0.5, 0, { bac: give() }), mk('chest', 0.5, 3.2, 1, { bac: give() }), mk('sofa', 3.4, 8.8, 2), mk('bed', 1.2, 6.2, 1), mk('plant', 6.3, 9.3, 0));
    items.push(mk('shelf', 9, 0.4, 0, { bac: give() }), mk('shelf', 11.2, 0.4, 0, { bac: give() }), mk('desk', 13.4, 1.2, 0), mk('table', 13.2, 3.6, 0), mk('zone', 8.8, 3, 0, { stage: 'offre', w: 2.6, d: 2.4 }));
    items.push(mk('table', 9, 6.2, 0), mk('rack', 12, 9, 0, { bac: give() }), mk('pallet', 14.2, 7.4, 1), mk('zone', 12.2, 6.2, 0, { stage: 'envoyer', w: 3.4, d: 1.8 }), mk('zone', 8.4, 8.4, 0, { stage: 'expedie', w: 2.2, d: 2.2 }), mk('dock', 13.4, 8.6, 0, { stage: 'finalise', w: 3, d: 2.6 }));
  } else {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) items.push(mk('rack', 3.5 + c * 6.2, 3 + r * 4.4, 0, { bac: give() }));
    items.push(mk('zone', 33, 4, 0, { stage: 'offre', w: 7, d: 5 }), mk('zone', 33, 11, 0, { stage: 'envoyer', w: 7, d: 5 }), mk('zone', 33, 18, 0, { stage: 'expedie', w: 7, d: 5 }), mk('dock', 38.5, 13, 0, { stage: 'finalise', w: 4, d: 6 }));
    items.push(mk('table', 27, 21, 0), mk('table', 24, 21, 0), mk('pallet', 4, 22, 0), mk('pallet', 6, 22, 0));
  }
  return { items };
}
/** Plan enregistré du lieu, ou plan de départ. */
export function getPlan(crm, place, bacs) { const s = ((crm || {}).plans || {})[place]; return s && Array.isArray(s.items) ? { items: s.items.map(i => Object.assign({}, i)) } : defaultPlan(place, (bacs || []).slice()); }

/* ---- poser, déplacer, tourner : on refuse ce qui n'est pas possible dans la vraie vie ---- */
const wallRects = tpl => (tpl.walls || []).map(w => ({ x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1 }));
export function canPlace(plan, tpl, it) {
  const r = rectOf(it), b = tpl.bounds, pad = isFloor(it) ? 0 : 0.1;
  if (r.x0 < b.minX + pad || r.x1 > b.maxX - pad || r.z0 < b.minZ + pad || r.z1 > b.maxZ - pad) return false;
  const fl = isFloor(it);
  for (const o of plan.items) {
    if (o.id === it.id) continue;
    if (fl !== isFloor(o)) continue;   /* un meuble peut se poser dans une zone peinte au sol ; deux meubles ou deux zones ne se chevauchent pas */
    if (overlaps(r, rectOf(o))) return false;
  }
  if (!fl) for (const w of wallRects(tpl)) if (overlaps(r, w)) return false;
  return true;
}
const patch = (plan, id, f) => ({ items: plan.items.map(i => (i.id === id ? f(Object.assign({}, i)) : i)) });
export function moveItem(plan, tpl, id, x, z) {
  const it = plan.items.find(i => i.id === id); if (!it) return null;
  const n = Object.assign({}, it, { x: snap(x), z: snap(z) });
  return canPlace(plan, tpl, n) ? patch(plan, id, i => Object.assign(i, { x: n.x, z: n.z })) : null;
}
export function rotateItem(plan, tpl, id) {
  const it = plan.items.find(i => i.id === id); if (!it) return null;
  const n = Object.assign({}, it, { rot: ((it.rot || 0) + 1) % 4 });
  return canPlace(plan, tpl, n) ? patch(plan, id, i => Object.assign(i, { rot: n.rot })) : null;
}
export const removeItem = (plan, id) => ({ items: plan.items.filter(i => i.id !== id) });
export const setProps = (plan, id, p) => patch(plan, id, i => Object.assign(i, p));
/** Ajoute un meuble au premier endroit libre en partant de (x, z) ; renvoie { plan, id } ou null s'il n'y a plus de place. */
export function addItem(plan, tpl, type, x, z, extra) {
  const b = tpl.bounds, cx = x == null ? (b.minX + b.maxX) / 2 : x, cz = z == null ? (b.minZ + b.maxZ) / 2 : z, base = Object.assign({ id: nid(), type, x: 0, z: 0, rot: 0 }, extra);
  for (let r = 0; r <= 40; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const it = Object.assign({}, base, { x: snap(cx + dx * CELL), z: snap(cz + dz * CELL) });
    if (canPlace(plan, tpl, it)) return { plan: { items: [...plan.items, it] }, id: it.id };
  }
  return null;
}
export function dupItem(plan, tpl, id) { const it = plan.items.find(i => i.id === id); if (!it) return null; const e = Object.assign({}, it); delete e.id; return addItem(plan, tpl, it.type, it.x + 1, it.z + 1, e); }

/* ---- emplacements : où se pose chaque pièce sur un meuble ---- */
const LV = [0.28, 1.2, 2.12];
/** Emplacements d'un meuble en coordonnées du monde : { x, y, z, rot (radians), sc (échelle du colis), hang (suspendu) }. */
export function slotsOf(it) {
  const { w, d } = dims(it), L = [], ang = (it.rot || 0) * Math.PI / 2, c = Math.cos(ang), s = Math.sin(ang);
  const add = (lx, y, lz, sc, hang) => L.push({ x: it.x + lx * c + lz * s, y, z: it.z - lx * s + lz * c, rot: ang, sc, hang: !!hang });
  if (it.type === 'rack') LV.forEach(y => { for (let i = 0; i < 8; i++) add(-w / 2 + 0.45 + i * 0.52, y + 0.2, 0, 1); });
  else if (it.type === 'shelf') [0.4, 0.95, 1.5, 2.0].forEach(y => { for (let i = 0; i < 3; i++) add(-w / 2 + 0.35 + i * 0.65, y + 0.15, 0, 0.65); });
  else if (it.type === 'chest') for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) add(-w / 2 + 0.3 + i * 0.4, 1.12, -0.12 + r * 0.24, 0.5);
  else if (it.type === 'wardrobe') for (let i = 0; i < 12; i++) add(-w / 2 + 0.22 + i * 0.178, 1.25, 0, 1, true);
  else if (it.type === 'table') for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) add(-w / 2 + 0.5 + i * 0.7, 1.1, -0.22 + r * 0.44, 0.8);
  else if (TYPES[it.type].floor) {
    const cols = Math.max(1, Math.floor((w - 0.8) / 0.9) + 1), rows = Math.max(1, Math.floor((d - 0.8) / 0.9) + 1);
    for (let layer = 0; layer < 2; layer++) for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) add(-((cols - 1) * 0.9) / 2 + k * 0.9, 0.22 + layer * 0.46, -((rows - 1) * 0.9) / 2 + r * 0.9, 1);
  }
  return L;
}

/* ---- ranger les pièces sur le plan ---- */
const ZPIN = { offre: 'offre', envoyer: 'ship', expedie: 'sent', finalise: 'done' };
/** Range toutes les pièces du pipeline. f = { inPipeline, stageOf, expired, slowParcel, title, keep }.
    Renvoie { boxes, pins, unplaced, usage } ; chaque colis = { id, x, y, z, rot, sc, hang, stage, where, dim, alert }. */
export function placePieces(P, plan, f) {
  const keep = f.keep || (() => true), slots = new Map(plan.items.map(it => [it.id, slotsOf(it)])), used = new Map(plan.items.map(it => [it.id, 0]));
  const stores = plan.items.filter(it => TYPES[it.type].kind === 'store'), stagers = plan.items.filter(it => TYPES[it.type].kind === 'stage');
  const boxes = [], pins = [], unplaced = [], misplaced = [];
  const free = it => used.get(it.id) < slots.get(it.id).length;
  const L = P.filter(f.inPipeline).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  L.forEach(p => {
    const st = f.stageOf(p); let target = null;
    if (STORE_STAGES.includes(st)) {
      const key = p.bac || p.ballot || '';
      target = stores.find(it => it.bac === key && free(it)) || stores.find(it => it.bac === undefined && free(it));
      if (!target && !stores.some(it => it.bac === key)) { target = stores.filter(free).sort((a, b) => used.get(a.id) - used.get(b.id))[0]; if (target) misplaced.push(p.id); }
    } else target = stagers.find(it => it.stage === st && free(it));
    if (!target) { unplaced.push(p.id); return; }
    const k = used.get(target.id); used.set(target.id, k + 1);
    const s = slots.get(target.id)[k], al = f.expired(p) ? 'exp' : f.slowParcel(p) ? 'slow' : '';
    boxes.push({ id: p.id, x: s.x, y: s.y, z: s.z, rot: s.rot, sc: s.sc, hang: s.hang, stage: st, where: target.id, dim: !keep(p), alert: al });
    if (al) pins.push({ kind: 'alert', x: s.x, y: s.y + 1, z: s.z, pieceId: p.id, text: '!', label: f.title(p) });
  });
  const usage = {};
  plan.items.forEach(it => { if (TYPES[it.type].kind === 'decor' || !slots.get(it.id).length) return; const n = used.get(it.id), cap = slots.get(it.id).length; usage[it.id] = { n, cap }; });
  /* pièces qui n'ont pas trouvé de place : on les compte par étape pour le pin de la zone */
  const counts = {}; L.forEach(p => { const st = f.stageOf(p); counts[st] = (counts[st] || 0) + 1; });
  stagers.forEach(it => { const n = boxes.filter(b => b.where === it.id).length; if (n) pins.push({ kind: ZPIN[it.stage] || 'custom', x: it.x, y: (isFloor(it) ? 3.2 : 2.6), z: it.z, zoneId: it.id, stage: it.stage, text: String(counts[it.stage] || n), label: it.name || typeLabel(it.type) }); });
  return { boxes, pins, unplaced, misplaced, usage, total: L.length };
}
/** Pièces dont l'emplacement a changé depuis la dernière fois : [{ id, from, to }]. prev = Map id → colis. */
export function diffMoves(prev, boxes) { const out = []; boxes.forEach(b => { const o = prev.get(b.id); if (o && o.where !== b.where) out.push({ id: b.id, from: o, to: b }); }); return out; }
export const roleFor = (move, plan) => {
  const ty = id => (plan.items.find(i => i.id === id) || {}).type;
  if (ty(move.from.where) === 'rack' || ty(move.to.where) === 'rack') return 'cariste';
  const it = plan.items.find(i => i.id === move.to.where); if (it && (it.stage === 'expedie' || it.stage === 'finalise' || it.type === 'dock')) return 'quai';
  return 'prep';
};

/* ---- grille de navigation et chemins (A*) ---- */
export function buildNav(plan, tpl, o = {}) {
  const b = tpl.bounds, nx = Math.ceil((b.maxX - b.minX) / CELL), nz = Math.ceil((b.maxZ - b.minZ) / CELL), margin = o.margin == null ? 0.2 : o.margin, blocked = new Uint8Array(nx * nz);
  const mark = (r, m) => { const x0 = Math.max(0, Math.floor((r.x0 - m - b.minX) / CELL)), x1 = Math.min(nx - 1, Math.floor((r.x1 + m - b.minX - 1e-6) / CELL)), z0 = Math.max(0, Math.floor((r.z0 - m - b.minZ) / CELL)), z1 = Math.min(nz - 1, Math.floor((r.z1 + m - b.minZ - 1e-6) / CELL)); for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) blocked[z * nx + x] = 1; };
  plan.items.forEach(it => { if (!isFloor(it)) mark(rectOf(it), margin); });
  wallRects(tpl).forEach(r => mark(r, 0.15));
  return { b, nx, nz, blocked };
}
const cellOf = (n, x, z) => [Math.floor((x - n.b.minX) / CELL), Math.floor((z - n.b.minZ) / CELL)];
const worldOf = (n, cx, cz) => ({ x: n.b.minX + (cx + 0.5) * CELL, z: n.b.minZ + (cz + 0.5) * CELL });
const inGrid = (n, cx, cz) => cx >= 0 && cz >= 0 && cx < n.nx && cz < n.nz;
export const walkable = (n, x, z) => { const [cx, cz] = cellOf(n, x, z); return inGrid(n, cx, cz) && !n.blocked[cz * n.nx + cx]; };
/** Case libre la plus proche d'un point (anneaux de plus en plus larges). */
export function nearestFree(n, x, z, maxR = 8) {
  const [c0, r0] = cellOf(n, x, z);
  for (let r = 0; r <= maxR; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const cx = c0 + dx, cz = r0 + dz; if (inGrid(n, cx, cz) && !n.blocked[cz * n.nx + cx]) return worldOf(n, cx, cz); }
  return null;
}
function los(n, a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), k = Math.max(1, Math.ceil(d / 0.2)); for (let i = 1; i < k; i++) { if (!walkable(n, a.x + (b.x - a.x) * i / k, a.z + (b.z - a.z) * i / k)) return false; } return true; }
/** Plus court chemin entre deux points, en contournant les obstacles ; renvoie une liste de points { x, z } ou null s'il n'y en a pas. */
export function findPath(n, from, to) {
  const s = nearestFree(n, from.x, from.z, 3), e = nearestFree(n, to.x, to.z, 3); if (!s || !e) return null;
  const [sx, sz] = cellOf(n, s.x, s.z), [ex, ez] = cellOf(n, e.x, e.z), N = n.nx * n.nz, g = new Float32Array(N).fill(Infinity), par = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const h = (x, z) => { const dx = Math.abs(x - ex), dz = Math.abs(z - ez); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
  const heap = [], push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const si = sz * n.nx + sx, ei = ez * n.nx + ex; g[si] = 0; push(h(sx, sz), si);
  while (heap.length) {
    const [, i] = pop(); if (done[i]) continue; done[i] = 1; if (i === ei) break;
    const cx = i % n.nx, cz = (i - cx) / n.nx;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (!inGrid(n, x, z)) continue; const j = z * n.nx + x; if (n.blocked[j] || done[j]) continue;
      if (dx && dz && (n.blocked[cz * n.nx + x] || n.blocked[z * n.nx + cx])) continue;   /* pas de coupe dans un coin */
      const ng = g[i] + (dx && dz ? 1.4142 : 1); if (ng < g[j]) { g[j] = ng; par[j] = i; push(ng + h(x, z), j); }
    }
  }
  if (!done[ei]) return null;
  const raw = []; for (let i = ei; i !== -1; i = par[i]) { const cx = i % n.nx; raw.push(worldOf(n, cx, (i - cx) / n.nx)); } raw.reverse();
  const out = [raw[0]]; let i = 0;
  while (i < raw.length - 1) { let j = raw.length - 1; while (j > i + 1 && !los(n, raw[i], raw[j])) j--; out.push(raw[j]); i = j; }
  return out.slice(1).length ? out.slice(1) : [e];
}
/** Point où se tient un personnage pour servir un meuble : devant lui, côté allée. */
export function standPoint(n, it, side = 1) {
  const r = rectOf(it), q = (it.rot || 0) % 4, f = [[0, 1], [1, 0], [0, -1], [-1, 0]][q], hx = (r.x1 - r.x0) / 2, hz = (r.z1 - r.z0) / 2;
  return nearestFree(n, it.x + f[0] * side * (hx + 0.6), it.z + f[1] * side * (hz + 0.6)) || nearestFree(n, it.x, it.z, 12);
}
/** Longueur d'un chemin. */
export const pathLen = (a, p) => { let L = 0, c = a; (p || []).forEach(q => { L += Math.hypot(q.x - c.x, q.z - c.z); c = q; }); return L; };
/** Fait avancer un personnage de dt secondes le long de son chemin ; renvoie true quand il est arrivé. */
export function advance(w, dt) {
  if (!w.path.length) return true;
  const t = w.path[0], dx = t.x - w.x, dz = t.z - w.z, d = Math.hypot(dx, dz), step = w.speed * dt;
  if (d <= step) { w.x = t.x; w.z = t.z; w.path.shift(); return !w.path.length; }
  w.x += dx / d * step; w.z += dz / d * step; w.rot = Math.atan2(dx, dz); return false;
}
