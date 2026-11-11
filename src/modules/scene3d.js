import { TYPES, advance, buildNav, canPlace, dims, findPath, isFloor, moveItem, nearestFree, rectOf, roleFor, diffMoves, rotateItem, standPoint, typeLabel } from './plan3d.js';

/* ---------- Scène 3D (Three.js) : lieu, meubles, colis avec photo, personnages, éditeur ---------- */
/* Créée une seule fois puis déplacée dans le CRM (voir warehouse3d.js). Rien ici ne touche aux données : tout passe par les rappels cb. */
export const STAGE_COL = { brouillon: 0xcdbf9f, ligne: 0xb57b3a, offre: 0xe8a33d, envoyer: 0x3b82c4, expedie: 0x7a6fc4, finalise: 0x4aa56a };
const PIN_COL = { alert: 0xd23a3a, offre: 0xe8a33d, ship: 0x3b82c4, sent: 0x7a6fc4, done: 0x4aa56a, custom: 0x6b7280 };
const CAT_PAL = [0xc98a4b, 0x6b9bd1, 0x8dbb6a, 0xd17b8f, 0xb08bd1, 0xe0b04a, 0x5fb3a8, 0xd9825b, 0x8f9aa8, 0xa3a35c];
export const catColor = cat => { let h = 0; String(cat || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return CAT_PAL[h % CAT_PAL.length]; };
const hex = n => '#' + n.toString(16).padStart(6, '0');
const TILE = 128, COLS = 16, MAXT = COLS * COLS;

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

/** T = Three, OC = OrbitControls, host = élément, cb = { onPick, onDrop, onPlan, onSelect, info, photoFor }.
    Renvoie { setPlace, setTown, setEdit, select, recenter, resize, dispose }. */
export function createScene(T, OC, host, cb) {
  const W = () => host.clientWidth || 600, H = () => host.clientHeight || 440;
  const RB = cb.extra && cb.extra.RB, RE = cb.extra && cb.extra.RE, renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W(), H()); renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  host.style.position = 'relative'; host.appendChild(renderer.domElement); const dom = renderer.domElement; dom.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  const scene = new T.Scene(); host.style.background = 'linear-gradient(#8fbfe8 0%, #cfe3f2 48%, #eef3f6 100%)';
  const cam = new T.PerspectiveCamera(28, W() / H(), 0.5, 900), ctl = new OC(cam, dom);
  ctl.enableDamping = true; ctl.maxPolarAngle = 1.3; ctl.minPolarAngle = 0.25; ctl.screenSpacePanning = false;
  scene.add(new T.HemisphereLight(0xeaf3ff, 0xa9b4a0, 0.7));
  const sun = new T.DirectionalLight(0xfff1dc, 1.7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; scene.add(sun, sun.target);
  const ground = new T.Mesh(new T.PlaneGeometry(1400, 1400), new T.MeshStandardMaterial({ color: 0xcfe0c4 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true; scene.add(ground);
  const ray = new T.Raycaster(), ndc = new T.Vector2(), gplane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3(), tmp = new T.Object3D();
  const matCache = new Map(), std = (c, r = 0.85, mt = 0) => { const k = c + '|' + r + '|' + mt; let m = matCache.get(k); if (!m) { m = new T.MeshStandardMaterial({ color: c, roughness: r, metalness: mt }); matCache.set(k, m); } return m; };
  const rgeo = (w, h, d, rad) => (RB && rad ? new RB(w, h, d, 2, Math.min(rad, w / 2.2, h / 2.2, d / 2.2)) : new T.BoxGeometry(w, h, d));
  const freeGeo = g => g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.own) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });

  /* ----- état ----- */
  let mode = 'wh', data = null, town = null, framed = '', run = true, editing = false, selected = '', spans = 40, nav = null, navBig = null;
  let quality = 'high', envTex = null, pmrem = null; let shellG = null, piecesG = null, pinsG = null, labelsG = null, pinSprites = [], pieceList = [], pieceById = new Map(), townMeshes = [], itemGroups = new Map(), selBox = null, gridH = null, shellSig = '';
  const transit = new Map(), tasks = [], agents = [];
  let prevBoxes = new Map(), firstPlace = true;

  /* ----- atlas de photos : une vignette par pièce (photo, ou couleur de catégorie avec le code) ----- */
  const atlas = document.createElement('canvas'); atlas.width = atlas.height = TILE * COLS; const actx = atlas.getContext('2d');
  actx.fillStyle = '#c9a36b'; actx.fillRect(0, 0, atlas.width, atlas.height);
  const atex = new T.CanvasTexture(atlas); atex.colorSpace = T.SRGBColorSpace; atex.anisotropy = 4;
  const photoMat = new T.MeshStandardMaterial({ map: atex, roughness: 0.8 }); photoMat.userData.own = false;
  const tiles = new Map(), photoDone = new Set(); let tileN = 0, dirty = false, loading = 0; const photoQ = [];
  const drawTile = (idx, id, img) => {
    const info = cb.info(id) || {}, x = (idx % COLS) * TILE, y = Math.floor(idx / COLS) * TILE;
    actx.save(); actx.beginPath(); actx.rect(x, y, TILE, TILE); actx.clip();
    if (img) { const k = Math.max(TILE / img.width, TILE / img.height), w = img.width * k, h = img.height * k; actx.drawImage(img, x + (TILE - w) / 2, y + (TILE - h) / 2, w, h); }
    else { actx.fillStyle = hex(catColor(info.cat)); actx.fillRect(x, y, TILE, TILE); actx.fillStyle = 'rgba(255,255,255,.95)'; actx.font = '700 22px sans-serif'; actx.textAlign = 'center'; actx.textBaseline = 'middle'; actx.fillText(String(info.catLabel || '').slice(0, 11), x + TILE / 2, y + 48); actx.font = '600 15px sans-serif'; actx.fillText(String(info.size || ''), x + TILE / 2, y + 76); }
    actx.fillStyle = 'rgba(20,20,18,.72)'; actx.fillRect(x, y + TILE - 24, TILE, 24); actx.fillStyle = '#fff'; actx.font = '600 15px monospace'; actx.textAlign = 'center'; actx.textBaseline = 'middle'; actx.fillText(String(info.code || '').slice(0, 12), x + TILE / 2, y + TILE - 12);
    actx.restore(); dirty = true;
  };
  const tileOf = id => { if (tiles.has(id)) return tiles.get(id); if (tileN >= MAXT) return -1; const i = tileN++; tiles.set(id, i); drawTile(i, id, null); return i; };
  const pump = () => { while (loading < 4 && photoQ.length) { const id = photoQ.shift(); loading++; Promise.resolve(cb.photoFor ? cb.photoFor(id) : null).then(img => { if (img) { const i = tiles.get(id); if (i != null) drawTile(i, id, img); } }).catch(() => {}).finally(() => { loading--; pump(); }); } };
  const wantPhoto = id => { if (photoDone.has(id)) return; photoDone.add(id); photoQ.push(id); pump(); };
  const faceUV = (geo, face, idx, w, h, mirror) => {
    const uv = geo.attributes.uv, pos = geo.attributes.position, g = geo.groups[face], ix = geo.index; if (!g || !ix) return;
    const u0 = (idx % COLS) / COLS, v0 = 1 - (Math.floor(idx / COLS) + 1) / COLS, seen = new Set();
    for (let i = g.start; i < g.start + g.count; i++) { const v = ix.getX(i); if (seen.has(v)) continue; seen.add(v); let u = pos.getX(v) / w + 0.5; if (mirror) u = 1 - u; uv.setXY(v, u0 + Math.max(0, Math.min(1, u)) / COLS, v0 + Math.max(0, Math.min(1, pos.getY(v) / h + 0.5)) / COLS); }
    uv.needsUpdate = true;
  };

  /* ----- petits outils de construction ----- */
  const bx = (g, w, h, d, c, x, y, z, cast, rad, rough, metal) => { const m = new T.Mesh(rgeo(w, h, d, rad), std(c, rough == null ? 0.85 : rough, metal || 0)); m.position.set(x, y, z); m.castShadow = cast !== false; m.receiveShadow = true; g.add(m); return m; };
  const label = (g, text, sub, x, y, z, sx) => { const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(labelTexture(text, sub)), depthTest: false, fog: false })); s.scale.set(sx || 3.4, (sx || 3.4) * 0.3, 1); s.position.set(x, y, z); s.renderOrder = 4; s.material.userData.own = true; g.add(s); return s; };
  const trees = (g, b, ring, n, seed) => {
    const rnd = (() => { let a = seed || 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(), pts = [];
    for (let k = 0; k < 500 && pts.length < n; k++) { const x = b.minX - ring - 10 + rnd() * (b.maxX - b.minX + 2 * ring + 20), z = b.minZ - ring - 10 + rnd() * (b.maxZ - b.minZ + 2 * ring + 20); if (x > b.minX - ring && x < b.maxX + ring && z > b.minZ - ring && z < b.maxZ + ring) continue; pts.push([x, z, 0.8 + rnd() * 0.9]); }
    if (!pts.length) return;
    const fol = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), std(0x86c46f), pts.length), trk = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.16, 1, 6), std(0x8a6a4a), pts.length);
    pts.forEach(([x, z, s], i) => { tmp.position.set(x, 0.5 * s + 0.4, z); tmp.scale.set(0.2, s, 0.2); tmp.updateMatrix(); trk.setMatrixAt(i, tmp.matrix); tmp.position.set(x, 1.3 * s + 0.8, z); tmp.scale.set(s, s, s); tmp.updateMatrix(); fol.setMatrixAt(i, tmp.matrix); });
    tmp.scale.set(1, 1, 1); fol.castShadow = true; g.add(trk, fol);
  };

  /* ----- les meubles ----- */
  const furniture = it => {
    const g = new T.Group(), { w, d, h } = dims(it), WOOD = 0xc8a26b, DARK = 0x6b5a45;
    if (it.type === 'rack') {
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => bx(g, 0.09, 2.7, 0.09, 0x2f6db5, sx * (w / 2 - 0.05), 1.35, sz * (d / 2 - 0.05), true, 0, 0.35, 0.6)));
      [0.28, 1.2, 2.12].forEach(y => { bx(g, w, 0.04, d, 0xcfd4d9, 0, y - 0.02, 0); [-1, 1].forEach(sz => bx(g, w, 0.07, 0.07, 0xe07b2e, 0, y - 0.1, sz * (d / 2 - 0.05), true, 0, 0.4, 0.5)); });
    } else if (it.type === 'shelf') {
      bx(g, w, h, 0.04, WOOD, 0, h / 2, -d / 2 + 0.02); [-1, 1].forEach(s => bx(g, 0.04, h, d, WOOD, s * (w / 2 - 0.02), h / 2, 0)); [0.2, 0.8, 1.35, 1.9, h].forEach(y => bx(g, w, 0.04, d, WOOD, 0, y - 0.02, 0));
    } else if (it.type === 'wardrobe') {
      bx(g, w, h, 0.04, 0xe9e6e0, 0, h / 2, -d / 2 + 0.02); [-1, 1].forEach(s => bx(g, 0.04, h, d, 0xe9e6e0, s * (w / 2 - 0.02), h / 2, 0)); bx(g, w, 0.04, d, 0xe9e6e0, 0, h - 0.02, 0); bx(g, w, 0.04, d, 0xe9e6e0, 0, 0.1, 0);
      const rail = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, w - 0.1, 8), std(0x9aa1a8)); rail.rotation.z = Math.PI / 2; rail.position.set(0, 1.62, 0); g.add(rail);
    } else if (it.type === 'chest') {
      bx(g, w, h, d, 0xb98f5a, 0, h / 2, 0, true, 0.03, 0.6); [0.2, 0.5, 0.8].forEach(y => bx(g, w - 0.1, 0.02, 0.02, DARK, 0, y, d / 2 + 0.005)); bx(g, w + 0.04, 0.04, d + 0.04, 0xa77c4a, 0, h + 0.02, 0);
    } else if (it.type === 'table') {
      bx(g, w, 0.06, d, 0xe6e9ec, 0, h, 0, true, 0.02, 0.35); [-1, 1].forEach(sx => [-1, 1].forEach(sz => bx(g, 0.06, h, 0.06, 0x8b949c, sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1))));
      const tape = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.08, 12), std(0xe0b04a)); tape.position.set(w / 2 - 0.3, h + 0.07, d / 2 - 0.2); g.add(tape);
    } else if (it.type === 'zone' || it.type === 'dock') {
      const col = STAGE_COL[it.stage] || 0x888888, m = new T.Mesh(new T.BoxGeometry(w, 0.06, d), new T.MeshStandardMaterial({ color: col, roughness: 0.9, transparent: true, opacity: 0.5, emissive: 0x000000 })); m.position.y = 0.2; m.receiveShadow = true; g.add(m); m.userData.zoneMat = true;
      const e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w, 0.06, d)), new T.LineBasicMaterial({ color: it.type === 'dock' ? 0xf2c230 : 0x2f6db5 })); e.position.y = 0.2; g.add(e);
      if (it.type === 'dock') for (let i = -Math.floor(w / 2); i <= Math.floor(w / 2); i++) bx(g, 0.1, 0.02, d, 0xf2c230, i * 1, 0.24, 0, false);
    } else if (it.type === 'sofa') {
      bx(g, w, 0.4, d, 0x7a6fc4, 0, 0.3, 0, true, 0.1, 0.95); bx(g, w - 0.1, 0.5, 0.25, 0x6a5fb0, 0, 0.75, -d / 2 + 0.12, true, 0.1, 0.95); [-1, 1].forEach(s => bx(g, 0.25, 0.32, d, 0x6a5fb0, s * (w / 2 - 0.12), 0.65, 0, true, 0.1, 0.95)); bx(g, w - 0.7, 0.14, d - 0.35, 0x8579d6, 0, 0.58, 0.08, false, 0.06, 1);
    } else if (it.type === 'bed') {
      bx(g, w, 0.3, d, 0x8a6a4a, 0, 0.2, 0, true, 0.04, 0.6); bx(g, w - 0.1, 0.22, d - 0.1, 0xf5f6f7, 0, 0.46, 0, true, 0.09, 1); bx(g, 0.5, 0.12, d - 0.4, 0xe0e6ee, -w / 2 + 0.35, 0.62, 0); bx(g, 0.08, 0.7, d, 0x8a6a4a, -w / 2, 0.5, 0);
    } else if (it.type === 'desk') {
      bx(g, w, 0.05, d, 0xc8a26b, 0, 0.75, 0, true, 0.015, 0.5); [-1, 1].forEach(sx => bx(g, 0.05, 0.75, d - 0.1, 0x8a6a4a, sx * (w / 2 - 0.05), 0.37, 0)); bx(g, 0.5, 0.3, 0.04, 0x2f3a45, 0, 1.0, -0.1); bx(g, 0.06, 0.2, 0.06, 0x2f3a45, 0, 0.88, -0.1);
    } else if (it.type === 'plant') {
      const pot = new T.Mesh(new T.CylinderGeometry(0.22, 0.17, 0.4, 10), std(0xb5651d)); pot.position.y = 0.2; pot.castShadow = true; g.add(pot);
      const lf = new T.Mesh(new T.IcosahedronGeometry(0.42, 0), std(0x4aa56a)); lf.position.y = 0.85; lf.castShadow = true; g.add(lf);
    } else if (it.type === 'pallet') {
      [-0.35, 0, 0.35].forEach(z => bx(g, w, 0.07, 0.18, WOOD, 0, 0.12, z)); [-0.5, 0, 0.5].forEach(x => bx(g, 0.12, 0.08, d, 0xb8935a, x * (w / 1.3), 0.04, 0)); bx(g, w, 0.04, d, WOOD, 0, 0.17, 0);
    }
    g.position.set(it.x, 0, it.z); g.rotation.y = (it.rot || 0) * Math.PI / 2;
    g.traverse(o => { o.userData.itemId = it.id; }); return g;
  };

  /* ----- les lieux : sol, murs, extérieur ----- */
  /* ----- décor : luminaires, extincteurs, bornes, tableaux ----- */
  const decor = (tpl, b) => {
    const lamp = (x, z, len) => { bx(shellG, 0.06, 1.0, 0.06, 0x8b949c, x, tpl.wallH - 0.5, z, false); const m = new T.Mesh(new T.BoxGeometry(len, 0.08, 0.35), new T.MeshBasicMaterial({ color: 0xfff3cf })); m.position.set(x, tpl.wallH - 1.05, z); shellG.add(m); };
    if (tpl.shell === 'wh') {
      for (let x = b.minX + 5; x < b.maxX; x += 9) for (let z = b.minZ + 4; z < b.maxZ; z += 8) lamp(x, z, 2.2);
      for (let x = b.minX + 6; x < b.maxX; x += 10) { bx(shellG, 0.22, 0.5, 0.22, 0xd23a3a, x, 1.2, b.minZ + 0.55, false, 0.05, 0.5); bx(shellG, 0.5, 0.4, 0.04, 0x4aa56a, x, 2.3, b.minZ + 0.52, false); }
      for (let z = b.minZ + 2; z < b.maxZ; z += 6) { const bo = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.9, 10), std(0xf2c230, 0.6)); bo.position.set(b.minX + 0.6, 0.5, z); bo.castShadow = true; shellG.add(bo); }
    } else {
      (tpl.rooms || [{ x0: b.minX, x1: b.maxX, z0: b.minZ, z1: b.maxZ }]).forEach(r => lamp((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, 1.6));
      for (let x = b.minX + 4, k = 0; x < b.maxX - 1; x += 5, k++) bx(shellG, 1.0, 0.7, 0.04, [0xd9825b, 0x6b9bd1, 0x8dbb6a][k % 3], x, 1.65, b.minZ + 0.04, false, 0.01);
    }
  };
  const buildShell = () => {
    if (shellG) { scene.remove(shellG); freeGeo(shellG); }
    shellG = new T.Group(); scene.add(shellG); itemGroups = new Map(); const tpl = data.tpl, b = tpl.bounds, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, H = tpl.wallH;
    const floorC = tpl.shell === 'wh' ? 0xc4cacf : tpl.shell === 'room' ? 0xd9c7a8 : 0xe6e0d4;
    bx(shellG, w + 0.4, 0.3, d + 0.4, floorC, cx, -0.05, cz, false, 0, tpl.shell === 'wh' ? 0.55 : 0.4, 0.05);
    if (tpl.shell === 'house') (tpl.rooms || []).forEach(r => bx(shellG, r.x1 - r.x0 - 0.05, 0.02, r.z1 - r.z0 - 0.05, r.c, (r.x0 + r.x1) / 2, 0.11, (r.z0 + r.z1) / 2, false));
    if (tpl.shell === 'wh') { const gr = new T.GridHelper(Math.max(w, d) + 2, Math.round((Math.max(w, d) + 2) / 3), 0xb3bac0, 0xb3bac0); gr.position.set(cx, 0.12, cz); shellG.add(gr); }
    const wallC = tpl.shell === 'wh' ? 0xe9ecee : 0xf2efe8, base = 0x2f6db5;
    bx(shellG, w + 0.6, H, 0.3, wallC, cx, H / 2, b.minZ - 0.15); bx(shellG, 0.3, H, d + 0.6, wallC, b.minX - 0.15, H / 2, cz);
    if (tpl.shell === 'wh') { bx(shellG, w + 0.7, 0.9, 0.36, base, cx, 0.45, b.minZ - 0.15, false); bx(shellG, 0.36, 0.9, d + 0.7, base, b.minX - 0.15, 0.45, cz, false); bx(shellG, 0.3, H, d + 0.6, wallC, b.maxX + 0.15, H / 2, cz); bx(shellG, 0.36, 0.9, d + 0.7, base, b.maxX + 0.15, 0.45, cz, false); for (let x = b.minX + 6; x < b.maxX; x += 10) bx(shellG, 0.5, H, 0.5, 0x8b949c, x, H / 2, b.minZ + 0.25); }
    else { for (let i = 0; i < Math.floor(w / 4); i++) bx(shellG, 1.2, 1.1, 0.34, 0xbfe0f5, b.minX + 2 + i * 4, 1.7, b.minZ - 0.14, false); bx(shellG, w + 0.6, 0.12, 0.34, 0xd8d3c8, cx, 0.06, b.minZ - 0.15, false); bx(shellG, 0.34, 0.12, d + 0.6, 0xd8d3c8, b.minX - 0.15, 0.06, cz, false); }
    (tpl.walls || []).forEach(wl => bx(shellG, wl.x1 - wl.x0, wl.h || H, wl.z1 - wl.z0, 0xf2efe8, (wl.x0 + wl.x1) / 2, (wl.h || H) / 2, (wl.z0 + wl.z1) / 2));
    if (tpl.shell === 'house') { (tpl.rooms || []).forEach(r => label(shellG, r.n, '', (r.x0 + r.x1) / 2, 0.8, r.z1 - 0.5, 3)); bx(shellG, 0.3, H, d + 0.6, wallC, b.maxX + 0.15, H / 2, cz); }
    if (tpl.shell === 'wh') {
      (tpl.docks || []).forEach((p, i) => { bx(shellG, 0.5, 3.6, 4.2, 0x3a4552, p.x + 0.1, 1.8, p.z); bx(shellG, 0.4, 0.5, 4.8, 0xf2c230, p.x - 0.2, 0.3, p.z, false); if (i !== 1) { const tg = new T.Group(), tr = new T.Mesh(new T.BoxGeometry(10, 3, 3), std(0xf5f6f7)), cab = new T.Mesh(new T.BoxGeometry(2.4, 2.4, 3), std(i ? 0x3b82c4 : 0xd23a3a)); tr.position.set(0, 1.9, 0); cab.position.set(6.4, 1.4, 0); tr.castShadow = cab.castShadow = true; tg.add(tr, cab); [-3.5, 0, 4, 6.4].forEach(wx => [-1.5, 1.5].forEach(wz => { const wh = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.4, 12), std(0x2b2b2b)); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.5, wz); tg.add(wh); })); tg.position.set(p.x + 6.4, 0, p.z); shellG.add(tg); } });
      const carC = [0xd23a3a, 0x3b82c4, 0xf5f6f7, 0x2f3a45, 0xe8a33d, 0x4aa56a]; bx(shellG, w + 12, 0.05, 6, 0x9aa1a8, cx, -0.04, b.maxZ + 6, false);
      carC.forEach((c, i) => { const g = new T.Group(), body = new T.Mesh(new T.BoxGeometry(2, 0.7, 4), std(c)), top = new T.Mesh(new T.BoxGeometry(1.7, 0.6, 2), std(0x9fb4c4)); body.position.y = 0.55; top.position.set(0, 1.15, -0.2); body.castShadow = true; g.add(body, top); g.position.set(b.minX + 4 + i * 3.4, 0, b.maxZ + 6); shellG.add(g); });
    }
    decor(tpl, b);
    trees(shellG, b, tpl.shell === 'wh' ? 14 : 5, tpl.shell === 'wh' ? 34 : 18, 7);
    data.plan.items.forEach(it => { const g = furniture(it); shellG.add(g); itemGroups.set(it.id, g); });
    nav = buildNav(data.plan, tpl); navBig = buildNav(data.plan, tpl, { margin: 0.6 });
    spans = Math.max(w, d);
  };
  const outline = () => {
    if (selBox) { scene.remove(selBox); selBox.geometry.dispose(); selBox = null; }
    const it = editing && data && data.plan.items.find(i => i.id === selected); if (!it) return;
    const { w, d, h } = dims(it), q = (it.rot || 0) % 2, ww = q ? d : w, dd = q ? w : d;
    selBox = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(ww + 0.1, Math.max(h, 0.3) + 0.1, dd + 0.1)), new T.LineBasicMaterial({ color: 0xe8a33d })); selBox.position.set(it.x, Math.max(h, 0.3) / 2, it.z); scene.add(selBox);
  };

  /* ----- les colis ----- */
  const infoOf = id => cb.info(id) || {};
  const makePiece = (b, at) => {
    const info = infoOf(b.id), idx = tileOf(b.id), sc = b.sc || 1, hang = b.hang, cc = catColor(info.cat);
    const gw = hang ? 0.34 : 0.5 * sc, gh = hang ? 0.74 : 0.45 * sc, gd = hang ? 0.05 : 0.6 * sc, geo = rgeo(gw, gh, gd, hang ? 0.012 : 0.035 * sc);
    if (idx >= 0) { faceUV(geo, 4, idx, gw, gh, false); if (hang) faceUV(geo, 5, idx, gw, gh, true); }
    const side = b.dim ? std(0xdcdfe2) : std(cc), top = b.dim ? std(0xdcdfe2) : std(STAGE_COL[b.stage] || 0x888888), front = b.dim || idx < 0 ? std(b.dim ? 0xdcdfe2 : cc) : photoMat;
    const mesh = new T.Mesh(geo, hang ? [side, side, side, side, front, front] : [side, side, top, side, front, side]);
    const p = at || b; mesh.position.set(p.x, hang ? p.y - 0.1 : p.y, p.z); mesh.rotation.y = p.rot || 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.pieceId = b.id; mesh.userData.box = b;
    if (hang) { const hk = new T.Mesh(new T.BoxGeometry(0.3, 0.02, 0.02), std(0x9aa1a8)); hk.position.set(0, 0.4, 0); mesh.add(hk); }
    if (!b.dim) wantPhoto(b.id);
    return mesh;
  };
  const rebuildPieces = () => {
    if (piecesG) { scene.remove(piecesG); piecesG.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    piecesG = new T.Group(); scene.add(piecesG); pieceList = []; pieceById = new Map();
    data.placed.boxes.forEach(b => { const tr = transit.get(b.id); if (tr && tr.state === 'carried') return; const m = makePiece(b, tr ? tr.from : null); piecesG.add(m); pieceList.push(m); pieceById.set(b.id, m); });
    if (pinsG) { scene.remove(pinsG); pinsG.traverse(o => { if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } }); }
    if (labelsG) { scene.remove(labelsG); freeGeo(labelsG); } labelsG = new T.Group(); scene.add(labelsG); labels();
    pinsG = new T.Group(); scene.add(pinsG); pinSprites = [];
    data.placed.pins.forEach(p => { const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(pinTexture(PIN_COL[p.kind] || PIN_COL.custom, p.text)), depthTest: false, fog: false })); s.center.set(0.5, 0); s.scale.set(1.0, 1.33, 1); s.position.set(p.x, p.y, p.z); s.renderOrder = 5; s.userData = p; pinsG.add(s); pinSprites.push(s); });
  };
  const labels = () => {
    data.plan.items.forEach(it => { const k = TYPES[it.type].kind, u = data.placed.usage[it.id]; if (k === 'decor' || !u) return; const nm = k === 'store' ? (it.bac === undefined ? (it.name || typeLabel(it.type)) : (it.bac || t('Sans bac'))) : (data.stageNames[it.stage] || it.name || typeLabel(it.type)); label(labelsG, nm, u.n + '/' + u.cap, it.x, (TYPES[it.type].h || 0.2) + 0.9, it.z, spans > 30 ? 3.2 : 2.2); });
  };

  /* ----- les personnages ----- */
  const person = role => {
    const g = new T.Group(), col = { prep: 0x3b82c4, quai: 0xff7a1a, cariste: 0x4aa56a }[role] || 0x3b82c4, mesh = (w, h, d, c) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), std(c)); m.castShadow = true; return m; };
    const body = mesh(0.38, 0.55, 0.22, col); body.position.y = 1.05; g.add(body);
    const stripe = mesh(0.4, 0.07, 0.24, role === 'quai' ? 0xe8f3a8 : 0xdfe6ee); stripe.position.y = 1.05; g.add(stripe);
    const head = new T.Mesh(new T.SphereGeometry(0.15, 12, 10), std(0xf0c9a8)); head.position.y = 1.5; head.castShadow = true; g.add(head);
    const hat = new T.Mesh(new T.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(role === 'quai' ? 0xf2c230 : 0x2f3a45)); hat.position.y = 1.54; g.add(hat);
    const limb = (x, y, w, h, c) => { const p = new T.Group(); p.position.set(x, y, 0); const m = mesh(w, h, w, c); m.position.y = -h / 2; p.add(m); g.add(p); return p; };
    const blob = new T.Mesh(new T.CircleGeometry(0.4, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; g.add(blob);
    return { g, legL: limb(-0.1, 0.78, 0.14, 0.62, 0x2f3a45), legR: limb(0.1, 0.78, 0.14, 0.62, 0x2f3a45), armL: limb(-0.25, 1.3, 0.1, 0.5, col), armR: limb(0.25, 1.3, 0.1, 0.5, col) };
  };
  const forklift = () => {
    const g = new T.Group(), part = (w, h, d, c, px, py, pz) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), std(c)); m.position.set(px, py, pz); m.castShadow = true; g.add(m); };
    part(1.1, 0.7, 1.7, 0xf2c230, 0, 0.55, 0); part(0.9, 0.12, 0.1, 0x333333, 0, 1.75, 0.5); part(0.08, 1.7, 0.08, 0x333333, -0.45, 1.1, 0.5); part(0.08, 1.7, 0.08, 0x333333, 0.45, 1.1, 0.5);
    part(0.1, 0.06, 1.1, 0x666666, -0.3, 0.2, 1.4); part(0.1, 0.06, 1.1, 0x666666, 0.3, 0.2, 1.4); part(0.5, 0.5, 0.5, 0x2f3a45, 0, 1.1, -0.35); const hd = new T.Mesh(new T.SphereGeometry(0.15, 10, 8), std(0xf0c9a8)); hd.position.set(0, 1.5, -0.35); g.add(hd);
    return { g };
  };
  const spawn = () => {
    agents.forEach(a => scene.remove(a.g)); agents.length = 0;
    const tpl = data.tpl, b = tpl.bounds;
    tpl.roles.forEach((role, i) => {
      const big = role === 'cariste', m = big ? forklift() : person(role), n = big ? navBig : nav, p = nearestFree(n, b.minX + (b.maxX - b.minX) * (0.2 + 0.15 * i), b.minZ + (b.maxZ - b.minZ) * 0.5, 30) || { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
      scene.add(m.g); m.g.position.set(p.x, 0.1, p.z);
      agents.push(Object.assign(m, { role, big, w: { x: p.x, z: p.z, rot: 0, speed: big ? 2.3 : 1.5, path: [] }, state: 'idle', idleT: 0.5 + i * 0.7, task: null, carry: null, phase: 0, wait: 0, stuck: 0, id: i }));
    });
  };
  const standFor = (n, id, pos) => { const it = data.plan.items.find(i => i.id === id); if (!it) return nearestFree(n, pos.x, pos.z, 10); return isFloor(it) ? nearestFree(n, pos.x, pos.z, 10) : (standPoint(n, it) || nearestFree(n, pos.x, pos.z, 10)); };
  const finish = (t, a) => { transit.delete(t.id); if (a) { if (a.carry) { a.g.remove(a.carry); a.carry = null; } a.task = null; a.state = 'idle'; a.idleT = 1.2; a.w.path = []; } if (data) rebuildPieces(); };
  const roleOfTask = t => { const r = roleFor(t, data.plan); return agents.some(a => a.role === r) ? r : (agents.some(a => a.role === 'prep') ? 'prep' : (agents[0] && agents[0].role)); };
  const startTask = (a, t) => {
    const n = a.big ? navBig : nav, ps = standFor(n, t.from.where, t.from), path = ps && findPath(n, a.w, ps);
    if (!path) return finish(t, null);
    a.task = t; a.state = 'go_pick'; a.w.path = path; a.stuck = 0;
  };
  const poi = () => { const out = []; data.plan.items.forEach(it => { if (TYPES[it.type].kind === 'decor') return; const p = isFloor(it) ? { x: it.x, z: it.z } : standPoint(nav, it); if (p) out.push({ p, it }); }); return out; };
  const stepAgent = (a, i, dt) => {
    const walking = a.w.path.length > 0, big = a.big, n = big ? navBig : nav;
    if (a.wait > 0) { a.wait -= dt; }
    else if (a.state === 'idle') {
      a.idleT -= dt;
      const ti = tasks.findIndex(t => t.role === a.role);
      if (ti >= 0) { const t = tasks.splice(ti, 1)[0]; startTask(a, t); }
      else if (a.idleT <= 0) { const P = poi(); if (P.length) { const q = P[Math.floor(Math.random() * P.length)]; const path = findPath(n, a.w, q.p); if (path) { a.w.path = path; a.state = 'patrol'; } } a.idleT = 3 + Math.random() * 6; }
    } else if (walking) {
      const nx = a.w.path[0], dx = nx.x - a.w.x, dz = nx.z - a.w.z, dd = Math.hypot(dx, dz) || 1;
      const blocker = agents.find((o, j) => j < i && Math.hypot(o.w.x - a.w.x, o.w.z - a.w.z) < (big || o.big ? 1.6 : 0.9) && ((o.w.x - a.w.x) * dx + (o.w.z - a.w.z) * dz) / dd > 0.2);
      if (blocker) { a.stuck += dt; a.wait = 0.2; if (a.stuck > 2.5 && a.task) { const tgt = a.w.path[a.w.path.length - 1], p2 = findPath(n, a.w, tgt); if (p2) a.w.path = p2; a.stuck = 0; } }
      else { a.stuck = 0; if (advance(a.w, dt)) onArrive(a); }
    }
    if (a.task && a.state !== 'idle') { a.task.t = (a.task.t || 0) + dt; if (a.task.t > 90) { const t = a.task; finish(t, a); } }
    /* corps : position, orientation douce, balancement des jambes et des bras */
    a.g.position.set(a.w.x, 0.1, a.w.z); let da = a.w.rot - a.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); a.g.rotation.y += da * Math.min(1, dt * 9);
    if (!big) { const mv = a.w.path.length > 0 && a.wait <= 0; a.phase += mv ? dt * 8 : 0; const sw = mv ? Math.sin(a.phase) * 0.7 : 0; a.legL.rotation.x = sw; a.legR.rotation.x = -sw; a.armL.rotation.x = a.carry ? -1.25 : -sw * 0.8; a.armR.rotation.x = a.carry ? -1.25 : sw * 0.8; }
  };
  const onArrive = a => {
    if (a.state === 'go_pick' && a.task) {
      const t = a.task, tr = transit.get(t.id); if (tr) tr.state = 'carried';
      const info = { id: t.id, sc: 1, hang: false, dim: false, stage: t.to.stage, rot: 0 }, m = makePiece(Object.assign({}, t.to, info), { x: 0, y: 0, z: 0, rot: 0 }); m.scale.setScalar(0.9);
      m.position.set(0, a.big ? 0.4 : 1.0, a.big ? 1.5 : 0.42); a.g.add(m); a.carry = m; rebuildPieces();
      const n = a.big ? navBig : nav, ps = standFor(n, t.to.where, t.to), path = ps && findPath(n, a.w, ps);
      if (!path) return finish(t, a);
      a.state = 'go_drop'; a.w.path = path; a.stuck = 0;
    } else if (a.state === 'go_drop' && a.task) { const t = a.task; finish(t, a); }
    else { a.state = 'idle'; a.idleT = 1 + Math.random() * 3; }
  };

  /* ----- le quartier des acheteurs ----- */
  const buildTown = () => {
    if (shellG) { scene.remove(shellG); freeGeo(shellG); } shellG = new T.Group(); scene.add(shellG); townMeshes = []; itemGroups = new Map();
    const b = town.bounds, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    bx(shellG, w + 6, 0.2, d + 6, 0x8f969d, cx, -0.05, cz, false);
    town.buildings.forEach(bl => {
      bx(shellG, town.cell - 1.4, 0.16, town.cell - 1.4, 0xdfe3e6, bl.x, 0.08, bl.z, false);
      const body = new T.Mesh(new T.BoxGeometry(bl.w, bl.h, bl.w), new T.MeshStandardMaterial({ color: bl.dim ? 0xdcdfe2 : bl.color, roughness: 0.8 })); body.position.set(bl.x, bl.h / 2 + 0.16, bl.z); body.castShadow = true; body.receiveShadow = true; body.userData = { buyerKey: bl.k }; shellG.add(body); townMeshes.push(body);
      bx(shellG, bl.w + 0.3, 0.22, bl.w + 0.3, bl.dim ? 0xc9cdd1 : 0x3a4552, bl.x, bl.h + 0.27, bl.z);
      for (let f = 1; f < Math.min(bl.n, 12) + 1; f++) { const y = 1.4 + f * 1.15; [-1, 1].forEach(s => bx(shellG, bl.w * 0.7, 0.35, 0.05, 0xbfe0f5, bl.x, y, bl.z + s * (bl.w / 2 + 0.03), false)); }
      if (bl.tag === 'fidele') bx(shellG, 0.1, 1.2, 0.1, 0x333333, bl.x, bl.h + 0.9, bl.z, false);
      label(shellG, '@' + bl.nom, bl.n + (bl.n > 1 ? ' achats' : ' achat'), bl.x, bl.h + 2.6, bl.z, 4.2);
    });
    trees(shellG, b, 8, 30, 11);
    if (pinsG) { scene.remove(pinsG); } pinsG = new T.Group(); scene.add(pinsG); pinSprites = [];
    town.pins.forEach(p => { const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(pinTexture(PIN_COL[p.kind] || PIN_COL.custom, p.text)), depthTest: false, fog: false })); s.center.set(0.5, 0); s.scale.set(1.0, 1.33, 1); s.position.set(p.x, p.y, p.z); s.renderOrder = 5; s.userData = p; pinsG.add(s); pinSprites.push(s); });
    if (piecesG) { scene.remove(piecesG); piecesG = null; } pieceList = []; spans = Math.max(w, d);
  };
  const frame = bnds => {
    const cx = (bnds.minX + bnds.maxX) / 2, cz = (bnds.minZ + bnds.maxZ) / 2; spans = Math.max(bnds.maxX - bnds.minX, bnds.maxZ - bnds.minZ);
    const k = mode === 'town' ? 1.3 : spans > 30 ? 0.95 : 1.15, d = spans * k + (mode === 'town' ? 14 : 8);
    scene.fog = quality === 'high' ? new T.Fog(0xe3edf4, spans * 2.2, spans * 7) : null;
    ctl.target.set(cx, 0.8, cz); cam.position.set(cx + d * 0.55, d * 0.62, cz + d * 0.8); ctl.minDistance = 4; ctl.maxDistance = spans * 3 + 40;
    sun.position.set(cx - spans * 0.5, spans * 0.9, cz + spans * 0.4); sun.target.position.set(cx, 0, cz); const s = sun.shadow.camera; s.left = -spans; s.right = spans; s.top = spans; s.bottom = -spans; s.near = 1; s.far = spans * 4; s.updateProjectionMatrix(); ctl.update();
  };

  /* ----- info-bulle : nom, taille, prix, étape ----- */
  const tip = document.createElement('div'); tip.style.cssText = 'position:absolute;display:none;z-index:3;max-width:230px;background:var(--card,#fff);color:var(--ink,#1d1d1b);border-radius:12px;padding:8px 10px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.22);pointer-events:auto'; host.appendChild(tip);
  let tipId = '';
  const placeTip = id => {
    const m = pieceById.get(id); if (!m) { tip.style.display = 'none'; return; }
    const v = m.position.clone(); v.y += 0.6; v.project(cam); const x = (v.x * 0.5 + 0.5) * W(), y = (-v.y * 0.5 + 0.5) * H();
    tip.style.left = Math.max(4, Math.min(W() - 236, x - 115)) + 'px'; tip.style.top = Math.max(4, Math.min(H() - 90, y - 78)) + 'px';
  };
  const showTip = (id, withBtn) => {
    const i = infoOf(id); tipId = id; const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    tip.innerHTML = '<b>' + e(i.title) + '</b><div style="color:var(--mute,#6b6b66)">' + e([i.size, i.price, i.stageLabel].filter(Boolean).join(' · ')) + '</div><div style="font-family:monospace;font-size:12px">' + e(i.code) + '</div>' + (withBtn ? '<button type="button" data-tipopen style="margin-top:6px;border:0;border-radius:8px;padding:6px 10px;background:var(--ink,#1d1d1b);color:var(--card,#fff);font:inherit;cursor:pointer">' + e(i.openLabel || 'Open') + '</button>' : '');
    tip.style.display = 'block'; placeTip(id);
  };
  const hideTip = () => { tip.style.display = 'none'; tipId = ''; };
  tip.addEventListener('pointerdown', e => e.stopPropagation()); tip.addEventListener('click', e => { if (e.target.closest('[data-tipopen]') && tipId) { const id = tipId; hideTip(); cb.onPick({ box: { id } }); } });

  /* ----- choisir, glisser ----- */
  const setRay = ev => { const r = dom.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); };
  const pickItem = ev => { setRay(ev); const meshes = []; itemGroups.forEach(g => g.traverse(o => { if (o.isMesh) meshes.push(o); })); const h = ray.intersectObjects(meshes, false); return h.length ? h[0].object.userData.itemId : ''; };
  const pick = ev => {
    setRay(ev);
    const ps = ray.intersectObjects(pinSprites, false); if (ps.length) return { pin: ps[0].object.userData };
    if (pieceList.length) { const h = ray.intersectObjects(pieceList, false); if (h.length) return { box: h[0].object.userData.box }; }
    if (townMeshes.length) { const h = ray.intersectObjects(townMeshes, false); if (h.length) return { building: h[0].object.userData.buyerKey }; }
    return null;
  };
  let down = null, drag = null, ghost = null, itemDrag = null, timer = 0, lastMove = 0;
  const light = id => itemGroups.forEach((g, k) => g.traverse(o => { if (o.userData.zoneMat && o.material) o.material.emissive.setHex(k === id ? 0x444444 : 0); }));
  const dropOn = (x, z) => { const r = { x0: x - 0.01, x1: x + 0.01, z0: z - 0.01, z1: z + 0.01 }; const it = data.plan.items.find(i => TYPES[i.type].kind !== 'decor' && !(rectOf(i).x1 < r.x0 || rectOf(i).x0 > r.x1 || rectOf(i).z1 < r.z0 || rectOf(i).z0 > r.z1)); if (it) return it.id; const b = data.tpl.bounds; return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ ? 'hall' : ''; };
  const startDrag = () => {
    if (!down || !down.box) return; drag = down.box; ctl.enabled = false; hideTip();
    ghost = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 0.6), new T.MeshStandardMaterial({ color: STAGE_COL[drag.stage] || 0x888888, transparent: true, opacity: 0.85 })); ghost.position.set(drag.x, 1, drag.z); scene.add(ghost);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* sans vibration */ } }
  };
  dom.addEventListener('pointerdown', ev => {
    hideTip(); down = { x: ev.clientX, y: ev.clientY, moved: false, type: ev.pointerType };
    if (mode === 'town') return;
    if (editing) { const id = pickItem(ev); if (id) { selected = id; outline(); cb.onSelect(id); const it = data.plan.items.find(i => i.id === id); setRay(ev); if (ray.ray.intersectPlane(gplane, hit)) itemDrag = { id, ox: it.x - hit.x, oz: it.z - hit.z, x: it.x, z: it.z, ok: true, started: false }; if (itemDrag) ctl.enabled = false; } else { selected = ''; outline(); cb.onSelect(''); } return; }
    const h = pick(ev); down.box = h && h.box;
    if (down.box) { if (ev.pointerType === 'mouse') ctl.enabled = false; else timer = setTimeout(startDrag, 380); }
  });
  dom.addEventListener('pointermove', ev => {
    if (itemDrag && down) {
      if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) itemDrag.started = true; if (!itemDrag.started) return;
      setRay(ev); if (ray.ray.intersectPlane(gplane, hit)) { const it = data.plan.items.find(i => i.id === itemDrag.id), nx = Math.round((hit.x + itemDrag.ox) / 0.5) * 0.5, nz = Math.round((hit.z + itemDrag.oz) / 0.5) * 0.5; itemDrag.x = nx; itemDrag.z = nz; itemDrag.ok = canPlace(data.plan, data.tpl, Object.assign({}, it, { x: nx, z: nz })); const g = itemGroups.get(it.id); if (g) g.position.set(nx, 0, nz); if (selBox) { selBox.position.x = nx; selBox.position.z = nz; selBox.material.color.setHex(itemDrag.ok ? 0xe8a33d : 0xd23a3a); } }
      return;
    }
    if (!down) {
      if (ev.pointerType === 'mouse' && mode === 'wh' && !editing && ev.timeStamp - lastMove > 60) { lastMove = ev.timeStamp; const h = pick(ev); dom.style.cursor = h ? 'pointer' : 'default'; if (h && h.box) { if (tipId !== h.box.id) showTip(h.box.id, false); } else if (tipId && !tip.matches(':hover')) hideTip(); }
      return;
    }
    if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) { down.moved = true; if (!drag && down.box && ev.pointerType === 'mouse') startDrag(); else if (!drag) clearTimeout(timer); }
    if (drag) { setRay(ev); if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -0.6), hit)) { ghost.position.set(hit.x, 1, hit.z); light(dropOn(hit.x, hit.z)); } }
  });
  const reset = () => { clearTimeout(timer); down = null; drag = null; itemDrag = null; ctl.enabled = true; light(''); if (ghost) { scene.remove(ghost); ghost.geometry.dispose(); ghost = null; } };
  dom.addEventListener('pointerup', ev => {
    const d = down, g = drag, ig = itemDrag; reset(); if (!d) return;
    if (ig) { if (ig.started) { const np = ig.ok ? moveItem(data.plan, data.tpl, ig.id, ig.x, ig.z) : null; if (np) cb.onPlan(np); else { const it = data.plan.items.find(i => i.id === ig.id), gr = itemGroups.get(ig.id); if (gr && it) gr.position.set(it.x, 0, it.z); outline(); } } return; }
    if (g) { setRay(ev); if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -0.6), hit)) { const t = dropOn(hit.x, hit.z); if (t) cb.onDrop(g.id, t); } return; }
    if (editing || d.moved) return;
    const h = pick(ev); if (!h) { hideTip(); return; }
    if (h.box && d.type !== 'mouse') { if (tipId === h.box.id) { hideTip(); return cb.onPick(h); } return showTip(h.box.id, true); }
    cb.onPick(h);
  });
  dom.addEventListener('pointercancel', reset); dom.addEventListener('contextmenu', e => e.preventDefault());
  const resize = () => { if (!host.isConnected || !W()) return; renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; if (ro) ro.observe(host);
  const dispose = () => { run = false; if (ro) ro.disconnect(); ctl.dispose(); renderer.dispose(); if (dom.parentNode) dom.parentNode.removeChild(dom); if (tip.parentNode) tip.parentNode.removeChild(tip); };

  /* ----- boucle ----- */
  let last = 0, upd = 0;
  const loop = ts => {
    if (!run) return; requestAnimationFrame(loop); if (!host.isConnected) { last = ts; return; }
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    pinSprites.forEach((s, i) => { s.position.y = s.userData.y + Math.sin(ts / 420 + i) * 0.12; });
    if (mode === 'wh' && data) agents.forEach((a, i) => stepAgent(a, i, dt));
    if (dirty && ts - upd > 250) { atex.needsUpdate = true; dirty = false; upd = ts; }
    if (tipId) placeTip(tipId);
    ctl.update(); renderer.render(scene, cam);
  };
  requestAnimationFrame(loop);

  return {
    /** Lieu : d = { tpl, plan, placed, stageNames, quiet }. Les pièces dont l'étape change sont portées par un personnage. */
    setPlace(d) {
      const wasTown = mode === 'town'; mode = 'wh'; agents.forEach(a => { a.g.visible = true; }); const sig = d.tpl.place + '|' + JSON.stringify(d.tpl.bounds) + '|' + JSON.stringify(d.plan.items); data = d;
      if (wasTown && townMeshes.length) { townMeshes = []; }
      const rebuild = sig !== shellSig || wasTown; if (rebuild) { shellSig = sig; buildShell(); if (agents.length === 0 || wasTown || firstPlace || agents.length !== d.tpl.roles.length) spawn(); }
      /* mouvements : on ne fait marcher quelqu'un que pour un vrai changement d'étape (pas quand on déplace un meuble) */
      const moves = d.quiet || firstPlace || rebuild ? [] : diffMoves(prevBoxes, d.placed.boxes);
      prevBoxes = new Map(d.placed.boxes.map(b => [b.id, b])); firstPlace = false;
      moves.slice(0, 14).forEach(m => { if (transit.has(m.id)) return; const t = { id: m.id, from: m.from, to: m.to, role: '', state: 'pending' }; t.role = roleOfTask(t); transit.set(m.id, t); tasks.push(t); });
      rebuildPieces(); if (rebuild) { agents.forEach(a => { a.w.path = []; if (a.carry) { a.g.remove(a.carry); a.carry = null; } a.task = null; a.state = 'idle'; }); tasks.length = 0; transit.clear(); if (editing) gridOn(); outline(); }
      if (framed !== 'wh|' + d.tpl.place) { frame(d.tpl.bounds); framed = 'wh|' + d.tpl.place; }
    },
    setTown(d) { mode = 'town'; town = d; agents.forEach(a => { a.g.visible = false; }); if (labelsG) { scene.remove(labelsG); freeGeo(labelsG); labelsG = null; } hideTip(); buildTown(); if (framed !== 'town') { frame(d.bounds); framed = 'town'; } },
    setEdit(on) { editing = !!on; if (!on) selected = ''; gridOn(); outline(); },
    select(id) { selected = id; outline(); },
    setQuality(q) {
      quality = q === 'low' ? 'low' : 'high'; const hi = quality === 'high';
      renderer.setPixelRatio(hi ? Math.min(window.devicePixelRatio || 1, 2) : 1); renderer.setSize(W(), H()); renderer.shadowMap.enabled = hi; sun.castShadow = hi; sun.shadow.mapSize.set(hi ? 2048 : 512, hi ? 2048 : 512); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      if (hi && RE) { if (!envTex) { pmrem = new T.PMREMGenerator(renderer); envTex = pmrem.fromScene(new RE(), 0.04).texture; } scene.environment = envTex; scene.environmentIntensity = 0.4; } else scene.environment = null;
      scene.fog = hi && data ? new T.Fog(0xe3edf4, spans * 2.2, spans * 7) : null;
      matCache.forEach(m => { m.needsUpdate = true; }); photoMat.needsUpdate = true;
      if (mode === 'town' && town) buildTown(); else if (data) { buildShell(); rebuildPieces(); }
    },
    rotateSelected() { return selected && data ? rotateItem(data.plan, data.tpl, selected) : null; },
    recenter() { if (mode === 'town' && town) frame(town.bounds); else if (data) frame(data.tpl.bounds); },
    resize, dispose,
  };
  function gridOn() { if (gridH) { scene.remove(gridH); gridH = null; } if (editing && data) { const b = data.tpl.bounds; gridH = new T.GridHelper(Math.max(b.maxX - b.minX, b.maxZ - b.minZ), Math.round(Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 0.5), 0x2f6db5, 0x9fb4c4); gridH.material.opacity = 0.25; gridH.material.transparent = true; gridH.position.set((b.minX + b.maxX) / 2, 0.14, (b.minZ + b.maxZ) / 2); scene.add(gridH); } }
}
