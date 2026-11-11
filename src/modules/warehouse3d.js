import { app } from '../state.js';
import { $, LSg, LSs, esc, title } from './core.js';
import { contacts, expired, inPipeline, moveTo, slowParcel, stageOf, stages } from './crm.js';
import { go } from './nav.js';

/* ---------- Entrepôt 3D : ton stock vu comme un vrai entrepôt, en vue isométrique ---------- */
/* Les ÉTAGÈRES sont tes bacs (ou ballots) : les pièces à publier et en ligne y sont rangées, un colis par pièce.
   Les ZONES au sol sont les étapes de la vente (offre, à expédier, expédié, finalisé, + tes étapes perso) : une pièce y passe dès qu'elle quitte le stock.
   Les PINS signalent ce qui demande ton attention (réservation expirée, colis qui traîne) et le contenu de chaque zone.
   La mise en page (layoutWarehouse) est pure et testée ; la scène Three.js n'est chargée qu'à l'ouverture (gros paquet, gardé hors du chargement de l'appli). */

/* ---- mesures de la scène (en mètres, à peu près) ---- */
export const RW = 4.6, RD = 1.5, AX = 1.6, AZ = 2.6, PER = 8, SLOT = 0.52, LV = [0.28, 1.2, 2.12], CAP = PER * 3;
export const ZW = 7, ZD = 6, ZG = 1.4, ZCAP = 36;
export const STAGE_COL = { brouillon: 0xcdbf9f, ligne: 0xb57b3a, offre: 0xe8a33d, envoyer: 0x3b82c4, expedie: 0x7a6fc4, finalise: 0x4aa56a };
const PIN_COL = { alert: 0xd23a3a, offre: 0xe8a33d, ship: 0x3b82c4, sent: 0x7a6fc4, done: 0x4aa56a, custom: 0x6b7280 };
const ZONE_PIN = { offre: 'offre', envoyer: 'ship', expedie: 'sent', finalise: 'done' };
const STORE = ['brouillon', 'ligne'];

/** Place toutes les pièces du pipeline : étagères (une par bac), zones d'étapes, colis, pins. keep(p) = false : la pièce est grisée. */
export function layoutWarehouse(P, o = {}) {
  const keep = o.keep || (() => true), L = P.filter(inPipeline), store = [], byZone = {};
  L.forEach(p => { const s = stageOf(p); if (STORE.includes(s)) store.push(p); else (byZone[s] = byZone[s] || []).push(p); });
  /* étagères : une par bac, « sans bac » à la fin */
  const groups = {};
  store.forEach(p => { const k = p.bac || p.ballot || ''; (groups[k] = groups[k] || []).push(p); });
  const keys = Object.keys(groups).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'fr', { numeric: true })));
  const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(keys.length)))), rows = Math.max(1, Math.ceil(keys.length / cols));
  const storeW = cols * (RW + AX) - AX, storeD = rows * (RD + AZ) - AZ;
  const boxes = [], pins = [], racks = [], zones = [];
  const alertOf = p => (expired(p) ? 'exp' : slowParcel(p) ? 'slow' : '');
  const put = (p, x, y, z, st, where) => { const al = alertOf(p); boxes.push({ id: p.id, x, y, z, stage: st, where, dim: !keep(p), alert: al }); if (al) pins.push({ kind: 'alert', x, y: y + 0.9, z, pieceId: p.id, text: '!', label: title(p) }); };
  keys.forEach((k, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = c * (RW + AX) + RW / 2, z = r * (RD + AZ) + RD / 2, items = groups[k].slice().sort((a, b) => (stageOf(a) === stageOf(b) ? title(a).localeCompare(title(b)) : stageOf(a) === 'brouillon' ? -1 : 1));
    racks.push({ key: k, name: k || t('Sans bac'), x, z, w: RW, d: RD, n: items.length, over: Math.max(0, items.length - CAP) });
    items.slice(0, CAP).forEach((p, j) => put(p, x - RW / 2 + 0.45 + (j % PER) * SLOT, LV[Math.floor(j / PER)] + 0.19, z, stageOf(p), 'rack:' + k));
  });
  const zx0 = storeW + 7, ids = stages().map(s => s[0]).filter(s => !STORE.includes(s));
  ids.forEach((id, i) => {
    const c = i % 2, r = Math.floor(i / 2), x = zx0 + c * (ZW + ZG) + ZW / 2, z = r * (ZD + ZG) + ZD / 2, items = (byZone[id] || []).slice().sort((a, b) => title(a).localeCompare(title(b))), name = (stages().find(s => s[0] === id) || [id, id])[1];
    zones.push({ id, name, x, z, w: ZW, d: ZD, n: items.length, over: Math.max(0, items.length - ZCAP), color: STAGE_COL[id] || 0x888888 });
    items.slice(0, ZCAP).forEach((p, j) => { const layer = Math.floor(j / 12), q = j % 12; put(p, x - ZW / 2 + 0.9 + (q % 6) * 0.95, 0.19 + layer * 0.4 + 0.08, z - ZD / 2 + 1.4 + Math.floor(q / 6) * 1.5, id, 'zone:' + id); });
    if (items.length) pins.push({ kind: ZONE_PIN[id] || 'custom', x, y: 3.4, z, zoneId: id, text: String(items.length), label: name });
  });
  const maxX = Math.max(storeW, zones.length ? zx0 + (zones.length > 1 ? 2 : 1) * (ZW + ZG) - ZG : storeW), maxZ = Math.max(storeD, Math.ceil(ids.length / 2) * (ZD + ZG) - ZG);
  return { racks, zones, boxes, pins, store: { w: storeW, d: storeD }, bounds: { minX: -1.5, maxX: maxX + 1.5, minZ: -1.5, maxZ: maxZ + 1.5 }, total: L.length };
}
/** Signature courte du stock pour savoir quand redessiner la scène. */
export const signature = P => P.filter(inPipeline).map(p => p.id + ':' + stageOf(p) + ':' + (p.bac || p.ballot || '') + (expired(p) ? '!' : '')).join('|');
/** Zone (id) sous un point du sol, ou 'hall' sur le stock, ou '' ailleurs. */
export function dropTarget(data, x, z) {
  const zn = data.zones.find(q => Math.abs(x - q.x) <= q.w / 2 && Math.abs(z - q.z) <= q.d / 2); if (zn) return zn.id;
  return x >= -1 && x <= data.store.w + 1 && z >= -1 && z <= data.store.d + 1 ? 'hall' : '';
}


/** Quartier des acheteurs : un immeuble par acheteur, plus il achète plus il est haut ; les meilleurs au centre. */
const TAG_COL = { fidele: 0x4aa56a, revenu: 0x3b82c4, nouveau: 0xd9c9a3, offre: 0xe8a33d, prospect: 0xb4b8bd };
export function layoutTown(C, o = {}) {
  const keep = o.keep || (() => true), td = o.today || new Date().toISOString().slice(0, 10), list = C.slice().sort((a, b) => b.ca - a.ca || b.n - a.n).slice(0, 80);
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length))), rows = Math.max(1, Math.ceil(list.length / cols)), cell = 7, cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r, Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2)]);
  cells.sort((a, b) => a[2] - b[2]);
  const buildings = [], pins = [];
  list.forEach((c, i) => {
    const [cx, cz] = cells[i], x = cx * cell + cell / 2, z = cz * cell + cell / 2, h = 1.8 + Math.min(c.n, 12) * 1.15, bad = c.bl || c.score < 40;
    const b = { k: c.k, nom: c.nom, x, z, w: 3.4, h, n: c.n, ca: c.ca, score: c.score, bl: c.bl, tag: c.tag, offres: c.offres.length, color: bad ? 0x8a5a5a : (TAG_COL[c.tag] || 0xb4b8bd), dim: !keep(c) };
    buildings.push(b);
    if (c.relance && c.relance <= td) pins.push({ kind: 'alert', x, y: h + 1.2, z, buyerKey: c.k, text: '!', label: '@' + c.nom });
    else if (c.bl) pins.push({ kind: 'alert', x, y: h + 1.2, z, buyerKey: c.k, text: '×', label: '@' + c.nom });
    else if (c.offres.length) pins.push({ kind: 'offre', x, y: h + 1.2, z, buyerKey: c.k, text: String(c.offres.length), label: '@' + c.nom });
  });
  return { buildings, pins, total: C.length, shown: list.length, cell, bounds: { minX: -1, maxX: cols * cell + 1, minZ: -1, maxZ: rows * cell + 1 } };
}

/* ---------- la scène Three.js ---------- */
const hex = n => '#' + n.toString(16).padStart(6, '0');
function pinTexture(color, text) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = hex(color); x.beginPath(); x.arc(48, 44, 34, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(20, 66); x.lineTo(48, 124); x.lineTo(76, 66); x.closePath(); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(48, 44, 24, 0, Math.PI * 2); x.fill();
  x.fillStyle = hex(color); x.font = '700 ' + (text.length > 2 ? 22 : 30) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 48, 46);
  return c;
}
function labelTexture(text, sub) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); if (x.roundRect) x.roundRect(4, 8, 312, 80, 18); else x.rect(4, 8, 312, 80); x.fill();
  x.fillStyle = '#1d1d1b'; x.font = '700 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text.length > 16 ? text.slice(0, 15) + '…' : text, 160, 38);
  x.fillStyle = '#6b6b66'; x.font = '500 24px sans-serif'; x.fillText(sub, 160, 68);
  return c;
}
/** Crée la scène dans host. T = Three, OC = OrbitControls, cb = { onPick(hit), onDrop(id, cible) }.
    Renvoie { setData(mode, data), recenter(), resize(), dispose() } ; mode = 'wh' (entrepôt) ou 'town' (acheteurs). */
export function createScene(T, OC, host, cb) {
  const W = () => host.clientWidth || 600, H = () => host.clientHeight || 440;
  const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  const scene = new T.Scene(); scene.background = new T.Color(0xdde6ee);
  const cam = new T.PerspectiveCamera(28, W() / H(), 1, 900), ctl = new OC(cam, renderer.domElement);
  ctl.enableDamping = true; ctl.maxPolarAngle = 1.25; ctl.minPolarAngle = 0.3; ctl.screenSpacePanning = false;
  scene.add(new T.HemisphereLight(0xffffff, 0xb8c4cc, 1.05));
  const sun = new T.DirectionalLight(0xffffff, 1.25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun, sun.target);
  const ground = new T.Mesh(new T.PlaneGeometry(1200, 1200), new T.MeshStandardMaterial({ color: 0xcfe0c4 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true; scene.add(ground);
  let dyn = null, data = null, mode = 'wh', framedMode = '', run = true, boxMesh = null, pinSprites = [], zoneMeshes = {}, townMeshes = [], movers = [], spans = 40;
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -0.6), hit = new T.Vector3(), tmp = new T.Object3D();
  const free = g => g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
  const frame = () => {
    const b = data.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2; spans = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    ctl.target.set(cx, 0.8, cz); const d = spans * (mode === 'town' ? 1.3 : 0.95) + (mode === 'town' ? 14 : 9); cam.position.set(cx + d * 0.62, d * 0.62, cz + d * 0.78); ctl.minDistance = 8; ctl.maxDistance = spans * 3 + 40;
    sun.position.set(cx - spans * 0.5, spans * 0.9, cz + spans * 0.4); sun.target.position.set(cx, 0, cz); const s = sun.shadow.camera; s.left = -spans; s.right = spans; s.top = spans; s.bottom = -spans; s.near = 1; s.far = spans * 4; s.updateProjectionMatrix(); ctl.update(); framedMode = mode;
  };
  const std = c => new T.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const box = (w, h, d, c, x, y, z, cast) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), std(c)); m.position.set(x, y, z); m.castShadow = !!cast; m.receiveShadow = true; dyn.add(m); return m; };
  const label = (text, sub, x, y, z, sx) => { const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(labelTexture(text, sub)), depthTest: false })); s.scale.set(sx || 3.6, (sx || 3.6) * 0.3, 1); s.position.set(x, y, z); s.renderOrder = 4; dyn.add(s); return s; };
  const addPins = () => data.pins.forEach(p => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(pinTexture(PIN_COL[p.kind] || PIN_COL.custom, p.text)), depthTest: false })); s.center.set(0.5, 0); s.scale.set(1.0, 1.33, 1); s.position.set(p.x, p.y, p.z); s.renderOrder = 5; s.userData = p; dyn.add(s); pinSprites.push(s);
  });
  const trees = (b, ring, n) => {
    const rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(), pts = [];
    for (let k = 0; k < 400 && pts.length < n; k++) { const x = b.minX - ring - 10 + rnd() * (b.maxX - b.minX + 2 * ring + 20), z = b.minZ - ring - 10 + rnd() * (b.maxZ - b.minZ + 2 * ring + 20); if (x > b.minX - ring && x < b.maxX + ring && z > b.minZ - ring && z < b.maxZ + ring) continue; pts.push([x, z, 0.8 + rnd() * 0.9]); }
    if (!pts.length) return;
    const fol = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), std(0x86c46f), pts.length), trk = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.16, 1, 6), std(0x8a6a4a), pts.length);
    pts.forEach(([x, z, s], i) => { tmp.position.set(x, 0.5 * s + 0.4, z); tmp.scale.set(0.2, s, 0.2); tmp.updateMatrix(); trk.setMatrixAt(i, tmp.matrix); tmp.position.set(x, 1.3 * s + 0.8, z); tmp.scale.set(s, s, s); tmp.updateMatrix(); fol.setMatrixAt(i, tmp.matrix); });
    tmp.scale.set(1, 1, 1); fol.castShadow = true; dyn.add(trk, fol);
  };
  /* ---- petits objets : chariot, personnage, camion ---- */
  const forklift = (x, z, rot) => {
    const g = new T.Group(), part = (w, h, d, c, px, py, pz) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), std(c)); m.position.set(px, py, pz); m.castShadow = true; g.add(m); };
    part(1.1, 0.7, 1.7, 0xf2c230, 0, 0.55, 0); part(0.9, 0.12, 0.1, 0x333333, 0, 1.45, 0.45); part(0.08, 1.5, 0.08, 0x333333, -0.45, 1.0, 0.45); part(0.08, 1.5, 0.08, 0x333333, 0.45, 1.0, 0.45);
    part(0.1, 0.06, 1.1, 0x666666, -0.3, 0.2, 1.3); part(0.1, 0.06, 1.1, 0x666666, 0.3, 0.2, 1.3); part(0.5, 0.5, 0.5, 0x2f3a45, 0, 1.1, -0.35); part(0.45, 0.45, 0.45, 0xf0b9a0, 0, 1.45, -0.35);
    g.position.set(x, 0.1, z); g.rotation.y = rot; dyn.add(g); return g;
  };
  const worker = (x, z, c) => { const g = new T.Group(), body = new T.Mesh(new T.CapsuleGeometry(0.22, 0.7, 4, 8), std(c)), head = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), std(0xf0c9a8)); body.position.y = 0.75; head.position.y = 1.45; body.castShadow = true; g.add(body, head); g.position.set(x, 0.1, z); dyn.add(g); return g; };
  const truck = (x, z, rotY, c) => { const g = new T.Group(); const tr = new T.Mesh(new T.BoxGeometry(10, 3, 3), std(0xf5f6f7)), cab = new T.Mesh(new T.BoxGeometry(2.4, 2.4, 3), std(c)); tr.position.set(0, 1.9, 0); cab.position.set(6.4, 1.4, 0); tr.castShadow = cab.castShadow = true; g.add(tr, cab); [-3.5, 0, 4, 6.4].forEach(wx => [-1.5, 1.5].forEach(wz => { const w = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.4, 12), std(0x2b2b2b)); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.5, wz); g.add(w); })); g.position.set(x, 0, z); g.rotation.y = rotY; dyn.add(g); return g; };
  /* ---- l'entrepôt : coque, quais, marquages, chariots, étagères, colis ---- */
  const buildWh = () => {
    const b = data.bounds, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    box(w + 2.4, 0.3, d + 2.4, 0xc4cacf, cx, -0.05, cz);
    const grid = new T.GridHelper(Math.max(w, d) + 2, Math.round((Math.max(w, d) + 2) / 3), 0xb3bac0, 0xb3bac0); grid.position.set(cx, 0.12, cz); dyn.add(grid);
    /* murs en coupe : fond et gauche ; devant ouvert comme sur un plan */
    box(w + 2.6, 5.2, 0.4, 0xe9ecee, cx, 2.5, b.minZ - 1.2, true); box(w + 2.6, 0.9, 0.46, 0x2f6db5, cx, 0.45, b.minZ - 1.2);
    box(0.4, 5.2, d + 2.4, 0xe9ecee, b.minX - 1.2, 2.5, cz, true); box(0.46, 0.9, d + 2.4, 0x2f6db5, b.minX - 1.2, 0.45, cz);
    box(0.4, 5.2, d + 2.4, 0xe9ecee, b.maxX + 1.2, 2.5, cz, true); box(0.46, 0.9, d + 2.4, 0x2f6db5, b.maxX + 1.2, 0.45, cz);
    box(w + 2.6, 0.35, 0.4, 0xaeb5bb, cx, 0.17, b.maxZ + 1.2);
    for (let x = b.minX + 6; x < b.maxX; x += 10) box(0.5, 5.2, 0.5, 0x8b949c, x, 2.6, b.minZ - 0.6, true);
    for (let z = b.minZ + 6; z < b.maxZ; z += 10) box(0.5, 5.2, 0.5, 0x8b949c, b.minX - 0.6, 2.6, z, true);
    /* quais de chargement à droite, avec leurs camions */
    [0.2, 0.5, 0.8].forEach((f, i) => { const z = b.minZ + d * f; box(0.5, 3.6, 4.2, 0x3a4552, b.maxX + 1.2, 1.8, z); box(0.4, 0.5, 4.8, 0xf2c230, b.maxX + 1.0, 0.3, z); if (i !== 1) truck(b.maxX + 8, z, 0, i ? 0x3b82c4 : 0xd23a3a); else box(6, 0.04, 4.4, 0xf2c230, b.maxX + 4, 0.06, z); });
    /* marquages au sol : allées jaunes entre les rangées, contour des zones */
    const rows = Math.max(1, Math.round((data.store.d + AZ) / (RD + AZ)));
    for (let r = 0; r < rows; r++) box(data.store.w + 2, 0.03, 0.14, 0xf2c230, data.store.w / 2, 0.16, r * (RD + AZ) + RD + AZ / 2);
    box(0.14, 0.03, d, 0xf2c230, data.store.w + 3.5, 0.16, cz);
    /* zones d'étapes */
    zoneMeshes = {};
    data.zones.forEach(z => {
      const m = new T.Mesh(new T.BoxGeometry(z.w, 0.1, z.d), new T.MeshStandardMaterial({ color: z.color, roughness: 0.9, transparent: true, opacity: 0.45, emissive: 0x000000 })); m.position.set(z.x, 0.17, z.z); m.receiveShadow = true; dyn.add(m); zoneMeshes[z.id] = m;
      const e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(z.w, 0.1, z.d)), new T.LineBasicMaterial({ color: 0x2f6db5 })); e.position.copy(m.position); dyn.add(e);
      label(z.name, z.n + (z.over ? ' (+' + z.over + ')' : ''), z.x, 0.9, z.z + z.d / 2 + 0.2, 4.2);
    });
    /* étagères */
    const n = data.racks.length;
    if (n) {
      const posts = new T.InstancedMesh(new T.BoxGeometry(0.09, 2.7, 0.09), std(0x2f6db5), n * 4), beams = new T.InstancedMesh(new T.BoxGeometry(RW, 0.07, 0.07), std(0xe07b2e), n * 6), planks = new T.InstancedMesh(new T.BoxGeometry(RW, 0.04, RD), std(0xcfd4d9), n * 3);
      let ip = 0, ib = 0, il = 0; const set = (m, i, x, y, z) => { tmp.position.set(x, y, z); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); };
      data.racks.forEach(r => {
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => set(posts, ip++, r.x + sx * (RW / 2 - 0.05), 1.35, r.z + sz * (RD / 2 - 0.05))));
        LV.forEach(y => { set(planks, il++, r.x, y - 0.02, r.z); [-1, 1].forEach(sz => set(beams, ib++, r.x, y - 0.1, r.z + sz * (RD / 2 - 0.05))); });
        label(r.name, r.n + (r.over ? ' (+' + r.over + ')' : ''), r.x, 3.35, r.z);
      });
      [posts, beams, planks].forEach(m => { m.castShadow = true; m.receiveShadow = true; dyn.add(m); });
    }
    /* colis */
    boxMesh = null;
    if (data.boxes.length) {
      boxMesh = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.42, 0.9), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), data.boxes.length); const col = new T.Color();
      data.boxes.forEach((bx, i) => { tmp.position.set(bx.x, bx.y, bx.z); tmp.updateMatrix(); boxMesh.setMatrixAt(i, tmp.matrix); boxMesh.setColorAt(i, col.set(bx.dim ? 0xdcdfe2 : (STAGE_COL[bx.stage] || 0x888888))); });
      boxMesh.castShadow = true; boxMesh.receiveShadow = true; dyn.add(boxMesh);
    }
    /* vie : chariots qui circulent dans les allées, personnel, parking */
    movers = [];
    const a0 = RD + AZ / 2; movers.push({ g: forklift(2, a0, Math.PI / 2), ax: 'x', c: data.store.w / 2, a: Math.max(3, data.store.w / 2 - 2), z: a0, s: 0.0007 });
    movers.push({ g: forklift(data.store.w + 5, 4, 0), ax: 'z', c: cz, a: Math.max(3, d / 2 - 4), x: data.store.w + 5, s: 0.0005 });
    [[data.store.w + 2.5, 3, 0xff7a1a], [data.store.w + 4.5, d - 4, 0x3b82c4], [data.store.w / 2, a0 + 3, 0xff7a1a], [data.store.w + 12, cz + 3, 0x4aa56a]].forEach(([x, z, c]) => worker(x, z, c));
    const carC = [0xd23a3a, 0x3b82c4, 0xf5f6f7, 0x2f3a45, 0xe8a33d, 0x4aa56a];
    carC.forEach((c, i) => { const g = new T.Group(), body = new T.Mesh(new T.BoxGeometry(2, 0.7, 4), std(c)), top = new T.Mesh(new T.BoxGeometry(1.7, 0.6, 2), std(0x9fb4c4)); body.position.y = 0.55; top.position.set(0, 1.15, -0.2); body.castShadow = true; g.add(body, top); g.position.set(b.minX + 4 + i * 3.4, 0, b.maxZ + 6); dyn.add(g); });
    box(w + 14, 0.05, 6, 0x9aa1a8, cx, -0.04, b.maxZ + 6);
    trees(b, 14, 34); addPins();
  };
  /* ---- le quartier des acheteurs ---- */
  const buildTown = () => {
    const b = data.bounds, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    box(w + 6, 0.2, d + 6, 0x8f969d, cx, -0.05, cz);
    townMeshes = [];
    data.buildings.forEach(bl => {
      box(data.cell - 1.4, 0.16, data.cell - 1.4, 0xdfe3e6, bl.x, 0.08, bl.z);
      const body = new T.Mesh(new T.BoxGeometry(bl.w, bl.h, bl.w), new T.MeshStandardMaterial({ color: bl.dim ? 0xdcdfe2 : bl.color, roughness: 0.8 })); body.position.set(bl.x, bl.h / 2 + 0.16, bl.z); body.castShadow = true; body.receiveShadow = true; body.userData = { buyerKey: bl.k }; dyn.add(body); townMeshes.push(body);
      const roof = new T.Mesh(new T.BoxGeometry(bl.w + 0.3, 0.22, bl.w + 0.3), std(bl.dim ? 0xc9cdd1 : 0x3a4552)); roof.position.set(bl.x, bl.h + 0.27, bl.z); roof.castShadow = true; dyn.add(roof);
      for (let f = 1; f < Math.min(bl.n, 12) + 1; f++) { const y = 1.4 + f * 1.15; [-1, 1].forEach(s => { const win = new T.Mesh(new T.BoxGeometry(bl.w * 0.7, 0.35, 0.05), std(0xbfe0f5)); win.position.set(bl.x, y, bl.z + s * (bl.w / 2 + 0.03)); dyn.add(win); }); }
      if (bl.tag === 'fidele') { const a = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.2, 6), std(0x333333)); a.position.set(bl.x, bl.h + 0.9, bl.z); dyn.add(a); }
      label('@' + bl.nom, bl.n + (bl.n > 1 ? ' achats' : ' achat'), bl.x, bl.h + 2.6, bl.z, 4.2);
    });
    const rnd = (() => { let a = 11; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(); const carC = [0xd23a3a, 0x3b82c4, 0xf5f6f7, 0x2f3a45, 0xe8a33d];
    for (let i = 0; i < Math.min(14, data.buildings.length); i++) { const g = new T.Group(), body = new T.Mesh(new T.BoxGeometry(1.1, 0.5, 2.2), std(carC[i % 5])); body.position.y = 0.4; body.castShadow = true; g.add(body); g.position.set(rnd() * (w - 2), 0, Math.floor(rnd() * Math.max(1, d / data.cell)) * data.cell + 0.4); dyn.add(g); }
    trees(b, 8, 30); addPins();
  };
  const build = () => {
    if (dyn) { scene.remove(dyn); free(dyn); }
    dyn = new T.Group(); scene.add(dyn); pinSprites = []; zoneMeshes = {}; townMeshes = []; boxMesh = null; movers = [];
    if (mode === 'town') buildTown(); else buildWh();
  };
  /* ---- choisir un objet : pins d'abord, puis colis ou immeubles ---- */
  const setRay = ev => { const r = renderer.domElement.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); };
  const pick = ev => {
    setRay(ev);
    const ps = ray.intersectObjects(pinSprites, false); if (ps.length) return { pin: ps[0].object.userData };
    if (boxMesh) { const h = ray.intersectObject(boxMesh, false); if (h.length && h[0].instanceId != null) return { box: data.boxes[h[0].instanceId] }; }
    if (townMeshes.length) { const h = ray.intersectObjects(townMeshes, false); if (h.length) return { building: h[0].object.userData.buyerKey }; }
    return null;
  };
  /* ---- glisser une pièce vers une zone (entrepôt seulement) ---- */
  let down = null, drag = null, ghost = null, timer = 0;
  const startDrag = () => {
    if (!down || !down.box) return; drag = down.box; ctl.enabled = false;
    ghost = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 0.52), new T.MeshStandardMaterial({ color: STAGE_COL[drag.stage] || 0x888888, transparent: true, opacity: 0.85 })); ghost.position.set(drag.x, 1, drag.z); scene.add(ghost);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* sans vibration */ } }
  };
  const light = id => Object.keys(zoneMeshes).forEach(k => zoneMeshes[k].material.emissive.setHex(k === id ? 0x444444 : 0));
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', ev => {
    const h = mode === 'wh' ? pick(ev) : null; down = { x: ev.clientX, y: ev.clientY, box: h && h.box, moved: false };
    if (down.box) { if (ev.pointerType === 'mouse') ctl.enabled = false; else timer = setTimeout(startDrag, 380); }
  });
  dom.addEventListener('pointermove', ev => {
    if (!down) return; if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) { down.moved = true; if (!drag && down.box && ev.pointerType === 'mouse') startDrag(); else if (!drag) clearTimeout(timer); }
    if (drag) { setRay(ev); if (ray.ray.intersectPlane(plane, hit)) { ghost.position.set(hit.x, 1, hit.z); light(dropTarget(data, hit.x, hit.z)); } }
  });
  const reset = () => { clearTimeout(timer); down = null; drag = null; ctl.enabled = true; light(''); if (ghost) { scene.remove(ghost); free(ghost); ghost = null; } };
  dom.addEventListener('pointerup', ev => {
    const d = down, g = drag; reset(); if (!d) return;
    if (g) { setRay(ev); if (ray.ray.intersectPlane(plane, hit)) { const t = dropTarget(data, hit.x, hit.z); if (t) cb.onDrop(g.id, t); } return; }
    if (!d.moved) { const h = pick(ev); if (h) cb.onPick(h); }
  });
  dom.addEventListener('pointercancel', reset); dom.addEventListener('contextmenu', e => e.preventDefault());
  const resize = () => { if (!host.isConnected || !W()) return; renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; if (ro) ro.observe(host);
  const dispose = () => { run = false; if (ro) ro.disconnect(); if (dyn) free(dyn); ctl.dispose(); renderer.dispose(); if (dom.parentNode) dom.parentNode.removeChild(dom); };
  /* la scène reste en vie quand le CRM se redessine (l'élément est juste déplacé) : on ne dessine que quand elle est visible */
  const loop = t => {
    if (!run) return; requestAnimationFrame(loop); if (!host.isConnected) return;
    pinSprites.forEach((s, i) => { s.position.y = s.userData.y + Math.sin(t / 420 + i) * 0.12; });
    movers.forEach(m => { const o = Math.sin(t * m.s) * m.a; if (m.ax === 'x') { m.g.position.set(m.c + o, 0.1, m.z); m.g.rotation.y = Math.cos(t * m.s) > 0 ? Math.PI / 2 : -Math.PI / 2; } else { m.g.position.set(m.x, 0.1, m.c + o); m.g.rotation.y = Math.cos(t * m.s) > 0 ? 0 : Math.PI; } });
    ctl.update(); renderer.render(scene, cam);
  };
  requestAnimationFrame(loop);
  return { setData(m, d) { mode = m; data = d; build(); if (framedMode !== m) frame(); }, recenter() { if (data) frame(); }, resize, dispose };
}

/* ---------- le panneau intégré au CRM : la vue de base ---------- */
/* Le CRM redessine son contenu souvent ; la scène 3D, elle, est créée une seule fois et simplement déplacée dans la nouvelle case (#wh_slot).
   Toucher une pièce ouvre sa fiche par-dessus : on la ferme et la 3D est exactement comme avant. */
let glOk = null;
export const canGL = () => { if (glOk === null) { try { const c = document.createElement('canvas'); glOk = !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { glOk = false; } } return glOk; };
const FS = { m: '', c: '', b: '', al: true, view: LSg('whView', 'wh') };
const S = { host: null, sc: null, loading: false, failed: false, sig: '' };
const uniqP = f => [...new Set(app.P.filter(inPipeline).map(f).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
export function whPanel() {
  const wh = FS.view === 'wh';
  return `<div class="chips" style="margin-bottom:8px"><button type="button" class="chip sm${wh ? ' on' : ''}" data-whv="wh">${t('Entrepôt')}</button><button type="button" class="chip sm${wh ? '' : ' on'}" data-whv="town">${t('Quartier des acheteurs')}</button>${wh ? `<button type="button" class="chip sm${FS.al ? ' on' : ''}" id="wh_al">${t('Alertes')}</button>` : ''}<button type="button" class="chip sm" id="wh_rc">${t('Recentrer')}</button></div>
   <div class="chips whc">${wh ? `<select id="wh_m" aria-label="${esc(t('Marque'))}"><option value="">${t('Toutes les marques')}</option>${uniqP(p => p.marque).map(x => `<option value="${esc(x)}"${FS.m === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
   <select id="wh_c" aria-label="${esc(t('Catégorie'))}"><option value="">${t('Toutes les catégories')}</option>${uniqP(p => p.cat).map(x => `<option value="${esc(x)}"${FS.c === x ? ' selected' : ''}>${esc(tv(x))}</option>`).join('')}</select>` : ''}
   <input type="search" id="wh_b" value="${esc(FS.b)}" placeholder="${esc(t(wh ? 'Acheteur' : 'Chercher un acheteur (@pseudo)'))}" autocomplete="off" autocapitalize="none"></div>
   <div id="wh_slot" class="wh3d"></div><div id="wh_m2" class="hint"></div>
   <p class="hint">${t(wh ? 'Étagères : tes bacs. Zones au sol : les étapes de la vente. Touche un colis pour ouvrir la fiche, ou maintiens-le et glisse-le vers une zone.' : 'Un immeuble par acheteur : plus il achète, plus il est haut. Touche un immeuble pour ouvrir sa fiche.')}</p>`;
}
const keepP = p => (!FS.m || p.marque === FS.m) && (!FS.c || p.cat === FS.c) && (!FS.b || String(p.acheteur || (p.offre || {}).a || '').toLowerCase().includes(FS.b.toLowerCase().replace(/^@/, '')));
const keepC = c => !FS.b || c.nom.toLowerCase().includes(FS.b.toLowerCase().replace(/^@/, ''));
const sigNow = () => signature(app.P) + '|' + FS.view + FS.m + FS.c + FS.b + FS.al + (FS.view === 'town' ? JSON.stringify(app.cfg.crm || {}).length : '');
function refresh() {
  if (!S.sc) return; S.sig = sigNow();
  if (FS.view === 'town') { const d = layoutTown(contacts(), { keep: keepC }); S.sc.setData('town', d); const m = $('wh_m2'); if (m) m.textContent = d.total > d.shown ? t('{n} acheteurs affichés sur {m}', { n: d.shown, m: d.total }) : ''; return; }
  const d = layoutWarehouse(app.P, { keep: keepP }); if (!FS.al) d.pins = d.pins.filter(p => p.kind !== 'alert'); S.sc.setData('wh', d);
  const a = app.P.filter(p => expired(p) || slowParcel(p)).length, m = $('wh_m2'); if (m) m.textContent = a ? t('{n} pièce(s) demandent ton attention (pins rouges).', { n: a }) : '';
}
const fail = msg => { S.failed = true; S.loading = false; const s = $('wh_slot'); if (s) s.innerHTML = `<div class="hint" style="padding:16px">${esc(msg)} <button type="button" class="chip sm" data-crs="pipe">${t('Voir le pipeline')}</button></div>`; };
/** Place la scène dans la case du CRM (la crée au premier appel). */
export async function whMount(slot) {
  if (!slot) return;
  if (S.sc) { slot.appendChild(S.host); S.sc.resize(); if (sigNow() !== S.sig) refresh(); return; }
  if (S.failed) return fail(t('La 3D n\'est pas disponible sur cet appareil.'));
  slot.innerHTML = `<div class="hint" style="padding:16px">${t('Chargement de la 3D…')}</div>`;
  if (S.loading) return; S.loading = true;
  let T, OC; try { [T, { OrbitControls: OC }] = await Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]); } catch (e) { return fail(t('La 3D n\'a pas pu se charger : vérifie ta connexion puis réessaie.')); }
  S.host = document.createElement('div'); S.host.style.cssText = 'width:100%;height:100%';
  const cur = $('wh_slot'); if (!cur) { S.loading = false; return; } cur.innerHTML = ''; cur.appendChild(S.host);
  try {
    S.sc = createScene(T, OC, S.host, {
      onPick: h => { if (h.box) return app.openSheet(h.box.id); if (h.building) return app.openContact(h.building); if (h.pin.pieceId) return app.openSheet(h.pin.pieceId); if (h.pin.buyerKey) return app.openContact(h.pin.buyerKey); if (h.pin.zoneId) app.toast(t('{n} pièce(s) : {z}', { n: h.pin.text, z: h.pin.label })); },
      onDrop: (id, target) => { const p = app.P.find(x => x.id === id); if (!p) return; moveTo(id, target === 'hall' ? 'ligne' : target); refresh(); },
    });
  } catch (e) { return fail(t('La 3D n\'est pas disponible sur cet appareil.')); }
  S.loading = false; refresh();
  setInterval(() => { if (S.host && S.host.isConnected && sigNow() !== S.sig) refresh(); }, 900);
}
document.addEventListener('click', e => {
  const v = e.target.closest && e.target.closest('[data-whv]'); if (v && $('wh_slot')) { FS.view = v.dataset.whv; LSs('whView', FS.view); return app.crmSub && app.crmSub('3d'); }
  if (e.target.closest && e.target.closest('#wh_al')) { FS.al = !FS.al; e.target.closest('#wh_al').classList.toggle('on', FS.al); return refresh(); }
  if (e.target.closest && e.target.closest('#wh_rc') && S.sc) S.sc.recenter();
});
document.addEventListener('change', e => { if (e.target.id === 'wh_m') { FS.m = e.target.value; refresh(); } else if (e.target.id === 'wh_c') { FS.c = e.target.value; refresh(); } });
document.addEventListener('input', e => { if (e.target.id === 'wh_b') { FS.b = e.target.value.trim(); refresh(); } });
/** « Entrepôt 3D » depuis ailleurs : ouvre le CRM sur la vue 3D. */
export function openWarehouse() { if (app.setStockMode) app.setStockMode('crm'); if (app.crmSub) app.crmSub('3d'); go('list'); }
app.openWarehouse = openWarehouse; app.whPanel = whPanel; app.whMount = whMount; app.whCan = canGL;
