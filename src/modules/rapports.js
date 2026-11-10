import { app } from '../state.js';
import { $, LSg, LSs, esc, eur, fd, ok, pad, title, today } from './core.js';
import { TI, TOOLS, sheetHead, showSheet } from './tools-index.js';
import { MOIS } from './gamification.js';
import { lastDay, oldestDate, periodsList } from './fiscal.js';
import { finDate, pendingSales } from './finalisation.js';

/* ---------- Rapports PDF : ventes du mois et rapport fiscal ---------- */
/* Un seul outil, deux onglets. Le PDF se fait par la fenêtre d'impression du navigateur (« Enregistrer en PDF »).
   - Ventes du mois : le bilan mensuel de report.js (ventes, dépenses, repères fiscaux).
   - Rapport fiscal : le chiffre d'affaires à déclarer d'un mois, d'un trimestre ou d'une année, vente par vente. */
TOOLS.splice(Math.max(0, TOOLS.findIndex(x => x.k === 'fisc') + 1), 0,
  { k: 'rapport', t: 'Rapports PDF', d: 'Ventes du mois et rapport fiscal à enregistrer en PDF', i: TI('<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>') });

const mark = '<svg viewBox="0 0 104 104" width="34" height="34"><rect width="104" height="104" rx="22" fill="#111"/><rect x="12" y="68" width="80" height="18" rx="3" fill="#F1F2F4"/><rect x="18" y="46" width="68" height="18" rx="3" fill="#C9CBD0"/><rect x="32" y="14" width="58" height="18" rx="3" fill="#FF4A1C" transform="rotate(-12 62 24)"/></svg>';

/* --- périodes proposées pour le rapport fiscal --- */
export function fiscPeriods(kind) {
  if (kind === 'Y') {
    const y = new Date().getFullYear(), y0 = +oldestDate().slice(0, 4), out = [];
    for (let yy = y; yy >= y0 && out.length < 12; yy--) out.push({ key: 'Y' + yy, label: String(yy), start: `-01-01`, end: `-12-31`, due: '' });
    return out;
  }
  return periodsList(kind === 'T' ? 'T' : 'M');
}

/** Ventes finalisées dans la période, séparées entre comptes pris en compte et comptes exclus. */
export function fiscSales(a, b) {
  const t0 = today(), all = app.P.filter(p => { const d = finDate(p); return d && d >= a && d <= b && d <= t0; }).sort((x, z) => finDate(x).localeCompare(finDate(z)) || (x.dv || '').localeCompare(z.dv || ''));
  return { inc: all.filter(app.countsForFisc), exc: all.filter(p => !app.countsForFisc(p)) };
}

export function fiscalReportHTML(p) {
  const { inc, exc } = fiscSales(p.start, p.end), R = v => eur(v), sum = L => L.reduce((s, x) => s + (x.pv || 0), 0), ca = sum(inc), tx = +app.cfg.tauxSoc || 0, cot = ca * tx / 100;
  const dec = (app.cfg.fiscDeclared || {})[p.key], y = +p.start.slice(0, 4), yca = fiscSales(y + '-01-01', y + '-12-31').inc, ytd = sum(yca), pl = +app.cfg.plafond || 0;
  const pf = {}; inc.forEach(x => { const k = x.canal || 'Vinted'; (pf[k] = pf[k] || { n: 0, ca: 0 }); pf[k].n++; pf[k].ca += x.pv || 0; });
  const cp = app.hasComptes() ? app.comptes() : [], pend = pendingSales(), pt = sum(pend);
  const name = x => (app.hasComptes() ? app.cptName(x) : '') || tv(x.canal || 'Vinted');
  const rows = L => L.map(x => `<tr><td>${fd(finDate(x))}</td><td>${esc(title(x))}${x.code ? ' · ' + esc(x.code) : ''}</td><td>${ok(x.dv) ? fd(x.dv) : '—'}</td><td>${esc(name(x))}</td><td>${R(x.pv)}</td></tr>`).join('');
  const head = `<tr><th>${t('Finalisée le')}</th><th>${t('Pièce')}</th><th>${t('Vendue le')}</th><th>${t('Compte')}</th><th>${t('Prix')}</th></tr>`;
  return `<div class="rp"><div class="rph">${mark}<div><b>max</b><span>${t('Rapport fiscal')}</span></div><div class="rpm"><b>${esc(p.label)}</b><span>${t('édité le {d}', { d: fd(today()) })}</span></div></div>
 <h4>${t('Chiffre d\'affaires à déclarer')}</h4><table class="rt"><tr><td>${t('Période')}</td><td>${t('{a} au {b}', { a: fd(p.start), b: fd(p.end) })}</td></tr><tr><td>${t('Ventes finalisées')}</td><td>${inc.length}</td></tr><tr class="tt"><td>${t('Chiffre d\'affaires à déclarer')}</td><td>${R(ca)}</td></tr><tr><td>${t('Cotisations estimées ({p} %)', { p: String(tx).replace('.', app.DS) })}</td><td>${R(cot)}</td></tr><tr><td>${t('Base imposable avec l\'abattement de 71 % : {a} · à déclarer avant le {d}', { a: R(ca * .29), d: p.due ? fd(p.due) : '—' })}</td><td></td></tr>${p.due ? `<tr><td>${t('Déclaration')}</td><td>${dec ? t('faite le {d}', { d: fd(dec) }) : t('pas encore marquée comme faite')}</td></tr>` : ''}</table>
 ${Object.keys(pf).length ? `<h4>${t('Par plateforme')}</h4><table class="rt">${Object.entries(pf).map(([k, g]) => `<tr><td>${esc(tv(k))} · ${tn(g.n, 'vente', 'ventes')}</td><td>${R(g.ca)}</td></tr>`).join('')}</table>` : ''}
 <h4>${t('Plafond micro-entrepreneur {y}', { y })}</h4><table class="rt"><tr><td>${t('Chiffre d\'affaires finalisé depuis le 1er janvier')}</td><td>${R(ytd)}</td></tr>${pl ? `<tr><td>${t('Plafond')}</td><td>${R(pl)}</td></tr><tr class="tt"><td>${t('Utilisé')}</td><td>${Math.round(ytd / pl * 100)} %</td></tr>` : ''}</table>
 <h4>${t('Ventes finalisées')}</h4>${inc.length ? `<table class="rl2 lft">${head}${rows(inc)}<tr class="tt"><td colspan="4">${t('Total')}</td><td>${R(ca)}</td></tr></table>` : '<p>' + t('Aucune vente finalisée sur cette période.') + '</p>'}
 ${exc.length ? `<h4>${t('Hors déclaration')}</h4><p>${t('Ventes de comptes non pris en compte dans le chiffre d\'affaires à déclarer.')}</p><table class="rl2 lft">${head}${rows(exc)}<tr class="tt"><td colspan="4">${t('Total')}</td><td>${R(sum(exc))}</td></tr></table>` : ''}
 ${cp.length ? `<p class="rpf">${t('Comptes pris en compte : {a}.', { a: esc(cp.filter(c => c.fiscal !== false).map(c => c.n).join(', ') || '—') })}${cp.some(c => c.fiscal === false) ? ' ' + t('Non pris en compte : {a}.', { a: esc(cp.filter(c => c.fiscal === false).map(c => c.n).join(', ')) }) : ''}</p>` : ''}
 ${pend.length ? `<h4>${t('Pas encore finalisées')}</h4><p>${t('{n} ventes pas encore finalisées', { n: pend.length })} · ${R(pt)}. ${t('Elles seront comptées dans la période où elles seront finalisées : quand tu les valides, ou automatiquement {n} jours après la vente.', { n: app.cfg.finJours === undefined || app.cfg.finJours === '' ? 21 : app.cfg.finJours })}</p>` : ''}
 <p class="rpf">${t('Document généré par Max à partir des données saisies : estimation non certifiée, à faire valider par un comptable.')} ${t('Les calculs fiscaux et de rentabilité de Max sont des estimations, pas un conseil fiscal ou comptable.')}</p></div>`;
}
app.fiscalReportHTML = fiscalReportHTML;

function printNow(html) {
  let el = $('rpt'); if (!el) { el = document.createElement('div'); el.id = 'rpt'; document.body.appendChild(el); }
  el.innerHTML = html;
  document.body.classList.add('printing-r');
  const done = () => { document.body.classList.remove('printing-r'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
}

/* --- l'outil --- */
export function openRapports(tab) {
  const last = new Date(); last.setDate(1); last.setMonth(last.getMonth() - 1);
  const lastM = last.getFullYear() + '-' + pad(last.getMonth() + 1, 2);
  let cur = tab === 'fisc' || tab === 'ventes' ? tab : LSg('rpTab', 'ventes'), m = LSg('rpM', '') || lastM, kind = LSg('rpK', app.cfg.periode === 'T' ? 'T' : 'M'), pk = '';
  const months = []; for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.getFullYear() + '-' + pad(d.getMonth() + 1, 2)); }
  if (!months.includes(m)) m = months[1];
  const draw = () => {
    LSs('rpTab', cur);
    let body, btn;
    if (cur === 'fisc') {
      const per = fiscPeriods(kind); if (!per.some(x => x.key === pk)) pk = (per[1] || per[0]).key;
      const P = per.find(x => x.key === pk);
      body = `<div class="chips" style="margin-bottom:8px">${[['M', 'Mois'], ['T', 'Trimestre'], ['Y', 'Année']].map(([k, l]) => `<button type="button" class="chip sm${kind === k ? ' on' : ''}" data-rk="${k}">${t(l)}</button>`).join('')}</div><div class="chips" style="margin-bottom:12px">${per.map(x => `<button type="button" class="chip sm${x.key === pk ? ' on' : ''}" data-rp="${esc(x.key)}">${esc(x.label)}</button>`).join('')}</div>`;
      btn = 'rp_pdf_f';
      body += `<div class="acts" style="margin:0 0 12px"><button type="button" class="btn mint" id="${btn}">${t('Enregistrer en PDF')}</button></div><div class="hint" style="margin:0 0 12px">${t('Dans la fenêtre d\'impression, choisis « Enregistrer en PDF » (sur téléphone : Partager, puis Imprimer, puis pince pour agrandir et enregistrer).')}</div><div class="rpv">${fiscalReportHTML(P)}</div>`;
    } else {
      body = `<div class="chips" style="margin-bottom:12px">${months.map(x => `<button type="button" class="chip sm${x === m ? ' on' : ''}" data-rm="${x}">${new Date(2000, +x.slice(5) - 1, 15).toLocaleDateString(app.LOC, { month: 'short' })} ${x.slice(0, 4)}</button>`).join('')}</div><div class="acts" style="margin:0 0 12px"><button type="button" class="btn mint" id="rp_pdf">${t('Enregistrer en PDF')}</button></div><div class="hint" style="margin:0 0 12px">${t('Dans la fenêtre d\'impression, choisis « Enregistrer en PDF » (sur téléphone : Partager, puis Imprimer, puis pince pour agrandir et enregistrer).')}</div><div class="rpv">${app.reportHTML(m)}</div>`;
    }
    showSheet(sheetHead(t('Rapports PDF')) + `<div class="chips" style="margin-bottom:12px">${[['ventes', 'Ventes du mois'], ['fisc', 'Rapport fiscal']].map(([k, l]) => `<button type="button" class="chip${cur === k ? ' on' : ''}" data-rt="${k}">${t(l)}</button>`).join('')}</div>` + body);
    $('shc').onclick = e => {
      const a = e.target.closest('[data-rt]'); if (a) { cur = a.dataset.rt; return draw(); }
      const b = e.target.closest('[data-rm]'); if (b) { m = b.dataset.rm; LSs('rpM', m); return draw(); }
      const k = e.target.closest('[data-rk]'); if (k) { kind = k.dataset.rk; LSs('rpK', kind); pk = ''; return draw(); }
      const q = e.target.closest('[data-rp]'); if (q) { pk = q.dataset.rp; return draw(); }
      if (e.target.closest('#rp_pdf')) return printNow(app.reportHTML(m));
      if (e.target.closest('#rp_pdf_f')) return app.printHTML(fiscalReportHTML(fiscPeriods(kind).find(x => x.key === pk)));
    };
  };
  draw();
}
app.openReport = openRapports;
app.openRapports = openRapports;


/* la carte du Bilan ouvre l'outil ; un raccourci vers le rapport fiscal existe aussi dans Ligne fiscale */
app.rapportCardHTML = () => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `<button type="button" class="card minic" data-tool="rapport" data-lb="${esc(t('Rapports PDF'))}"><span class="l">${t('rapports PDF')}</span><b>${esc(MOIS[d.getMonth()] + ' ' + d.getFullYear())}</b><span class="mini-s">${t('Ventes du mois et rapport fiscal, à enregistrer en PDF')}</span></button>`;
};