import { app } from '../state.js';
import { $, LSg, LSs, addDays, days, esc, eur, eurR, fd, ok, pad, sold, today } from './core.js';
import { copyText } from './listing.js';
import { fN } from './settings-core.js';
import { bigEur } from './goals.js';
import { sheetHead, showSheet } from './tools-index.js';
import { showCb } from './coach.js';
import { MOIS } from './gamification.js';
import { finDate, finJours, pendingSales } from './finalisation.js';
import { go } from './nav.js';
import { closeSheet } from './piece-sheet.js';
import { RULES, fiscMode, fiscSteps, prorata, syncFisc } from './fiscal-rules.js';
import { openWizard } from './wizard.js';

app.fiscCardHTML = fiscCardHTML;
app.openFisc = openFisc;

/* ===== 2. Ligne fiscale micro-entrepreneur ===== */
export const lastDay = (y, m) => new Date(y, m, 0).getDate();
/* le CA à déclarer = les ventes finalisées dans la période (voir finalisation.js), pas celles faites dans la période */
function caBetween(a, b) { const L = app.P.filter(p => { const d = finDate(p); return d && d >= a && d <= b && d <= today() && app.countsForFisc(p); }), s = L.reduce((t0, p) => t0 + (p.pv || 0), 0); return { ca: s, gross: s, n: L.length }; }
/** Date de la plus ancienne pièce : les périodes de déclaration proposées commencent là. */
export function oldestDate() {
  const L = [];
  app.P.forEach(p => { [p.entree, p.dv, p.pub].forEach(d => { if (ok(d)) L.push(d); }); });
  return L.length ? L.sort()[0] : today();
}
/** Périodes de déclaration, de la plus récente à celle qui contient la plus ancienne pièce. */
export function periodsList(kind) {
  const tdt = new Date(), y = tdt.getFullYear(), m = tdt.getMonth() + 1, old = oldestDate(), out = [];
  kind = kind || app.cfg.periode;
  if (kind === 'T') {
    let q = Math.ceil(m / 3), yy = y;
    for (let i = 0; i < 80; i++) {
      const sm = (q - 1) * 3 + 1, em = sm + 2, end = `${yy}-${pad(em, 2)}-${lastDay(yy, em)}`;
      if (i && end < old) break;
      out.push({ key: yy + '-T' + q, label: t('T') + q + ' ' + yy, start: `${yy}-${pad(sm, 2)}-01`, end, due: q === 4 ? `${yy + 1}-01-31` : `${yy}-${pad(em + 1, 2)}-${lastDay(yy, em + 1)}` });
      q--; if (q === 0) { q = 4; yy--; }
    }
  } else {
    let mm = m, yy = y;
    for (let i = 0; i < 240; i++) {
      const nm = mm === 12 ? 1 : mm + 1, ny = mm === 12 ? yy + 1 : yy, end = `${yy}-${pad(mm, 2)}-${lastDay(yy, mm)}`;
      if (i && end < old) break;
      out.push({ key: yy + '-' + pad(mm, 2), label: MOIS[mm - 1] + ' ' + yy, start: `${yy}-${pad(mm, 2)}-01`, end, due: `${ny}-${pad(nm, 2)}-${lastDay(ny, nm)}` });
      mm--; if (mm === 0) { mm = 12; yy--; }
    }
  }
  return out;
}
export function fiscStatus() {
  const y = new Date().getFullYear(), c = caBetween(y + '-01-01', y + '-12-31').ca, elapsed = Math.max(1, days(y + '-01-01', today()) + 1), yd = ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365, proj = c / elapsed * yd;
  const pl = prorata(+app.cfg.plafond || 0, y), pct = pl ? c / pl : 0;
  let cross = null; if (pl && c < pl && proj > pl && c > 0) cross = addDays(y + '-01-01', Math.round(pl / (c / elapsed)));
  const lvl = pct >= 1 ? 'r' : pct >= .9 ? 'r' : pct >= .75 ? 'o' : 'g';
  return { y, ca: c, pl, pct, proj, yd, elapsed, cross, lvl, reste: Math.max(0, pl - c), tva: prorata(+app.cfg.plafondTva || 0, y) };
}
function fiscRuler(pct, v, tot, lab) { return `<div class="gr"><span>${t(lab)}</span><b class="gp gc-${pct >= .9 ? 'r' : pct >= .75 ? 'o' : 'g'}">${Math.round(pct * 100)} %</b></div><div class="rl"><b class="gc-${pct >= .9 ? 'r' : pct >= .75 ? 'o' : 'g'}" style="width:${Math.min(100, pct * 100).toFixed(1)}%"></b></div><div class="gl2">${t('{a} sur {b}', { a: eur(v), b: eur(tot) })}</div>`; }
function fiscCardHTML() { const f = fiscStatus(); if (!f.pl) return ''; return `<button type="button" class="card minic" data-tool="fisc"><span class="l">${t('plafond micro-entrepreneur {y}', { y: f.y })}</span><b>${eurR(f.ca)} <small>${t('sur {n}', { n: eurR(f.pl) })}</small></b><div class="rl dk"><b class="gc-${f.lvl === 'g' ? 'g' : f.lvl === 'o' ? 'o' : 'r'}" style="width:${Math.min(100, f.pct * 100).toFixed(1)}%"></b></div><span class="mini-s">${f.pct >= 1 ? t('Plafond dépassé') : f.cross ? t('À ce rythme : dépassement vers le {d}', { d: fd(f.cross) }) : t('Il te reste {r}', { r: eurR(f.reste) })}</span></button>`; }

/* ---- graphique : chiffre d'affaires cumulé, projection et plafond ---- */
export function fiscChart(f) {
  const W = 340, H = 176, L = 8, R = 8, T = 22, B = 22, iw = W - L - R, ih = H - T - B, y = f.y;
  const doy = d => days(y + '-01-01', d) + 1, x = d => L + iw * Math.min(1, Math.max(0, doy(d) / f.yd));
  const t0 = today(), pts = [[y + '-01-01', 0]];
  for (let m = 1; m <= 12; m++) { const e = y + '-' + pad(m, 2) + '-' + pad(lastDay(y, m), 2); if (e < t0) pts.push([e, caBetween(y + '-01-01', e).ca]); }
  pts.push([t0, f.ca]);
  const top = Math.max(f.pl || 0, f.tva || 0, f.ca, f.proj, 1) * 1.08, Y = v => T + ih * (1 - v / top);
  const line = pts.map(([d, v], i) => (i ? 'L' : 'M') + x(d).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  const area = line + ` L${x(t0).toFixed(1)} ${Y(0).toFixed(1)} L${x(pts[0][0]).toFixed(1)} ${Y(0).toFixed(1)}Z`;
  const ex = L + iw, hasP = f.ca > 0 && t0 < y + '-12-31';
  const mi = Array.from({ length: 12 }, (_, m) => `<text x="${(L + iw * (doy(y + '-' + pad(m + 1, 2) + '-15') / f.yd)).toFixed(1)}" y="${H - 6}" class="fc-t" text-anchor="middle">${esc(new Date(2000, m, 15).toLocaleDateString(app.LOC, { month: 'narrow' }))}</text>`).join('');
  return `<svg class="fcg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Chiffre d\'affaires cumulé, projection et plafond'))}">
   ${f.pl ? `<line x1="${L}" x2="${ex}" y1="${Y(f.pl).toFixed(1)}" y2="${Y(f.pl).toFixed(1)}" class="fc-l"/><text x="${L + 2}" y="${(Y(f.pl) - 4).toFixed(1)}" class="fc-t fc-lt">${esc(t('Plafond'))} ${esc(eurR(f.pl))}</text>` : ''}
   ${f.tva ? `<line x1="${L}" x2="${ex}" y1="${Y(f.tva).toFixed(1)}" y2="${Y(f.tva).toFixed(1)}" class="fc-v"/><text x="${L + 2}" y="${(Y(f.tva) - 4).toFixed(1)}" class="fc-t fc-vt">${esc(t('TVA'))} ${esc(eurR(f.tva))}</text>` : ''}
   <path d="${area}" class="fc-f"/><path d="${line}" class="fc-a"/>
   ${hasP ? `<line x1="${x(t0).toFixed(1)}" y1="${Y(f.ca).toFixed(1)}" x2="${ex}" y2="${Y(f.proj).toFixed(1)}" class="fc-p"/><circle cx="${ex}" cy="${Y(f.proj).toFixed(1)}" r="3.5" class="fc-pd"/><text x="${ex - 2}" y="${(Y(f.proj) + (f.proj > top * .5 ? 14 : -7)).toFixed(1)}" class="fc-t" text-anchor="end">${esc(eurR(f.proj))}</text>` : ''}
   <line x1="${x(t0).toFixed(1)}" x2="${x(t0).toFixed(1)}" y1="${T}" y2="${Y(0).toFixed(1)}" class="fc-n"/><circle cx="${x(t0).toFixed(1)}" cy="${Y(f.ca).toFixed(1)}" r="4" class="fc-d"/>
   ${f.cross ? `<circle cx="${x(f.cross).toFixed(1)}" cy="${Y(f.pl).toFixed(1)}" r="4" class="fc-x"/>` : ''}
   ${mi}</svg>
   <div class="fcl"><span class="a">${t('réel')}</span>${hasP ? `<span class="p">${t('projection')}</span>` : ''}${f.pl ? `<span class="l">${t('plafond')}</span>` : ''}</div>`;
}
const projTxt = f => {
  if (!f.ca) return t('Pas encore de vente finalisée cette année : la projection apparaît avec la première.');
  const head = t('À ce rythme : {p} fin {y}', { p: eurR(f.proj), y: f.y }) + (f.pl ? ' (' + t('{p} % du plafond', { p: Math.round(f.proj / f.pl * 100) }) + ')' : '');
  return head + (f.cross ? ' · ' + t('plafond dépassé vers le {d}', { d: fd(f.cross) }) : f.pl ? ' · ' + t('il te reste {r}', { r: eurR(f.reste) }) : '');
};

/* ---- questionnaire ---- */
export function openFiscQ(back) {
  const prev = app.cfg.fiscQ, onb = (app.cfg.onb || {}).statut, a0 = prev || (onb ? { statut: { part: 'part', micro: 'micro', pro: 'autre' }[onb] } : {});
  openWizard({
    title: 'Réglages fiscaux', steps: fiscSteps(), answers: a0,
    onDone: a => { app.setCfg({ fiscQ: a }); syncFisc(); app.toast(t('Réglages fiscaux enregistrés')); app.renderAll(); (back || openFisc)(); },
  });
}
const rulesRows = () => {
  const a = app.cfg.fiscQ || {}, c = app.cfg;
  const L = [[t('Statut'), a.statut === 'micro' ? t('Micro-entrepreneur') : a.statut === 'part' ? t('Particulier') : t('Autre statut')]];
  if (a.statut === 'micro') {
    L.push([t('Plafond de chiffre d\'affaires'), eur(c.plafond)], [t('Franchise de TVA jusqu\'à'), c.plafondTva ? eur(c.plafondTva) : t('TVA facturée')], [t('Cotisations'), String(c.tauxSoc).replace('.', app.DS) + ' %' + (a.acre === 'oui' && c.tauxSoc < RULES.taux ? ' (' + t('avec l\'ACRE') + ')' : '')]);
    if (c.vl) L.push([t('Versement libératoire'), String(c.vl).replace('.', app.DS) + ' %']);
    L.push([t('Déclaration'), c.periode === 'T' ? t('Trimestrielle') : t('Mensuelle')]);
  }
  return `<dl class="kv" style="grid-template-columns:auto 1fr;margin:0 0 10px">${L.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
};

/* ---- écrans ---- */
function openFisc() {
  if (!app.cfg.fiscQ) {
    showSheet(sheetHead(t('Ligne fiscale')) + `<div class="card"><h3>${t('Réglons ta situation')}</h3><p class="sub" style="margin:0 0 12px">${t('Quelques questions pour que Max applique les bonnes règles (plafond, TVA, cotisations). Tu peux les refaire à tout moment.')}</p><div class="acts"><button type="button" class="btn" id="fs_q">${t('Répondre aux questions')}</button></div></div>`);
    $('fs_q').onclick = () => openFiscQ();
    return;
  }
  syncFisc();
  const mode = fiscMode();
  if (mode === 'part') return openFiscPart();
  const f = fiscStatus(), per = periodsList(), dec = app.cfg.fiscDeclared || {};
  let pk = LSg('fsPk', '');
  if (!per.some(p => p.key === pk)) pk = per.length > 1 ? per[1].key : per[0].key;
  const alert = f.pct >= 1 ? { c: 'r', t: t('Plafond dépassé'), x: t('Tu as dépassé le plafond de {p}. Vérifie sans attendre les règles sur autoentrepreneur.urssaf.fr.', { p: eurR(f.pl) }) }
    : f.pct >= .9 ? { c: 'r', t: t('À moins de 10 % du plafond'), x: t('Il te reste {r}. Ralentis ou prépare un changement de régime.', { r: eur(f.reste) }) }
      : f.pct >= .75 ? { c: 'o', t: t('Tu approches du plafond'), x: f.cross ? t('Il te reste {r} : à ce rythme tu le dépasses vers le {d}.', { r: eur(f.reste), d: fd(f.cross) }) : t('Il te reste {r}.', { r: eur(f.reste) }) } : null;
  const head = f.pl ? `<div class="gcard"><div class="gh2"><span>${t('Plafond de chiffre d\'affaires {y}', { y: f.y })}</span></div><div class="gbig cd">${bigEur(f.ca)}</div>${fiscRuler(f.pct, f.ca, f.pl, 'plafond micro-entrepreneur')}${f.tva ? fiscRuler(f.ca / f.tva, f.ca, f.tva, 'franchise en base de TVA') : ''}</div>
    <div class="card" style="margin-top:10px"><h3>${t('Ton année en un coup d\'œil')}</h3>${fiscChart(f)}<div class="gl2" style="margin-top:6px">${projTxt(f)}</div></div>${alert ? `<div class="cl cl-${alert.c}"><i></i><div><b>${esc(alert.t)}</b><span>${esc(alert.x)}</span></div></div>` : ''}`
    : `<div class="gcard"><div class="gh2"><span>${t('Chiffre d\'affaires finalisé {y}', { y: f.y })}</span></div><div class="gbig cd">${bigEur(f.ca)}</div></div>`;
  showSheet(sheetHead(t('Ligne fiscale')) + head
    + `<div class="card" style="margin-top:10px"><h3>${t('Déclaration URSSAF')}</h3><p class="sub">${t('Chiffre d\'affaires des ventes finalisées pendant la période : une vente compte quand l\'argent est reçu, pas le jour où tu l\'as faite. Les pièces retournées sont déjà retirées. Cotisations estimées avec ton taux.')}</p>${app.hasComptes() ? `<div class="hint" style="margin:-4px 0 10px">${t('Comptes pris en compte : {a}.', { a: esc(app.comptes().filter(c => c.fiscal !== false).map(c => c.n).join(', ') || '—') })}${app.comptes().some(c => c.fiscal === false) ? ' ' + t('Non pris en compte : {a}.', { a: esc(app.comptes().filter(c => c.fiscal === false).map(c => c.n).join(', ')) }) : ''} ${t('Change-le dans Réglages, Comptes de vente.')}</div>` : ''}<div class="chips fsp" id="fs_p" style="margin-bottom:12px">${per.map(p => `<button type="button" class="chip sm${p.key === pk ? ' on' : ''}" data-pk="${p.key}">${esc(p.label)}</button>`).join('')}</div><div id="fs_d"></div></div>
  <div class="card"><h3>${t('Tes réglages fiscaux')}</h3>${rulesRows()}<div class="hint">${t('Réglés d\'après tes réponses : tu ne les modifies pas à la main. Pour les changer, refais le questionnaire.')} ${t('Chiffres 2026 pour la vente de marchandises : vérifie-les sur autoentrepreneur.urssaf.fr. Ces calculs sont des estimations, pas un conseil fiscal.')}</div><div class="acts"><button type="button" class="btn sec" id="fs_q">${t('Refaire le questionnaire')}</button></div></div>`);
  const micro = mode === 'micro';
  const draw = () => {
    const p = per.find(x => x.key === pk), r = caBetween(p.start, p.end), cot = r.ca * (+app.cfg.tauxSoc || 0) / 100, vl = r.ca * (+app.cfg.vl || 0) / 100, late = !dec[pk] && p.due < today();
    $('fs_d').innerHTML = `<div class="kv" style="grid-template-columns:auto 1fr;margin-bottom:10px"><dt>${t('Période')}</dt><dd>${t('{a} au {b}', { a: fd(p.start), b: fd(p.end) })}</dd><dt>${t('Ventes finalisées')}</dt><dd>${r.n}</dd></div><div class="kpis two" style="margin-bottom:10px"><div class="kpi"><b>${eur(r.ca)}</b><span>${t('chiffre d\'affaires à déclarer')}</span></div>${micro ? `<div class="kpi"><b>${eur(cot + vl)}</b><span>${t('cotisations estimées ({p} %)', { p: String((+app.cfg.tauxSoc || 0) + (+app.cfg.vl || 0)).replace('.', app.DS) })}</span></div>` : ''}</div>
   ${micro ? `<div class="hint">${t('Base imposable avec l\'abattement de 71 % : {a} · à déclarer avant le {d}', { a: eur(r.ca * (1 - (+app.cfg.abat || 71) / 100)), d: '<b>' + fd(p.due) + '</b>' })}${late ? ' <span style="color:var(--red)">' + t('(date dépassée)') + '</span>' : ''}</div>` : ''}
   ${(() => { const pe = pendingSales(), pt = pe.reduce((a, x) => a + (x.pv || 0), 0); return pe.length ? `<div class="cl cl-o"><i></i><div><b>${t(pe.length > 1 ? '{n} ventes pas encore finalisées' : '{n} vente pas encore finalisée', { n: pe.length })} · ${eur(pt)}</b><span>${t('Elles seront comptées dans la période où elles seront finalisées : quand tu les valides, ou automatiquement {n} jours après la vente.', { n: finJours() })}</span></div></div><button type="button" class="btn sec" id="fs_pend" style="margin-bottom:10px">${t('Voir les ventes à finaliser')}</button>` : `<div class="hint">${t('Aucune vente en attente de finalisation.')}</div>`; })()}
   <div class="acts two"><button type="button" class="btn sec" id="fs_cp">${t('Copier le récapitulatif')}</button>${micro ? `<button type="button" class="btn${dec[pk] ? ' sec' : ''}" id="fs_ok">${dec[pk] ? t('Déclaré ✓ (annuler)') : t('Marquer déclaré')}</button>` : ''}</div>
   <div class="acts"><button type="button" class="btn sec" id="fs_pdf">${t('Rapport fiscal en PDF')}</button></div>`;
    $('fs_pdf').onclick = () => app.openRapports('fisc');
    if ($('fs_pend')) $('fs_pend').onclick = () => { closeSheet(); app.salesFilter('fin'); go('sales'); };
    $('fs_cp').onclick = () => copyText(t('Déclaration URSSAF') + ' · ' + p.label + '\n' + t('Chiffre d\'affaires') + ' : ' + fN(r.ca) + ' €\n' + (micro ? t('Cotisations estimées') + ' : ' + fN(cot + vl) + ' €\n' + t('À déclarer avant le {d}', { d: fd(p.due) }) : ''), t('Récapitulatif'));
    if ($('fs_ok')) $('fs_ok').onclick = () => { const d = Object.assign({}, app.cfg.fiscDeclared || {}); if (d[pk]) delete d[pk]; else d[pk] = today(); app.setCfg({ fiscDeclared: d }); dec[pk] = d[pk]; draw(); };
  };
  draw();
  $('fs_p').onclick = e => { const b = e.target.closest('[data-pk]'); if (!b) return; pk = b.dataset.pk; LSs('fsPk', pk); $('fs_p').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); draw(); };
  $('fs_q').onclick = () => openFiscQ();
}
/* vendeur particulier : pas de plafond, mais les plateformes déclarent les gros vendeurs à l'administration fiscale */
function openFiscPart() {
  const y = new Date().getFullYear(), S = app.P.filter(p => sold(p) && ok(p.dv) && p.dv.startsWith(String(y)) && !p.ex), n = S.length, ca = S.reduce((a, p) => a + (p.pv || 0), 0), near = n >= RULES.dac7Ventes * .8 || ca >= RULES.dac7Ca * .8, over = n >= RULES.dac7Ventes || ca >= RULES.dac7Ca;
  showSheet(sheetHead(t('Ligne fiscale')) + `<div class="gcard"><div class="gh2"><span>${t('Tes ventes {y}', { y })}</span></div><div class="gbig cd">${bigEur(ca)}</div><div class="gl2">${tn(n, 'vente', 'ventes')}</div></div>
   <div class="cl cl-${over ? 'r' : near ? 'o' : 'g'}"><i></i><div><b>${over ? t('Ta plateforme déclare tes ventes') : near ? t('Tu approches du seuil de déclaration') : t('En dessous du seuil de déclaration')}</b><span>${t('Les plateformes transmettent à l\'administration fiscale les vendeurs qui atteignent {a} ventes ou {b} dans l\'année.', { a: RULES.dac7Ventes, b: eur(RULES.dac7Ca) })}</span></div></div>
   <div class="card" style="margin-top:10px"><p class="sub" style="margin:0">${t('Revendre ses propres affaires n\'est en général pas imposable. Acheter pour revendre de façon régulière, avec un but lucratif, peut relever d\'une activité professionnelle : dans ce cas, il faut un statut (par exemple micro-entrepreneur). Vérifie ta situation sur impots.gouv.fr ou auprès d\'un comptable.')}</p></div>
   <div class="card"><h3>${t('Tes réglages fiscaux')}</h3>${rulesRows()}<div class="acts"><button type="button" class="btn sec" id="fs_q">${t('Refaire le questionnaire')}</button></div></div>`);
  $('fs_q').onclick = () => openFiscQ();
}
export function checkFiscAlert() { const f = fiscStatus(); if (!f.pl || f.pct < .75 || !$('cb').hidden) return; const lv = f.pct >= 1 ? 3 : f.pct >= .9 ? 2 : 1, k = f.y + ':' + lv; if (LSg('fiscSeen', '') === k) return; LSs('fiscSeen', k); showCb(f.pct >= 1 ? t('Plafond micro dépassé') : f.pct >= .9 ? t('À moins de 10 % du plafond micro') : t('Tu approches du plafond micro ({p} %)', { p: Math.round(f.pct * 100) }), t('Voir'), openFisc); }
