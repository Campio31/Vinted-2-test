import { app } from '../state.js';
import { $, esc, num } from './core.js';
import { sheetHead, showSheet } from './tools-index.js';

/* ---------- questionnaire par étapes ---------- */
/* Sert à régler la ligne fiscale, le seuil de rentabilité et les fournitures. Peut être refait à tout moment.
   Types d'étape :
     choice : un choix parmi o = [[valeur, titre, détail]]
     multi  : plusieurs choix parmi o
     num    : un nombre (u = unité, opt = peut rester vide)
     date   : une date
     rows   : plusieurs montants, rows = [{ k, l, u }]  → réponse { k: nombre }
     table  : un tableau pour chaque élément choisi : items(a) = [{ k, l }], cols = [{ k, l, u }]  → réponse { élément: { colonne: nombre } }
   `show(réponses)` cache une étape qui ne s'applique pas. */
export function openWizard({ title, steps, answers, onDone, intro }) {
  const A = JSON.parse(JSON.stringify(answers || {}));
  let i = intro ? -1 : 0;
  const vis = () => steps.filter(s => !s.show || s.show(A));
  const num_ = id => { const v = num(($(id) || {}).value); return isNaN(v) ? undefined : v; };
  const read = s => {
    if (s.type === 'num') { const v = num_('wz_n'); if (v === undefined) delete A[s.k]; else A[s.k] = v; }
    else if (s.type === 'date') { const v = ($('wz_d') || {}).value; if (v) A[s.k] = v; else delete A[s.k]; }
    else if (s.type === 'rows') { const o = {}; s.rows.forEach(r => { const v = num_('wz_' + r.k); if (v !== undefined && v > 0) o[r.k] = v; }); A[s.k] = o; }
    else if (s.type === 'table') { const o = {}; s.items(A).forEach(it => { const c = {}; s.cols.forEach(co => { const v = num_('wz_' + it.k + '_' + co.k); if (v !== undefined) c[co.k] = v; }); o[it.k] = c; }); A[s.k] = o; }
  };
  const field = (id, v, u, ph) => `<span class="uin"><input type="text" inputmode="decimal" id="${id}" value="${v === undefined ? '' : esc(String(v).replace('.', app.DS))}" placeholder="${ph || ''}"${u ? '' : ''}>${u ? `<i aria-hidden="true">${esc(u)}</i>` : ''}</span>`;
  const body = s => {
    if (s.type === 'choice') return s.o.map(([v, l, d]) => `<button type="button" class="wopt${A[s.k] === v ? ' on' : ''}" data-wzo="${esc(v)}"><b>${esc(t(l))}</b>${d ? `<small>${esc(t(d))}</small>` : ''}</button>`).join('');
    if (s.type === 'multi') return `<div class="chips">${s.o.map(([v, l]) => `<button type="button" class="chip${(A[s.k] || []).includes(v) ? ' on' : ''}" data-wzm="${esc(v)}">${esc(t(l))}</button>`).join('')}</div>`;
    if (s.type === 'num') return `<div class="cfld">${field('wz_n', A[s.k], s.u, s.ph)}</div>`;
    if (s.type === 'date') return `<input type="date" id="wz_d" value="${esc(A[s.k] || '')}">`;
    if (s.type === 'rows') return s.rows.map(r => `<div class="cfld" style="margin-bottom:10px"><label class="l" for="wz_${r.k}">${esc(t(r.l))}</label>${field('wz_' + r.k, (A[s.k] || {})[r.k], r.u || '€')}</div>`).join('');
    if (s.type === 'table') return s.items(A).map(it => `<div class="cg" style="margin-top:8px"><b>${esc(t(it.l))}</b><div class="row2" style="margin-top:8px">${s.cols.map(co => `<div class="cfld"><label class="l" for="wz_${it.k}_${co.k}">${esc(t(co.l))}</label>${field('wz_' + it.k + '_' + co.k, ((A[s.k] || {})[it.k] || {})[co.k], co.u)}</div>`).join('')}</div></div>`).join('') || `<div class="hint">${t('Rien à régler ici.')}</div>`;
    return '';
  };
  const draw = () => {
    const V = vis();
    if (i < 0) {
      showSheet(sheetHead(t(title)) + `<div class="card"><p class="sub" style="margin:0 0 12px">${t(intro)}</p><div class="acts"><button type="button" class="btn" data-wzgo="1">${t('Commencer')}</button></div></div>`);
      $('shc').onclick = e => { if (e.target.closest('[data-wzgo]')) { i = 0; draw(); } };
      return;
    }
    if (i >= V.length) i = V.length - 1;
    const s = V[i], last = i === V.length - 1, auto = s.type === 'choice';
    showSheet(sheetHead(t(title)) + `<div class="wst">${t('Question {i} sur {n}', { i: i + 1, n: V.length })}</div><div class="wbar" style="margin-bottom:12px">${V.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <h3 style="margin:0 0 4px">${esc(t(s.q))}</h3>${s.h ? `<p class="sub" style="margin:0 0 12px">${esc(t(s.h))}</p>` : ''}<div id="wz_b">${body(s)}</div>
      <div class="acts two" style="margin-top:14px"><button type="button" class="btn sec" data-wzb="1"${i ? '' : ' disabled'}>${t('Retour')}</button>${auto ? '' : `<button type="button" class="btn" data-wzn="1">${last ? t('Terminer') : t('Suivant')}</button>`}</div>`);
    $('shc').onclick = e => {
      if (e.target.closest('[data-wzb]')) { read(s); i = Math.max(0, i - 1); return draw(); }
      const o = e.target.closest('[data-wzo]');
      if (o) { A[s.k] = o.dataset.wzo; const V2 = vis(), k = V2.indexOf(s); if (k >= V2.length - 1) return finish(); i = k + 1; return draw(); }
      const m = e.target.closest('[data-wzm]');
      if (m) { const L = new Set(A[s.k] || []); L.has(m.dataset.wzm) ? L.delete(m.dataset.wzm) : L.add(m.dataset.wzm); A[s.k] = [...L]; m.classList.toggle('on'); return; }
      if (e.target.closest('[data-wzn]')) { read(s); if (s.need && !s.need(A)) { app.toast(t(s.needMsg || 'Réponds d\'abord à la question')); return; } if (last) return finish(); i++; draw(); }
    };
  };
  const finish = () => { onDone(A); };
  draw();
}
