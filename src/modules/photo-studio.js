import { app } from '../state.js';
import { $, esc } from './core.js';
import { phBlob, savePhoto } from './photos.js';
import { sheetHead, showSheet } from './tools-index.js';

/* ---------- Retoucher la photo : détourage du fond et recadrage aux formats des plateformes ---------- */
/* Tout se passe sur l'appareil : la photo ne part nulle part.
   Le détourage est simple et honnête : il repère la couleur du fond sur le pourtour de la photo, puis efface ce qui y ressemble en partant des bords.
   Il marche bien sur un fond uni et clair (mur, porte, drap) ; sur un fond chargé ou de la couleur du vêtement, il peut se tromper : l'aperçu permet de régler la sensibilité ou de renoncer. */

/** Masque du fond (1 = fond) et couleur du fond, d'après les pixels RGBA d'une image w × h. */
export function detourMask(d, w, h, tol = 40) {
  const R = [], G = [], B = [], step = Math.max(1, Math.floor((w + h) / 240));
  const take = (x, y) => { const i = (y * w + x) * 4; R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]); };
  for (let x = 0; x < w; x += step) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y += step) { take(0, y); take(w - 1, y); }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const bg = [med(R), med(G), med(B)];
  const dist = i => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
  const mask = new Uint8Array(w * h), stack = [];
  const seed = (x, y) => { const p = y * w + x; if (!mask[p] && dist(p * 4) <= tol) { mask[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p - x) / w, i = p * 4;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx; if (mask[q]) continue;
      const j = q * 4, dq = dist(j);
      /* proche de la couleur du fond, ou petite variation locale (dégradé, ombre douce) tout en restant assez proche du fond */
      if (dq <= tol || (dq <= tol * 1.8 && Math.hypot(d[j] - d[i], d[j + 1] - d[i + 1], d[j + 2] - d[i + 2]) <= tol * 0.3)) { mask[q] = 1; stack.push(q); }
    }
  }
  let n = 0; for (let p = 0; p < mask.length; p++) n += mask[p];
  return { mask, bg, part: n / mask.length };
}
/** Remplace le fond par une couleur [r,g,b] ; le bord du vêtement est adouci. Modifie d en place. */
export function paintBackground(d, mask, w, h, color) {
  const near = p => { const x = p % w, y = (p - x) / w; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx]) return true; } return false; };
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4;
    if (mask[p]) { d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]; d[i + 3] = 255; }
    else if (near(p)) { d[i] = (d[i] + color[0]) >> 1; d[i + 1] = (d[i + 1] + color[1]) >> 1; d[i + 2] = (d[i + 2] + color[2]) >> 1; }
  }
}

/* ---- formats des plateformes ---- */
export const FORMATS = [['orig', 'Original', 0, 0, 0], ['sq', 'Carré 1:1', 1, 1200, 1200], ['vinted', 'Vinted 4:5', 4 / 5, 1080, 1350], ['lbc', 'Leboncoin 4:3', 4 / 3, 1600, 1200], ['tiktok', 'TikTok 9:16', 9 / 16, 1080, 1920]];
export const FONDS = [['blanc', 'Blanc', [255, 255, 255]], ['gris', 'Gris clair', [236, 237, 240]], ['creme', 'Crème', [243, 234, 215]], ['sombre', 'Sombre', [22, 19, 15]]];
/** Rectangles source et destination pour mettre une image w × h dans un format : « cover » rogne, « contain » ajuste avec des marges. */
export function fitRect(w, h, fmt, mode) {
  const f = FORMATS.find(x => x[0] === fmt) || FORMATS[0];
  if (!f[2]) { const k = Math.min(1, 1600 / Math.max(w, h)); return { cw: Math.round(w * k), ch: Math.round(h * k), sx: 0, sy: 0, sw: w, sh: h, dx: 0, dy: 0, dw: Math.round(w * k), dh: Math.round(h * k) }; }
  const cw = f[3], ch = f[4], ratio = f[2], r = w / h;
  if (mode === 'cover') {
    let sw = w, sh = h; if (r > ratio) sw = h * ratio; else sh = w / ratio;
    return { cw, ch, sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh, dx: 0, dy: 0, dw: cw, dh: ch };
  }
  const k = Math.min(cw / w, ch / h) * 0.92, dw = w * k, dh = h * k;
  return { cw, ch, sx: 0, sy: 0, sw: w, sh: h, dx: (cw - dw) / 2, dy: (ch - dh) / 2, dw, dh };
}

/* ---- l'écran ---- */
const load = blob => new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
export async function openStudio(id) {
  const p = app.P.find(x => x.id === id); if (!p || !p.photo) return app.toast(t('Cette pièce n\'a pas de photo'));
  const st = { detour: false, tol: 40, fond: 'blanc', fmt: 'vinted', mode: 'contain', src: null, out: null };
  showSheet(sheetHead(t('Retoucher la photo')) + `<div class="card"><div class="pst"><canvas id="ps_c" width="360" height="450" aria-label="${esc(t('Aperçu'))}"></canvas></div><div id="ps_m" class="hint"></div>
   <span class="l">${t('Fond')}</span><div class="chips" id="ps_d"><button type="button" class="chip sm" data-pd="0">${t('Garder')}</button><button type="button" class="chip sm" data-pd="1">${t('Détourer')}</button></div>
   <div id="ps_fw" hidden><div class="chips" id="ps_f" style="margin-top:8px">${FONDS.map(([k, l]) => `<button type="button" class="chip sm" data-pf="${k}">${t(l)}</button>`).join('')}</div><label class="l" for="ps_t" style="margin-top:10px;display:block">${t('Sensibilité du détourage')}</label><input type="range" id="ps_t" min="15" max="90" value="40"></div>
   <span class="l" style="margin-top:12px;display:block">${t('Format')}</span><div class="chips" id="ps_x">${FORMATS.map(([k, l]) => `<button type="button" class="chip sm" data-px="${k}">${t(l)}</button>`).join('')}</div>
   <div class="chips" id="ps_o" style="margin-top:8px"><button type="button" class="chip sm" data-po="contain">${t('Ajuster')}</button><button type="button" class="chip sm" data-po="cover">${t('Rogner')}</button></div></div>
   <div class="acts two"><button type="button" class="btn mint" id="ps_ok">${t('Enregistrer comme photo')}</button><button type="button" class="btn sec" id="ps_dl">${t('Télécharger')}</button></div>
   <div class="acts"><button type="button" class="btn sec" id="g_no">${t('Retour')}</button></div>`);
  const mark = () => {
    $('ps_d').querySelectorAll('[data-pd]').forEach(b => b.classList.toggle('on', (b.dataset.pd === '1') === st.detour));
    $('ps_f').querySelectorAll('[data-pf]').forEach(b => b.classList.toggle('on', b.dataset.pf === st.fond));
    $('ps_x').querySelectorAll('[data-px]').forEach(b => b.classList.toggle('on', b.dataset.px === st.fmt));
    $('ps_o').querySelectorAll('[data-po]').forEach(b => b.classList.toggle('on', b.dataset.po === st.mode));
    $('ps_fw').hidden = !st.detour; $('ps_o').hidden = st.fmt === 'orig';
  };
  const render = () => {
    if (!st.src) return;
    const im = st.src, k = Math.min(1, 1600 / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k);
    const work = document.createElement('canvas'); work.width = w; work.height = h;
    const x = work.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
    let msg = '';
    if (st.detour) {
      const img = x.getImageData(0, 0, w, h), r = detourMask(img.data, w, h, st.tol);
      if (r.part < 0.05 || r.part > 0.93) msg = t('Le fond n\'a pas pu être détecté : essaie de changer la sensibilité, ou garde le fond.');
      else { paintBackground(img.data, r.mask, w, h, FONDS.find(f => f[0] === st.fond)[2]); x.putImageData(img, 0, 0); }
    }
    const fr = fitRect(w, h, st.fmt, st.mode), out = document.createElement('canvas'); out.width = fr.cw; out.height = fr.ch;
    const o = out.getContext('2d'); o.fillStyle = st.detour ? 'rgb(' + FONDS.find(f => f[0] === st.fond)[2].join(',') + ')' : '#f1f2f4'; o.fillRect(0, 0, fr.cw, fr.ch);
    o.drawImage(work, fr.sx, fr.sy, fr.sw, fr.sh, fr.dx, fr.dy, fr.dw, fr.dh);
    st.out = out;
    const pv = $('ps_c'), s = Math.min(360 / fr.cw, 450 / fr.ch); pv.width = Math.round(fr.cw * s); pv.height = Math.round(fr.ch * s);
    pv.getContext('2d').drawImage(out, 0, 0, pv.width, pv.height);
    $('ps_m').textContent = msg || t('{w} × {h} px', { w: fr.cw, h: fr.ch });
  };
  try { st.src = await load(await phBlob(p.photo)); } catch (e) { return app.toast(t('Photo introuvable sur cet appareil')); }
  mark(); render();
  const blob = () => new Promise(r => st.out.toBlob(r, 'image/jpeg', 0.9));
  $('shc').onclick = async e => {
    const d = e.target.closest('[data-pd]'), f = e.target.closest('[data-pf]'), x = e.target.closest('[data-px]'), o = e.target.closest('[data-po]');
    if (d) { st.detour = d.dataset.pd === '1'; if (st.detour && st.fmt === 'orig') st.fmt = 'vinted'; mark(); return render(); }
    if (f) { st.fond = f.dataset.pf; mark(); return render(); }
    if (x) { st.fmt = x.dataset.px; mark(); return render(); }
    if (o) { st.mode = o.dataset.po; mark(); return render(); }
    if (e.target.closest('#g_no')) return app.openSheet(id);
    if (e.target.closest('#ps_dl')) { const b = await blob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (p.code || 'photo') + '-' + st.fmt + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return; }
    if (e.target.closest('#ps_ok')) {
      const b = await blob(), nid = await savePhoto(new File([b], 'photo.jpg', { type: 'image/jpeg' })), old = p.photo;
      app.save(Object.assign({}, p, { photo: nid, h: [...(p.h || []), { t: Date.now(), e: 'Photo retouchée' }].slice(-40) }));
      app.toast(t('Photo enregistrée'), () => { const q = app.P.find(z => z.id === id); if (q) app.save(Object.assign({}, q, { photo: old })); }, 6000);
      return app.openSheet(id);
    }
  };
  $('shc').oninput = e => { if (e.target.id === 'ps_t') { st.tol = +e.target.value; render(); } };
}
app.openStudio = openStudio;
