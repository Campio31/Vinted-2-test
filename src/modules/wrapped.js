import { app } from '../state.js';
import { $, LSg, LSs, days, dj, esc, eurR, fd, ok, pad, profit, sold, title } from './core.js';
import { stats } from './dashboard.js';
import { sheetHead, showSheet } from './tools-index.js';
import { MOIS } from './gamification.js';
import { photoBlob, shareFiles } from './proofs.js';
import { FDN, fitPx, mkCanvas, wrapTxt } from './social.js';

app.openWrapped = openWrapped;

/* --- wrapped : récap en images à partager en story --- */
/* Mode discret : les euros sont remplacés par des pourcentages et des nombres de ventes (images et aperçu). */
export const prevPer = per => per.length > 4 ? (() => { const [y, m] = per.split('-').map(Number), d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2); })() : String(+per - 1);
export const perLabel = per => per.length > 4 ? MOIS[+per.slice(5) - 1] + ' ' + per.slice(0, 4) : per;
const pct = (a, b) => b ? Math.round((a - b) / Math.abs(b) * 100) : null;
const sgn = v => (v >= 0 ? '+' : '−') + Math.abs(v) + ' %';
const jour = k => { const s = new Date(2024, 0, 7 + k).toLocaleDateString(app.LOC, { weekday: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };

export function wrappedData(per) {
  const S = app.P.filter(p => sold(p) && ok(p.dv) && p.dv.startsWith(per)), st = stats(S), isM = per.length > 4, bm = {};
  S.forEach(p => { if (!p.marque) return; const o = bm[p.marque] = bm[p.marque] || { k: p.marque, n: 0, ben: 0, ca: 0 }; o.n++; o.ben += profit(p); o.ca += p.pv || 0; });
  const brands = Object.values(bm), bestB = brands.filter(b => b.n >= 2).sort((a, b) => b.ben - a.ben)[0] || brands.sort((a, b) => b.n - a.n)[0] || null;
  let fast = null; S.forEach(p => { const f = ok(p.pub) ? p.pub : p.entree; if (!ok(f)) return; const d = days(f, p.dv); if (d >= 0 && (!fast || d < fast.d)) fast = { p, d }; });
  const by = {}, byN = {}; S.forEach(p => { const k = isM ? p.dv : p.dv.slice(0, 7); by[k] = (by[k] || 0) + (p.pv || 0); byN[k] = (byN[k] || 0) + 1; });
  const rec = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || null, cn = {}; S.forEach(p => { const k = p.canal || 'Vinted'; cn[k] = (cn[k] || 0) + 1; });
  /* la pièce star : celle qui a rapporté le plus */
  const star = S.filter(p => profit(p) > 0).sort((a, b) => profit(b) - profit(a))[0] || null;
  /* le jour de la semaine où tu vends le plus */
  const wn = [0, 0, 0, 0, 0, 0, 0], wc = [0, 0, 0, 0, 0, 0, 0]; S.forEach(p => { const k = new Date(p.dv + 'T12:00:00').getDay(); wn[k]++; wc[k] += p.pv || 0; });
  const wk = wn.map((n, k) => ({ k, n, ca: wc[k] })).sort((a, b) => b.n - a.n || b.ca - a.ca)[0];
  /* par rapport à la période d'avant */
  const pp = prevPer(per), st0 = stats(app.P.filter(p => sold(p) && ok(p.dv) && p.dv.startsWith(pp)));
  return {
    per, isM, n: st.n, ca: st.ca, ben: st.ben, marge: st.marge, bestB, fast, rec, recN: rec ? byN[rec[0]] : 0, canal: Object.entries(cn).sort((a, b) => b[1] - a[1])[0] || null,
    kg: Math.round(st.n * .45 * 10) / 10, panier: st.panier, star, wk: wk && wk.n ? wk : null,
    prev: { per: pp, n: st0.n, dCa: pct(st.ca, st0.ca), dBen: pct(st.ben, st0.ben), dN: pct(st.n, st0.n) },
  };
}

function coverDraw(c, img, x, y, w, h, r) { c.save(); c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r || 0) : c.rect(x, y, w, h); c.clip(); if (img) { const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k; c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h); } c.restore(); }
async function loadPhoto(p) { if (!p || !p.photo) return null; try { const b = await photoBlob(p.photo); return b ? await createImageBitmap(b) : null; } catch (e) { return null; } }

export async function makeWrapped(d, disc) {
  await document.fonts.load('800 80px Archivo').catch(() => {});
  const out = [], W = 1080, H = 1920, lab = perLabel(d.per), photo = await loadPhoto(d.star && d.star.p ? d.star.p : d.star);
  const base = (bg, fg) => { const [c, x] = mkCanvas(W, H, bg); app.logoMark(x, 70, 90, 90); x.fillStyle = fg; x.font = '800 54px ' + FDN; x.fillText('max', 180, 158); x.fillStyle = fg; x.globalAlpha = .6; x.font = '500 40px ' + FDN; x.fillText('Wrapped · ' + lab, 70, 260); x.globalAlpha = 1; x.font = '500 34px ' + FDN; x.globalAlpha = .55; x.fillText(t('Fait avec Max'), 70, H - 90); x.globalAlpha = 1; return [c, x]; };
  const big = (x, t, y, col, size) => { x.fillStyle = col; fitPx(x, t, size || 320, 960); x.fillText(t, 60, y); }, txt = (x, t, y, col, size, w) => { x.fillStyle = col; x.font = '500 ' + (size || 60) + 'px ' + FDN; return wrapTxt(x, t, 64, y, w || 950, (size || 60) * 1.25); };
  { const [c, x] = base('#111111', '#F1F2F4'); big(x, String(d.n), 900, '#FF4A1C', 420); txt(x, t(d.n > 1 ? 'vêtements sauvés de la poubelle, prêts pour une deuxième vie.' : 'vêtement sauvé de la poubelle, prêt pour une deuxième vie.'), 1020, '#F1F2F4', 64); txt(x, t('Environ {k} kg de textile (estimation à 450 g la pièce).', { k: String(d.kg).replace('.', app.DS) }), 1300, '#8a8d94', 42); out.push(c); }
  if (disc) { const [c, x] = base('#FF4A1C', '#111111'); txt(x, t('Tu as vendu'), 560, '#111', 64); big(x, tn(d.n, 'pièce', 'pièces'), 880, '#111', 250); txt(x, t('avec {m} % de marge sur le chiffre d\'affaires', { m: Math.round(d.marge * 100) }), 1010, '#111', 64); out.push(c); }
  else { const [c, x] = base('#FF4A1C', '#111111'); txt(x, t('Tu as encaissé'), 560, '#111', 64); big(x, eurR(d.ca), 880, '#111', 250); txt(x, t('dont {b} de bénéfice net', { b: eurR(d.ben) }), 1010, '#111', 64); txt(x, t('Panier moyen : {p}', { p: eurR(d.panier) }), 1180, '#111', 54); out.push(c); }
  if (d.bestB) { const [c, x] = base('#F1F2F4', '#111111'); txt(x, t('Ta meilleure marque'), 560, '#5a5e66', 60); x.fillStyle = '#111'; x.font = '800 200px ' + FDN; const nn = wrapTxt(x, d.bestB.k, 60, 820, 960, 210, 2); txt(x, disc ? tn(d.bestB.n, 'vente', 'ventes') + ' · ' + t('{p} % de tes ventes', { p: Math.round(d.bestB.n / d.n * 100) }) : tn(d.bestB.n, 'vente', 'ventes') + ' · ' + t('{b} de bénéfice', { b: eurR(d.bestB.ben) }), 820 + nn * 210 + 30, '#FF4A1C', 64); out.push(c); }
  if (d.star) {
    const p = d.star.p || d.star, ben = profit(p), mg = p.pv ? Math.round(ben / p.pv * 100) : 0, [c, x] = base('#111111', '#F1F2F4');
    x.fillStyle = '#2a2a2a'; x.beginPath(); x.roundRect ? x.roundRect(60, 310, 960, 880, 40) : x.rect(60, 310, 960, 880); x.fill(); if (photo) coverDraw(x, photo, 60, 310, 960, 880, 40); else { const nm = String(p.marque || tv(p.cat) || '').toUpperCase(); x.textAlign = 'center'; x.fillStyle = '#4a4d54'; fitPx(x, nm, 200, 860); x.fillText(nm, 540, 790); x.textAlign = 'left'; }
    txt(x, t('Ta pièce star'), 1290, '#C9CBD0', 54); x.fillStyle = '#F1F2F4'; x.font = '800 68px ' + FDN; const nl = wrapTxt(x, title(p), 64, 1380, 950, 76, 2);
    x.fillStyle = '#FF4A1C'; fitPx(x, disc ? mg + ' %' : '+' + eurR(ben), 220, 960); x.fillText(disc ? mg + ' %' : '+' + eurR(ben), 60, 1380 + nl * 76 + 200);
    txt(x, disc ? t('de marge') : t('de bénéfice, vendue {p}', { p: eurR(p.pv) }), 1380 + nl * 76 + 270, '#C9CBD0', 48); out.push(c);
  }
  if (d.fast) { const [c, x] = base('#111111', '#F1F2F4'); txt(x, t('Ta vente la plus rapide'), 560, '#C9CBD0', 60); big(x, dj(d.fast.d), 900, '#FF4A1C', 360); txt(x, title(d.fast.p) + ', ' + (d.fast.d === 0 ? t('vendue le jour même') : t(d.fast.d > 1 ? 'vendue en {n} jours' : 'vendue en {n} jour', { n: d.fast.d })), 1020, '#F1F2F4', 60); out.push(c); }
  if (d.prev.n && d.prev.dCa !== null) {
    const [c, x] = base('#F1F2F4', '#111111'); txt(x, t('Par rapport à {p}', { p: perLabel(d.prev.per) }), 560, '#5a5e66', 60); big(x, sgn(d.prev.dCa), 880, d.prev.dCa >= 0 ? '#2E9E6B' : '#FF4A1C', 330);
    txt(x, t('de chiffre d\'affaires'), 1000, '#111', 60); if (d.prev.dBen !== null) txt(x, t('Bénéfice : {d}', { d: sgn(d.prev.dBen) }), 1130, '#111', 56); txt(x, t('Ventes : {n} contre {m}', { n: d.n, m: d.prev.n }), 1230, '#111', 56); out.push(c);
  }
  if (d.rec) { const [c, x] = base('#FF4A1C', '#111111'); txt(x, t(d.isM ? 'Ton meilleur jour' : 'Ton meilleur mois'), 560, '#111', 64); if (disc) big(x, tn(d.recN, 'vente', 'ventes'), 880, '#111', 260); else big(x, eurR(d.rec[1]), 880, '#111', 260); txt(x, d.isM ? fd(d.rec[0]) : MOIS[+d.rec[0].slice(5) - 1] + ' ' + d.rec[0].slice(0, 4), 1010, '#111', 64); if (d.canal) txt(x, t('Plateforme n°1 : {p} ({n} ventes)', { p: tv(d.canal[0]), n: d.canal[1] }), 1180, '#111', 54); out.push(c); }
  if (d.wk && d.n >= 3) { const [c, x] = base('#111111', '#F1F2F4'); txt(x, t('Ton jour de vente'), 560, '#C9CBD0', 60); big(x, jour(d.wk.k), 880, '#FF4A1C', 260); txt(x, t('{n} ventes, soit {p} % du total', { n: d.wk.n, p: Math.round(d.wk.n / d.n * 100) }), 1010, '#F1F2F4', 60); out.push(c); }
  { const [c, x] = mkCanvas(W, H, '#111111'); app.logoMark(x, W / 2 - 150, 700, 300); x.fillStyle = '#F1F2F4'; x.font = '800 150px ' + FDN; x.textAlign = 'center'; x.fillText('max', W / 2, 1130); x.fillStyle = '#8a8d94'; x.font = '500 48px ' + FDN; x.fillText(t('Le suivi de stock des revendeurs'), W / 2, 1220); out.push(c); }
  return out;
}

export function openWrapped(per0) {
  const now = new Date(), ms = []; for (let i = 0; i < 7; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); ms.push(d.getFullYear() + '-' + pad(d.getMonth() + 1, 2)); }
  const ys = [...new Set(app.P.filter(sold).map(p => (p.dv || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  let per = typeof per0 === 'string' && per0 ? per0 : LSg('wrPer', ms[1]), res = [], disc = !!LSg('wrDisc', false);
  const draw = () => {
    const d = wrappedData(per), seen = LSg('wrSeen', []); if (!seen.includes(per)) LSs('wrSeen', [...seen, per].slice(-30));
    const star = d.star ? (d.star.p || d.star) : null;
    showSheet(sheetHead('Wrapped') + `<p class="sub">${t('Ton récap en images à partager en story.')}</p><div class="chips" id="wr_p" style="margin-bottom:12px">${ms.map(m => `<button type="button" class="chip sm${per === m ? ' on' : ''}" data-wp="${m}">${new Date(2000, +m.slice(5) - 1, 15).toLocaleDateString(app.LOC, { month: 'short' })} ${m.slice(2, 4)}</button>`).join('')}${ys.map(y => `<button type="button" class="chip sm${per === y ? ' on' : ''}" data-wp="${y}">${t('Année {y}', { y })}</button>`).join('')}</div>
  <label class="chk cfr" style="margin:0 0 12px"><input type="checkbox" id="wr_disc"${disc ? ' checked' : ''}><span><b>${t('Mode discret')}</b><small>${t('Remplace les euros par des pourcentages et des nombres de ventes avant de partager.')}</small></span></label>
  <div class="card">${d.n ? `<div class="kpis two" style="margin-bottom:10px"><div class="kpi"><b>${d.n}</b><span>${t('pièces vendues')}</span></div><div class="kpi"><b>${disc ? Math.round(d.marge * 100) + ' %' : eurR(d.ca)}</b><span>${disc ? t('de marge') : t('chiffre d\'affaires')}</span></div></div><div class="kv" style="grid-template-columns:auto 1fr"><dt>${t('Meilleure marque')}</dt><dd>${d.bestB ? esc(d.bestB.k) + (disc ? '' : ' (' + eurR(d.bestB.ben) + ')') : '—'}</dd><dt>${t('Pièce star')}</dt><dd>${star ? esc(title(star)) + (disc ? '' : ' (+' + eurR(profit(star)) + ')') : '—'}</dd><dt>${t('Vente la plus rapide')}</dt><dd>${d.fast ? t('{t} en {n} j', { t: esc(title(d.fast.p)), n: d.fast.d }) : '—'}</dd><dt>${t(d.isM ? 'Meilleur jour' : 'Meilleur mois')}</dt><dd>${d.rec ? (disc ? tn(d.recN, 'vente', 'ventes') : eurR(d.rec[1])) + ' · ' + (d.isM ? fd(d.rec[0]) : d.rec[0]) : '—'}</dd><dt>${t('Par rapport à {p}', { p: perLabel(d.prev.per) })}</dt><dd>${d.prev.dCa !== null && d.prev.n ? sgn(d.prev.dCa) : '—'}</dd><dt>${t('Jour de la semaine')}</dt><dd>${d.wk && d.n >= 3 ? jour(d.wk.k) : '—'}</dd></div><div class="acts"><button type="button" class="btn mint" id="wr_go">${t('Créer les images')}</button></div>` : '<div class="empty" style="padding:14px 8px">' + t('Aucune vente sur cette période.') + '</div>'}</div><div id="wr_r"></div>`);
    $('shc').onchange = e => { if (e.target.id === 'wr_disc') { disc = e.target.checked; LSs('wrDisc', disc); draw(); } };
    $('shc').onclick = async e => {
      const p = e.target.closest('[data-wp]'); if (p) { per = p.dataset.wp; LSs('wrPer', per); draw(); return; }
      if (e.target.closest('#wr_go')) { $('wr_go').disabled = true; $('wr_go').textContent = window.t('Création…'); res = await makeWrapped(d, disc); $('wr_r').innerHTML = `<div class="card"><div class="socp">${res.map((c, i) => `<canvas data-i="${i}"></canvas>`).join('')}</div><div class="acts"><button type="button" class="btn mint" id="wr_sh">${window.t('Partager ou télécharger ({n})', { n: res.length })}</button></div></div>`; res.forEach((c, i) => { const v = $('wr_r').querySelector('canvas[data-i="' + i + '"]'); v.width = c.width; v.height = c.height; v.getContext('2d').drawImage(c, 0, 0); }); $('wr_go').disabled = false; $('wr_go').textContent = window.t('Créer à nouveau'); $('wr_r').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (e.target.closest('#wr_sh')) { const fs = []; for (let i = 0; i < res.length; i++) { const b = await new Promise(r => res[i].toBlob(r, 'image/png')); fs.push(new File([b], 'max-wrapped-' + per + '-' + (i + 1) + '.png', { type: 'image/png' })); } await shareFiles(fs, window.t('Mon récap Max')); }
    };
  };
  draw();
}
