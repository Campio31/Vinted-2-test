import { app } from '../state.js';
import { $ } from './core.js';
import { phBlob } from './photos.js';
import { sheetHead, showSheet } from './tools-index.js';
import { detourMask } from './photo-studio.js';

/* ---------- Aperçu 3D : une forme de vêtement générique habillée avec la photo de la pièce ---------- */
/* Honnête sur ce que c'est : ce n'est PAS un scan de la vraie pièce. On part d'une silhouette simple (t-shirt, pantalon, veste, robe),
   on la gonfle comme un coussin, on y plaque la photo recadrée sur le vêtement, et le dos est une copie assombrie de l'avant.
   Tout se calcule sur l'appareil, en WebGL, sans bibliothèque ni envoi de photo. Les fonctions de géométrie sont pures (testables). */

/* silhouettes dans un carré 0..1 (y vers le bas) ; asp = largeur et hauteur de l'objet 3D */
export const SHAPES = {
  tshirt: { n: 'T-shirt', asp: [1.1, 1.1], p: [[0.36, 0.02], [0.5, 0.09], [0.64, 0.02], [0.92, 0.14], [1, 0.34], [0.84, 0.4], [0.78, 0.3], [0.78, 1], [0.22, 1], [0.22, 0.3], [0.16, 0.4], [0, 0.34], [0.08, 0.14]] },
  pants: { n: 'Pantalon', asp: [0.85, 1.5], p: [[0.2, 0], [0.8, 0], [0.86, 1], [0.56, 1], [0.5, 0.32], [0.44, 1], [0.14, 1]] },
  jacket: { n: 'Veste', asp: [1.25, 1.25], p: [[0.34, 0.02], [0.5, 0.07], [0.66, 0.02], [0.9, 0.1], [1, 0.95], [0.84, 0.95], [0.8, 0.3], [0.78, 0.98], [0.22, 0.98], [0.2, 0.3], [0.16, 0.95], [0, 0.95], [0.1, 0.1]] },
  dress: { n: 'Robe', asp: [1, 1.5], p: [[0.36, 0], [0.5, 0.06], [0.64, 0], [0.7, 0.28], [0.66, 0.4], [0.96, 1], [0.04, 1], [0.34, 0.4], [0.3, 0.28]] },
};
const SHAPE_OF = { Tshirt: 'tshirt', Polo: 'tshirt', Maillot: 'tshirt', Chemise: 'tshirt', Short: 'pants', Pantalon: 'pants', Veste: 'jacket', Sweat: 'jacket', RobeJupe: 'dress' };
export const shapeFor = p => SHAPE_OF[p && p.cat] || 'tshirt';

/* ---- géométrie 2D ---- */
export function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function edgeDist(x, y, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const k = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
    m = Math.min(m, Math.hypot(x - (ax + k * dx), y - (ay + k * dy)));
  }
  return m;
}
/** Zone de la photo occupée par le vêtement (hors fond), en pixels { x, y, w, h } ; toute la photo si le fond n'est pas détecté. */
export function garmentBox(d, w, h) {
  const r = detourMask(d, w, h, 40);
  if (r.part < 0.05 || r.part > 0.93) return { x: 0, y: 0, w, h, ok: false };
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!r.mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const px = Math.round((x1 - x0) * 0.03), py = Math.round((y1 - y0) * 0.03);
  x0 = Math.max(0, x0 - px); y0 = Math.max(0, y0 - py); x1 = Math.min(w - 1, x1 + px); y1 = Math.min(h - 1, y1 + py);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1), ok: true };
}

/* ---- maillage : devant et dos gonflés comme un coussin, plus une tranche pour fermer le bord ---- */
export function buildMesh(shape, o = {}) {
  const nx = o.nx || 34, ny = o.ny || 40, R = o.R || 0.16, dep = o.depth || 0.16, [aw, ah] = shape.asp, poly = shape.p;
  const zAt = (x, y) => dep * Math.sqrt(Math.min(1, edgeDist(x, y, poly) / R));
  const W = nx + 1, ins = [], P = [], N = [], U = [], S = [], I = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) ins.push(inPoly(i / nx, j / ny, poly));
  const add = (x, y, z, n, u, s) => { P.push((x - 0.5) * aw, (0.5 - y) * ah, z * aw); const l = Math.hypot(n[0], n[1], n[2]) || 1; N.push(n[0] / l, n[1] / l, n[2] / l); U.push(u, y); S.push(s); return P.length / 3 - 1; };
  const F = new Int32Array(W * (ny + 1)).fill(-1), B = new Int32Array(W * (ny + 1)).fill(-1), e = 0.5 / nx;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const k = j * W + i; if (!ins[k]) continue;
    const x = i / nx, y = j / ny, z = zAt(x, y), gx = (zAt(x + e, y) - zAt(x - e, y)) / (2 * e), gy = (zAt(x, y + e) - zAt(x, y - e)) / (2 * e);
    F[k] = add(x, y, z, [-gx, aw * gy / ah, 1], x, 1);
    B[k] = add(x, y, -z, [-gx, aw * gy / ah, -1], 1 - x, 0.74);
  }
  const cell = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && ins[j * W + i] && ins[j * W + i + 1] && ins[(j + 1) * W + i] && ins[(j + 1) * W + i + 1];
  const side = (p, q, n) => {
    const a = add(p[0], p[1], p[2], n, p[0], 0.86), b = add(q[0], q[1], q[2], n, q[0], 0.86), c = add(p[0], p[1], -p[2], n, p[0], 0.86), d = add(q[0], q[1], -q[2], n, q[0], 0.86);
    I.push(a, b, c, b, d, c);
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!cell(i, j)) continue;
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    I.push(F[a], F[c], F[d], F[a], F[d], F[b], B[a], B[d], B[c], B[a], B[b], B[d]);
    const pt = (ii, jj) => [ii / nx, jj / ny, zAt(ii / nx, jj / ny)];
    if (!cell(i, j - 1)) side(pt(i, j), pt(i + 1, j), [0, 1, 0]);
    if (!cell(i, j + 1)) side(pt(i, j + 1), pt(i + 1, j + 1), [0, -1, 0]);
    if (!cell(i - 1, j)) side(pt(i, j), pt(i, j + 1), [-1, 0, 0]);
    if (!cell(i + 1, j)) side(pt(i + 1, j), pt(i + 1, j + 1), [1, 0, 0]);
  }
  return { pos: new Float32Array(P), nrm: new Float32Array(N), uv: new Float32Array(U), sh: new Float32Array(S), idx: new Uint16Array(I), count: I.length };
}

/* ---- matrices 4×4 (colonnes d'abord, comme WebGL) ---- */
export const m4 = {
  mul: (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp: (f, a, n, z) => { const t = 1 / Math.tan(f / 2), o = new Float32Array(16); o[0] = t / a; o[5] = t; o[10] = (z + n) / (n - z); o[11] = -1; o[14] = 2 * z * n / (n - z); return o; },
  tr: (x, y, z) => { const o = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); o[12] = x; o[13] = y; o[14] = z; return o; },
  rx: a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
  ry: a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
};

/* ---- rendu WebGL ---- */
const VS = 'attribute vec3 p;attribute vec3 n;attribute vec2 u;attribute float s;uniform mat4 mvp;uniform mat4 mdl;varying vec3 vn;varying vec2 vu;varying float vs;void main(){vn=(mdl*vec4(n,0.0)).xyz;vu=u;vs=s;gl_Position=mvp*vec4(p,1.0);}';
const FS = 'precision mediump float;uniform sampler2D tx;varying vec3 vn;varying vec2 vu;varying float vs;void main(){vec3 c=texture2D(tx,vu).rgb;float l=0.5+0.5*max(dot(normalize(vn),normalize(vec3(0.3,0.55,0.8))),0.0);gl_FragColor=vec4(c*l*vs,1.0);}';
/** Démarre l'aperçu dans un canvas. Renvoie { setMesh, stop } ou null si WebGL n'est pas disponible. st = { ax, ay, auto }. */
export function startGL(canvas, mesh, tex, st) {
  let gl = null; try { gl = canvas.getContext('webgl', { antialias: true }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
  if (!gl) return null;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const bufs = {}; let cnt = 0;
  const attr = (name, data, size) => { const l = gl.getAttribLocation(pr, name), b = bufs[name] || (bufs[name] = gl.createBuffer()); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
  const ib = gl.createBuffer();
  const setMesh = m => { attr('p', m.pos, 3); attr('n', m.nrm, 3); attr('u', m.uv, 2); attr('s', m.sh, 1); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW); cnt = m.count; };
  setMesh(mesh);
  const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const uM = gl.getUniformLocation(pr, 'mvp'), uD = gl.getUniformLocation(pr, 'mdl');
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0.945, 0.949, 0.957, 1);
  let run = true, drag = null;
  const frame = () => {
    if (!run || !canvas.isConnected) { run = false; return; }
    if (st.auto && !drag) st.ay += 0.012;
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const mdl = m4.mul(m4.rx(st.ax), m4.ry(st.ay)), mvp = m4.mul(m4.persp(0.8, canvas.width / canvas.height, 0.1, 20), m4.mul(m4.tr(0, 0, -2.75), mdl));
    gl.uniformMatrix4fv(uM, false, mvp); gl.uniformMatrix4fv(uD, false, mdl);
    gl.drawElements(gl.TRIANGLES, cnt, gl.UNSIGNED_SHORT, 0);
    requestAnimationFrame(frame);
  };
  canvas.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* sans capture */ } };
  canvas.onpointermove = e => { if (!drag) return; st.ay += (e.clientX - drag.x) * 0.012; st.ax = Math.max(-0.9, Math.min(0.9, st.ax + (e.clientY - drag.y) * 0.01)); drag = { x: e.clientX, y: e.clientY }; };
  canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
  requestAnimationFrame(frame);
  return { setMesh, stop: () => { run = false; } };
}

/* ---- l'écran ---- */
const load = blob => new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
export async function open3D(id) {
  const p = app.P.find(x => x.id === id); if (!p || !p.photo) return app.toast(t('Cette pièce n\'a pas de photo'));
  const st = { ax: 0.05, ay: 0, auto: true, shape: shapeFor(p) };
  showSheet(sheetHead(t('Aperçu 3D')) + `<div class="card"><canvas id="g3_c" class="g3c" width="680" height="800" aria-label="${t('Aperçu 3D')}"></canvas><div id="g3_m" class="hint"></div>
   <span class="l">${t('Forme')}</span><div class="chips" id="g3_s">${Object.keys(SHAPES).map(k => `<button type="button" class="chip sm" data-g3s="${k}">${t(SHAPES[k].n)}</button>`).join('')}</div>
   <div class="chips" style="margin-top:8px"><button type="button" class="chip sm" id="g3_auto">${t('Rotation automatique')}</button><button type="button" class="chip sm" id="g3_rst">${t('Remettre de face')}</button></div>
   <p class="hint">${t('Aperçu approximatif : une forme générique habillée avec ta photo. Le dos est une copie de l\'avant. Fais-la tourner au doigt.')}</p></div>
   <div class="acts"><button type="button" class="btn sec" id="g3_no">${t('Retour')}</button></div>`);
  const mark = () => { document.querySelectorAll('#g3_s [data-g3s]').forEach(b => b.classList.toggle('on', b.dataset.g3s === st.shape)); $('g3_auto').classList.toggle('on', st.auto); };
  let img; try { img = await load(await phBlob(p.photo)); } catch (e) { return app.toast(t('Photo introuvable sur cet appareil')); }
  const k = Math.min(1, 640 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const work = document.createElement('canvas'); work.width = w; work.height = h; const wx = work.getContext('2d', { willReadFrequently: true }); wx.drawImage(img, 0, 0, w, h);
  const box = garmentBox(wx.getImageData(0, 0, w, h).data, w, h), tex = document.createElement('canvas'); tex.width = box.w; tex.height = box.h;
  tex.getContext('2d').drawImage(work, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  $('g3_m').textContent = box.ok ? '' : t('Le fond n\'a pas pu être détecté : la photo entière est utilisée.');
  const gl = startGL($('g3_c'), buildMesh(SHAPES[st.shape]), tex, st);
  if (!gl) { $('g3_m').textContent = t('La 3D n\'est pas disponible sur cet appareil.'); }
  mark();
  $('shc').onclick = e => {
    const s = e.target.closest('[data-g3s]');
    if (s && gl) { st.shape = s.dataset.g3s; gl.setMesh(buildMesh(SHAPES[st.shape])); return mark(); }
    if (e.target.closest('#g3_auto')) { st.auto = !st.auto; return mark(); }
    if (e.target.closest('#g3_rst')) { st.ax = 0.05; st.ay = 0; st.auto = false; return mark(); }
    if (e.target.closest('#g3_no')) { if (gl) gl.stop(); return app.openSheet(id); }
  };
}
app.open3D = open3D;
