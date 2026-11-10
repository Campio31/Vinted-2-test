import { app } from '../state.js';
import { $, LSg, LSs, addDays, esc, eur, eurR, fd, ok, profit, sold, title, today } from './core.js';
import { hydrate, phImg } from './photos.js';
import { go } from './nav.js';
import { catSvg } from './stock-view.js';
import { colisList } from './colis.js';
import { isFinal, pendingSales } from './finalisation.js';
import { activeChips, activeCount, facet, filterLabel, openFilters } from './filters.js';

app.renderSales = renderSales;

/* ---------- onglet Vente : toutes les ventes ---------- */
/* L'onglet Stock ne montre que le stock ; ici, toutes les pièces vendues, les plus récentes d'abord.
   La vente rapide en direct (ancien onglet Live) est dans Outils, Live. */
let flt = LSg('salesFlt', 'all');
let lim = 60;
let cf = ''; /* filtre par compte de vente ('' = tous) */
const host = $('v-sales');
host.innerHTML = '<div class="srch"><input type="search" id="sq" autocomplete="off" autocapitalize="none" spellcheck="false"></div><div class="chips" id="sflt" style="margin-bottom:12px"></div><div id="ssum"></div><div id="slst"></div>';

app.colisCount = () => colisList().length;
app.salesFilter = k => { flt = k; LSs('salesFlt', k); lim = 60; };
const row = p => {
  const pr = profit(p);
  return `<button type="button" class="li" data-id="${esc(p.id)}">${p.photo ? phImg(p.photo, 'th') : `<div class="th">${catSvg(p)}</div>`}<div class="m"><b>${esc(title(p))}${p.ex ? '<span class="ex">' + t('exemple') + '</span>' : ''}</b><small>${esc([p.taille, (app.hasComptes() ? app.cptName(p) : '') || tv(p.canal || 'Vinted'), p.acheteur ? '@' + p.acheteur : '', ok(p.dv) ? fd(p.dv) : ''].filter(Boolean).join(' · '))}${isFinal(p) || !app.countsForFisc(p) ? '' : ' <span class="tag">' + t('à finaliser') + '</span>'}</small></div><div class="p ${pr >= 0 ? 'g' : 'b'}">${pr >= 0 ? '+' : ''}${eur(pr)}<small>${t('vendu {p}', { p: eur(p.pv) })}</small></div></button>`;
};

/* filtres de la fenêtre « Filtres » (même système que le Stock, voir filters.js) */
const ADVS = ['pf', 'cat', 'marque', 'per'];
const adv = Object.assign({ pf: '', cat: '', marque: '', per: '', tri: '' }, LSg('salesAdv', {}));
const perOk = p => {
  if (!adv.per) return true;
  const d = p.dv || '', t0 = today();
  return adv.per === 'mo' ? d.slice(0, 7) === t0.slice(0, 7) : adv.per === 'yr' ? d.slice(0, 4) === t0.slice(0, 4) : d >= addDays(t0, -(+adv.per));
};
const advOkNoPer = p => (!adv.pf || (p.canal || 'Vinted') === adv.pf) && (!adv.cat || p.cat === adv.cat) && (!adv.marque || p.marque === adv.marque);
const advOk = p => advOkNoPer(p) && perOk(p);
/** Fenêtre de la période précédente (même longueur) selon le filtre « Période », ou null s'il n'y en a pas. */
const prevWin = () => {
  if (!adv.per) return null;
  const t0 = today();
  if (adv.per === 'mo') { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); return s => s.slice(0, 7) === m; }
  if (adv.per === 'yr') { const y = String(+t0.slice(0, 4) - 1); return s => s.slice(0, 4) === y; }
  const n = +adv.per, a = addDays(t0, -2 * n), b = addDays(t0, -n);
  return s => s >= a && s < b;
};
const advSave = () => { const o = Object.assign({}, adv); delete o.st; delete o.cf; LSs('salesAdv', o); };
function openSalesFilters() {
  adv.st = flt; adv.cf = cf;
  const S = () => app.P.filter(sold);
  openFilters({
    title: t('Filtres des ventes'), state: adv,
    groups: () => {
      const L = S(), F = salesLists(), CP = app.hasComptes() ? app.comptes() : [];
      return [
        { k: 'st', l: t('Statut'), o: [['all', t('Toutes')], ['month', t('Ce mois-ci')], ['fin', t('À finaliser')]].map(([k, l]) => [k, l, F[k].length]) },
        ...(CP.length > 1 ? [{ k: 'cf', l: t('Compte de vente'), o: CP.map(c => [c.id, c.n, L.filter(p => (app.compteOf(p) || {}).id === c.id).length]) }] : []),
        { k: 'per', l: t('Période'), o: [['7', t('7 derniers jours')], ['30', t('30 derniers jours')], ['mo', t('Ce mois-ci')], ['yr', t('Cette année')]] },
        { k: 'pf', l: t('Plateforme'), o: facet(L, p => p.canal || 'Vinted').map(([v, n]) => [v, tv(v), n]) },
        { k: 'cat', l: t('Catégorie'), o: facet(L, p => p.cat).map(([v, n]) => [v, tv(v), n]) },
        { k: 'marque', l: t('Marque'), o: facet(L, p => p.marque).map(([v, n]) => [v, v, n]) },
        { k: 'tri', l: t('Trier par'), o: [['benD', t('Bénéfice, du plus grand')], ['benA', t('Bénéfice, du plus petit')], ['prixD', t('Prix de vente, du plus cher')], ['old', t('Plus anciennes d\'abord')]] },
      ].filter(g => g.o.length);
    },
    changed: () => { flt = adv.st || 'all'; LSs('salesFlt', flt); cf = adv.cf || ''; lim = 60; advSave(); renderSales(); },
    count: () => {
      const F = salesLists();
      return F[adv.st || 'all'].filter(p => !adv.cf || (app.compteOf(p) || {}).id === adv.cf).filter(advOk).length;
    },
    clear: () => { ADVS.concat('tri').forEach(k => { adv[k] = ''; }); adv.st = 'all'; adv.cf = ''; },
  });
}

export function salesLists() {
  const S = app.P.filter(sold), mo = today().slice(0, 7);
  return { all: S, month: S.filter(p => (p.dv || '').slice(0, 7) === mo), prep: colisList(), fin: pendingSales() };
}

function renderSales() {
  const F = salesLists(), q = $('sq').value.trim().toLowerCase();
  $('sq').placeholder = t('Rechercher une vente (pièce, @pseudo, code…)');
  if (!(flt in F)) flt = 'all';
  const CP = app.hasComptes() ? app.comptes() : [];
  if (cf && !CP.some(c => c.id === cf)) cf = '';
  /* seuls « Toutes » et « Filtres » restent à l'écran : statut, compte, période, plateforme… sont dans la fenêtre Filtres */
  const nAdv = activeCount(adv, ADVS) + (flt !== 'all' ? 1 : 0) + (cf ? 1 : 0);
  $('sflt').innerHTML = `<button type="button" class="chip sm${nAdv ? '' : ' on'}" data-sf="all">${t('Toutes')} · ${F.all.length}</button><button type="button" class="chip sm fbtn${nAdv ? ' on' : ''}" data-sfadv="1">${filterLabel(nAdv)}</button>`;
  const toks = app.searchToks(q), pseudo = q.replace(/^@/, '');
  const TRI = { benD: (a, b) => profit(b) - profit(a), benA: (a, b) => profit(a) - profit(b), prixD: (a, b) => (b.pv || 0) - (a.pv || 0), old: (a, b) => (a.dv || '').localeCompare(b.dv || '') }[adv.tri];
  const L = F[flt].filter(p => !cf || (app.compteOf(p) || {}).id === cf).filter(advOk).filter(p => !q || (toks.length && app.searchScore(p, toks) >= 0) || (p.acheteur || '').toLowerCase().includes(pseudo) || (p.code || '').toLowerCase().includes(q))
    .sort((a, b) => (TRI ? TRI(a, b) : 0) || (b.dv || '').localeCompare(a.dv || '') || (b.vt || 0) - (a.vt || 0));
  const STN = { month: t('Ce mois-ci'), prep: t('À préparer'), fin: t('À finaliser') };
  const act = activeChips(Object.assign({}, adv, { st: flt !== 'all' ? flt : '', cf }), ['st', 'cf', ...ADVS], { st: v => STN[v], cf: v => (CP.find(c => c.id === v) || {}).n || v, pf: v => tv(v), cat: v => tv(v), per: v => ({ 7: t('7 derniers jours'), 30: t('30 derniers jours'), mo: t('Ce mois-ci'), yr: t('Cette année') })[v] });
  const ca = L.reduce((a, p) => a + (p.pv || 0), 0), ben = L.reduce((a, p) => a + profit(p), 0);
  /* 4 tuiles colorées ; avec une période choisie dans « Filtres », une flèche compare à la période d'avant (même longueur) */
  const win = prevWin(), PV = win ? F[flt].filter(p => !cf || (app.compteOf(p) || {}).id === cf).filter(advOkNoPer).filter(p => win(p.dv || '')) : null;
  const pCa = PV ? PV.reduce((a, p) => a + (p.pv || 0), 0) : 0, pBen = PV ? PV.reduce((a, p) => a + profit(p), 0) : 0;
  const mg = ca ? ben / ca * 100 : 0, pMg = pCa ? pBen / pCa * 100 : 0;
  const evo = (c, p, pts) => { if (!PV || !(p || c)) return ''; const d = pts ? c - p : (p ? (c - p) / Math.abs(p) * 100 : 100), r = Math.round(d); return `<small class="sev ${r > 0 ? 'up' : r < 0 ? 'dn' : ''}">${r > 0 ? '↑' : r < 0 ? '↓' : '='} ${Math.abs(r)}${pts ? ' pt' : ' %'}</small>`; };
  const stile = (k, ico, big, lab, ev) => `<div class="stt st-${k}"><i class="sti">${ico}</i><b>${big}</b><span>${lab}</span>${ev}</div>`;
  const SI = { v: '<path d="M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0"/>', c: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2c.4-1 1.4-1.4 2.5-1.4s2.2.5 2.2 1.5c0 2.2-4.7 1-4.7 3.3 0 1 1 1.6 2.5 1.6 1.2 0 2.1-.5 2.5-1.4"/>', b: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', m: '<path d="M18 6 6 18M8 8h.01M16 16h.01"/>' };
  const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${SI[k]}</svg>`;
  $('ssum').innerHTML = `<div class="card"><div class="sgt">${stile('v', ico('v'), L.length, t(L.length > 1 ? 'ventes' : 'vente'), evo(L.length, PV ? PV.length : 0))}${stile('c', ico('c'), eurR(ca), t('encaissés'), evo(ca, pCa))}${stile('b', ico('b'), eurR(ben), t('de bénéfice'), evo(ben, pBen))}${stile('m', ico('m'), Math.round(mg) + ' %', t('de marge'), evo(mg, pMg, true))}</div>${PV ? `<div class="hint sgc">${t('Flèches : évolution par rapport à la période précédente de même durée.')}</div>` : ''}${flt === 'fin' ? `<div class="tdx"><span>${F.fin.length ? t('Une vente est finalisée quand l\'argent est reçu. Elle compte alors dans ton chiffre d\'affaires à déclarer.') : t('Aucune vente en attente de finalisation.')}</span>${F.fin.length ? `<button type="button" class="btn sec" data-sfin="1">${t('Tout finaliser ({n})', { n: F.fin.length })}</button>` : ''}</div>` : ''}</div>`;
  const page = L.slice(0, lim);
  $('slst').innerHTML = act + (page.length ? page.map(row).join('') + (L.length > lim ? `<button type="button" class="btn sec" id="smore">${t('Afficher plus ({n})', { n: L.length - lim })}</button>` : '')
    : `<div class="card empty">${app.P.some(sold) || q ? t('Aucune vente ici.') : t('Aucune vente pour l\'instant. Les ventes faites depuis une fiche ou en Live apparaissent ici.')}</div>`);
  hydrate();
}

$('sq').addEventListener('input', () => { lim = 60; renderSales(); });
$('slst').addEventListener('click', e => {
  const fc = e.target.closest('[data-fclr]');
  if (!fc) return;
  e.stopPropagation();
  const k = fc.dataset.fclr;
  if (k === '*') { ADVS.forEach(x => { adv[x] = ''; }); flt = 'all'; cf = ''; } else if (k === 'st') flt = 'all'; else if (k === 'cf') cf = ''; else adv[k] = '';
  LSs('salesFlt', flt); advSave(); lim = 60; renderSales();
});
$('sflt').onclick = e => { if (e.target.closest('[data-sfadv]')) return openSalesFilters(); const b = e.target.closest('[data-sf]'); if (b) { flt = b.dataset.sf; if (flt === 'all') { ADVS.concat('tri').forEach(x => { adv[x] = ''; }); cf = ''; advSave(); } LSs('salesFlt', flt); lim = 60; renderSales(); } };
host.addEventListener('click', e => {
  if (e.target.closest('#smore')) { lim += 60; renderSales(); return; }
  if (e.target.closest('[data-sfin]')) {
    const L = pendingSales(), old = app.finalize(L);
    renderSales(); app.toast(t('{n} ventes finalisées', { n: L.length }), () => { old.forEach(p => app.save(p)); renderSales(); });
    return;
  }
  const b = e.target.closest('.li[data-id]');
  if (b) app.openSheet(b.dataset.id);
});
$('lv_back').onclick = () => go('sales');
app.openSalesFilter = k => { app.salesFilter(k); go('sales'); };
