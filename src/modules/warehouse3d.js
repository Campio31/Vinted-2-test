import { app } from '../state.js';
import { $, esc, title } from './core.js';
import { baseStage, expired, inPipeline, moveTo, slowParcel, stageOf, stages } from './crm.js';
import { sheetHead, showSheet } from './tools-index.js';

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
  x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.roundRect ? x.roundRect(4, 8, 312, 80, 18) : x.rect(4, 8, 312, 80); x.fill();
  x.fillStyle = '#1d1d1b'; x.font = '700 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text.length > 16 ? text.slice(0, 15) + '…' : text, 160, 38);
  x.fillStyle = '#6b6b66'; x.font = '500 24px sans-serif'; x.fillText(sub, 160, 68);
  return c;
}
/** Crée la scène dans host. T = Three, OC = OrbitControls, cb = { onPick(hit), onDrop(id, cible) }. Renvoie { update(data), recenter(), dispose() }. */
export function createScene(T, OC, host, cb) {
  const W = () => host.clientWidth || 600, H = () => host.clientHeight || 440;
  const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  const scene = new T.Scene(); scene.background = new T.Color(0xeef1f4);
  const cam = new T.PerspectiveCamera(28, W() / H(), 1, 800), ctl = new OC(cam, renderer.domElement);
  ctl.enableDamping = true; ctl.maxPolarAngle = 1.25; ctl.minPolarAngle = 0.3; ctl.screenSpacePanning = false;
  scene.add(new T.HemisphereLight(0xffffff, 0xb8c4cc, 1.05));
  const sun = new T.DirectionalLight(0xffffff, 1.25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun, sun.target);
  const ground = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshStandardMaterial({ color: 0xe6eaed })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  let dyn = null, data = null, framed = false, run = true, boxMesh = null, pinSprites = [], zoneMeshes = {}, spans = 40;
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -0.6), hit = new T.Vector3(), tmp = new T.Object3D();
  const free = g => g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
  const frame = () => {
    const b = data.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2; spans = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    ctl.target.set(cx, 0.8, cz); const d = spans * 0.95 + 9; cam.position.set(cx + d * 0.62, d * 0.62, cz + d * 0.78); ctl.minDistance = 8; ctl.maxDistance = spans * 3 + 40;
    sun.position.set(cx - spans * 0.5, spans * 0.9, cz + spans * 0.4); sun.target.position.set(cx, 0, cz); const s = sun.shadow.camera; s.left = -spans; s.right = spans; s.top = spans; s.bottom = -spans; s.near = 1; s.far = spans * 4; s.updateProjectionMatrix(); ctl.update();
  };
  const build = () => {
    if (dyn) { scene.remove(dyn); free(dyn); }
    dyn = new T.Group(); scene.add(dyn); pinSprites = []; zoneMeshes = {};
    const std = c => new T.MeshStandardMaterial({ color: c, roughness: 0.85 });
    /* sol du stock et zones */
    const hall = new T.Mesh(new T.BoxGeometry(data.store.w + 3, 0.12, data.store.d + 3), std(0xd3d9de)); hall.position.set(data.store.w / 2, 0.04, data.store.d / 2); hall.receiveShadow = true; dyn.add(hall);
    data.zones.forEach(z => {
      const m = new T.Mesh(new T.BoxGeometry(z.w, 0.1, z.d), new T.MeshStandardMaterial({ color: z.color, roughness: 0.9, transparent: true, opacity: 0.5, emissive: 0x000000 })); m.position.set(z.x, 0.05, z.z); m.receiveShadow = true; dyn.add(m); zoneMeshes[z.id] = m;
      const e = new T.LineSegments(new T.EdgesGeometry(m.geometry), new T.LineBasicMaterial({ color: z.color })); e.position.copy(m.position); dyn.add(e);
      const lb = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(labelTexture(z.name, z.n + (z.over ? ' (+' + z.over + ')' : '')) ), depthTest: false })); lb.scale.set(4.2, 1.26, 1); lb.position.set(z.x, 0.9, z.z + z.d / 2 + 0.2); dyn.add(lb);
    });
    /* étagères */
    const n = data.racks.length;
    if (n) {
      const posts = new T.InstancedMesh(new T.BoxGeometry(0.09, 2.7, 0.09), std(0x2f6db5), n * 4), beams = new T.InstancedMesh(new T.BoxGeometry(RW, 0.07, 0.07), std(0xe07b2e), n * 6), planks = new T.InstancedMesh(new T.BoxGeometry(RW, 0.04, RD), std(0xcfd4d9), n * 3);
      let ip = 0, ib = 0, il = 0; const set = (m, i, x, y, z) => { tmp.position.set(x, y, z); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); };
      data.racks.forEach(r => {
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => set(posts, ip++, r.x + sx * (RW / 2 - 0.05), 1.35, r.z + sz * (RD / 2 - 0.05))));
        LV.forEach(y => { set(planks, il++, r.x, y - 0.02, r.z); [-1, 1].forEach(sz => set(beams, ib++, r.x, y - 0.1, r.z + sz * (RD / 2 - 0.05))); });
        const lb = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(labelTexture(r.name, r.n + (r.over ? ' (+' + r.over + ')' : ''))), depthTest: false })); lb.scale.set(3.6, 1.08, 1); lb.position.set(r.x, 3.35, r.z); dyn.add(lb);
      });
      [posts, beams, planks].forEach(m => { m.castShadow = true; m.receiveShadow = true; dyn.add(m); });
    }
    /* colis : un par pièce */
    boxMesh = null;
    if (data.boxes.length) {
      boxMesh = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.42, 0.9), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), data.boxes.length); const col = new T.Color();
      data.boxes.forEach((b, i) => { tmp.position.set(b.x, b.y, b.z); tmp.updateMatrix(); boxMesh.setMatrixAt(i, tmp.matrix); boxMesh.setColorAt(i, col.set(b.dim ? 0xdcdfe2 : (STAGE_COL[b.stage] || 0x888888))); });
      boxMesh.castShadow = true; boxMesh.receiveShadow = true; dyn.add(boxMesh);
    }
    /* pins */
    data.pins.forEach(p => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(pinTexture(PIN_COL[p.kind] || PIN_COL.custom, p.text)), depthTest: false })); s.center.set(0.5, 0); s.scale.set(1.0, 1.33, 1); s.position.set(p.x, p.y, p.z); s.renderOrder = 5; s.userData = p; dyn.add(s); pinSprites.push(s);
    });
    /* arbres autour */
    const b = data.bounds, rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(), pts = [];
    for (let k = 0; k < 160 && pts.length < 30; k++) { const x = b.minX - 14 + rnd() * (b.maxX - b.minX + 28), z = b.minZ - 14 + rnd() * (b.maxZ - b.minZ + 28); if (x > b.minX - 6 && x < b.maxX + 6 && z > b.minZ - 6 && z < b.maxZ + 6) continue; pts.push([x, z, 0.8 + rnd() * 0.9]); }
    if (pts.length) {
      const fol = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), std(0x86c46f), pts.length), trk = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.16, 1, 6), std(0x8a6a4a), pts.length);
      pts.forEach(([x, z, s], i) => { tmp.position.set(x, 0.5 * s + 0.5, z); tmp.scale.set(0.2, s, 0.2); tmp.updateMatrix(); trk.setMatrixAt(i, tmp.matrix); tmp.position.set(x, 1.3 * s + 0.9, z); tmp.scale.set(s, s, s); tmp.updateMatrix(); fol.setMatrixAt(i, tmp.matrix); });
      tmp.scale.set(1, 1, 1); fol.castShadow = true; dyn.add(trk, fol);
    }
    /* remorque au quai */
    const tr = new T.Mesh(new T.BoxGeometry(3, 2.6, 10), std(0xf5f6f7)); tr.position.set(data.bounds.maxX + 3, 1.4, (data.bounds.minZ + data.bounds.maxZ) / 2); tr.castShadow = true; dyn.add(tr);
    const cab = new T.Mesh(new T.BoxGeometry(3, 2, 2.4), std(0x3b82c4)); cab.position.set(tr.position.x, 1.1, tr.position.z + 6.4); cab.castShadow = true; dyn.add(cab);
  };
  /* ---- choisir un objet : pins d'abord, puis colis ---- */
  const setRay = ev => { const r = renderer.domElement.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); };
  const pick = ev => {
    setRay(ev);
    const ps = ray.intersectObjects(pinSprites, false); if (ps.length) return { pin: ps[0].object.userData };
    if (boxMesh) { const h = ray.intersectObject(boxMesh, false); if (h.length && h[0].instanceId != null) return { box: data.boxes[h[0].instanceId] }; }
    return null;
  };
  /* ---- glisser une pièce vers une zone ---- */
  let down = null, drag = null, ghost = null, timer = 0;
  const startDrag = () => {
    if (!down || !down.box) return; drag = down.box; ctl.enabled = false;
    ghost = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 0.52), new T.MeshStandardMaterial({ color: STAGE_COL[drag.stage] || 0x888888, transparent: true, opacity: 0.85 })); ghost.position.set(drag.x, 1, drag.z); scene.add(ghost);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* sans vibration */ } }
  };
  const light = id => Object.keys(zoneMeshes).forEach(k => zoneMeshes[k].material.emissive.setHex(k === id ? 0x444444 : 0));
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', ev => {
    const h = pick(ev); down = { x: ev.clientX, y: ev.clientY, box: h && h.box, moved: false };
    if (down.box) { if (ev.pointerType === 'mouse') ctl.enabled = false; else timer = setTimeout(startDrag, 380); }
  });
  dom.addEventListener('pointermove', ev => {
    if (!down) return; if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) { down.moved = true; if (!drag && down.box && ev.pointerType === 'mouse') startDrag(); else if (!drag) clearTimeout(timer); }
    if (drag) { setRay(ev); if (ray.ray.intersectPlane(plane, hit)) { ghost.position.set(hit.x, 1, hit.z); light(dropTarget(data, hit.x, hit.z)); } }
  });
  const end = ev => {
    clearTimeout(timer); const d = down, g = drag; down = null; drag = null; ctl.enabled = true; light('');
    if (ghost) { scene.remove(ghost); free(ghost); ghost = null; }
    if (!d) return;
    if (g) { setRay(ev); if (ray.ray.intersectPlane(plane, hit)) { const t = dropTarget(data, hit.x, hit.z); if (t) cb.onDrop(g.id, t); } return; }
    if (!d.moved) { const h = pick(ev); if (h) cb.onPick(h); }
  };
  dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', () => { clearTimeout(timer); down = null; drag = null; ctl.enabled = true; if (ghost) { scene.remove(ghost); free(ghost); ghost = null; } light(''); });
  dom.addEventListener('contextmenu', e => e.preventDefault());
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }) : null; if (ro) ro.observe(host);
  const dispose = () => { run = false; if (ro) ro.disconnect(); if (dyn) free(dyn); ctl.dispose(); renderer.dispose(); if (dom.parentNode) dom.parentNode.removeChild(dom); };
  const loop = t => {
    if (!run) return; if (!host.isConnected) return dispose();
    pinSprites.forEach((s, i) => { s.position.y = s.userData.y + Math.sin(t / 420 + i) * 0.12; });
    ctl.update(); renderer.render(scene, cam); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return { update(d) { data = d; build(); if (!framed) { frame(); framed = true; } }, recenter() { if (data) frame(); }, dispose };
}

/* ---------- l'écran ---------- */
export async function openWarehouse() {
  const P = () => app.P.filter(inPipeline), uniq = f => [...new Set(P().map(f).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
  const F = { m: '', c: '', b: '', al: true };
  showSheet(sheetHead(t('Entrepôt 3D')) + `<div class="card"><div class="chips whc"><select id="wh_m" aria-label="${esc(t('Marque'))}"><option value="">${t('Toutes les marques')}</option>${uniq(p => p.marque).map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select>
   <select id="wh_c" aria-label="${esc(t('Catégorie'))}"><option value="">${t('Toutes les catégories')}</option>${uniq(p => p.cat).map(x => `<option value="${esc(x)}">${esc(tv(x))}</option>`).join('')}</select>
   <input type="search" id="wh_b" placeholder="${esc(t('Acheteur'))}" autocomplete="off" autocapitalize="none"></div>
   <div class="chips" style="margin:8px 0"><button type="button" class="chip sm on" id="wh_al">${t('Alertes')}</button><button type="button" class="chip sm" id="wh_rc">${t('Recentrer')}</button></div>
   <div id="wh3d" class="wh3d"><div class="hint" style="padding:16px">${t('Chargement de la 3D…')}</div></div><div id="wh_m2" class="hint"></div>
   <p class="hint">${t('Étagères : tes bacs. Zones au sol : les étapes de la vente. Touche un colis pour ouvrir la fiche, ou maintiens-le et glisse-le vers une zone.')}</p></div>
   <div class="acts"><button type="button" class="btn sec" id="wh_no">${t('Retour')}</button></div>`);
  let T, OC; try { [T, { OrbitControls: OC }] = await Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]); } catch (e) { $('wh3d').innerHTML = `<div class="hint" style="padding:16px">${t('La 3D n\'a pas pu se charger : vérifie ta connexion puis réessaie.')}</div>`; return; }
  const host = $('wh3d'); if (!host) return; host.innerHTML = '';
  const keep = p => (!F.m || p.marque === F.m) && (!F.c || p.cat === F.c) && (!F.b || String(p.acheteur || (p.offre || {}).a || '').toLowerCase().includes(F.b.toLowerCase()));
  let sc, sig = '';
  const layout = () => { const d = layoutWarehouse(app.P, { keep }); if (!F.al) d.pins = d.pins.filter(p => p.kind !== 'alert'); return d; };
  const refresh = () => { sig = signature(app.P) + '|' + F.m + F.c + F.b + F.al; sc.update(layout()); const a = app.P.filter(p => expired(p) || slowParcel(p)).length; $('wh_m2').textContent = a ? t('{n} pièce(s) demandent ton attention (pins rouges).', { n: a }) : ''; };
  try {
    sc = createScene(T, OC, host, {
      onPick: h => { if (h.box) return app.openSheet(h.box.id); if (h.pin.pieceId) return app.openSheet(h.pin.pieceId); if (h.pin.zoneId) app.toast(t('{n} pièce(s) : {z}', { n: h.pin.text, z: h.pin.label })); },
      onDrop: (id, target) => { const p = app.P.find(x => x.id === id); if (!p) return; const to = target === 'hall' ? (baseStage(p) === 'brouillon' ? 'brouillon' : 'ligne') : target; moveTo(id, to === 'hall' ? 'ligne' : to); refresh(); },
    });
  } catch (e) { host.innerHTML = `<div class="hint" style="padding:16px">${t('La 3D n\'est pas disponible sur cet appareil.')}</div>`; return; }
  refresh();
  const poll = setInterval(() => { if (!host.isConnected) return clearInterval(poll); if (signature(app.P) + '|' + F.m + F.c + F.b + F.al !== sig) refresh(); }, 900);
  $('shc').onclick = e => {
    if (e.target.closest('#wh_al')) { F.al = !F.al; $('wh_al').classList.toggle('on', F.al); return refresh(); }
    if (e.target.closest('#wh_rc')) return sc.recenter();
    if (e.target.closest('#wh_no')) { clearInterval(poll); sc.dispose(); $('sheet').hidden = true; }
  };
  $('shc').onchange = e => { if (e.target.id === 'wh_m') { F.m = e.target.value; refresh(); } else if (e.target.id === 'wh_c') { F.c = e.target.value; refresh(); } };
  $('shc').oninput = e => { if (e.target.id === 'wh_b') { F.b = e.target.value.trim(); refresh(); } };
}
app.openWarehouse = openWarehouse;
