/* ---------- Clôture des ventes : le moteur (pur, sans écran) ----------
   Spécification « Max — Clôture des ventes ». À la fin du mois : ce que la plateforme a réglé, ce qui est encore en attente, ce qui mérite une vérification.
   Trois vues séparées, jamais additionnées : Ventes du mois, Mouvements plateforme du mois, Virements du mois. Montants en centimes entiers signés ; « inconnu » n'est pas zéro ;
   aucune vente, aucun stock n'est créé ou modifié ici. Un rapprochement certain exige une référence exacte et unique ; tout le reste n'est que suggestion. */
import { amountMinor, dateIso, parseCSV } from './live-import.js';

export const cl = o => JSON.parse(JSON.stringify(o));
export const emptyState = () => ({ v: 1, batches: [], entries: [], payouts: [], checks: {}, links: [], res: {}, periods: {}, ops: {}, seq: 1 });
const isN = x => typeof x === 'number' && isFinite(x);
export const periodKey = (account, currency, month) => account + '|' + (currency || 'EUR') + '|' + month;
export const monthOf = d => String(d || '').slice(0, 7);
const inMonth = (d, m) => !!d && monthOf(d) === m;
export const TYPES = ['sale', 'fee', 'refund', 'shipping', 'reserve', 'adjust', 'purchase'];

/* ---------- ventes (lecture seule) ---------- */
/** Ventes Max → lignes de contrôle. Frais inconnus = null (jamais zéro). */
export function salesFromPieces(P) {
  return P.filter(p => p.statut === 'Vendu' && /^\d{4}-\d{2}-\d{2}$/.test(p.dv || '')).map(p => ({ id: p.id, code: p.code || '', account: p.canal || 'Vinted', date: p.dv, price: isN(p.pv) ? Math.round(p.pv * 100) : null, fees: isN(p.frais) ? Math.round(p.frais * 100) : null, currency: 'EUR', label: [p.marque, p.sub || p.cat].filter(Boolean).join(' · ') || p.code || p.id }));
}
const expectedNet = s => (s.price == null || s.fees == null ? null : s.price - s.fees);

/* ---------- imports ---------- */
const norm = h => String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ALIAS = { extId: ['id ecriture', 'id de l ecriture', 'transaction id', 'id transaction', 'entry id', 'id'], order: ['order id', 'id de commande', 'numero de commande', 'commande', 'reference commande', 'code'], type: ['type', 'type d ecriture', 'transaction type', 'nature'], amount: ['montant', 'amount', 'montant net', 'net amount', 'settlement amount', 'montant du reglement'],
  currency: ['devise', 'currency'], date: ['date', 'date d effet', 'date de reglement', 'settlement date', 'date de la transaction', 'date de creation'], stage: ['statut', 'status', 'etat', 'etat du reglement'], payout: ['virement', 'id du virement', 'payout id', 'reference du virement', 'reglement'], desc: ['descriptif', 'informatif', 'descriptive'] };
const TYPE_MAP = [[/virement|retrait|payout|withdraw|transfer/, 'payout'], [/rembours|refund|retour/, 'refund'], [/commission|frais|fee/, 'fee'], [/port|ship|livraison|delivery/, 'shipping'], [/reserve|retenue|hold/, 'reserve'], [/achat|purchase/, 'purchase'], [/ajust|adjust|correction/, 'adjust'], [/vente|sale|order|commande|recette|revenue/, 'sale']];
const STAGE_MAP = [[/attente|pending|provisoire|unsettled|estim/, 'pending'], [/regl|settled|paid|pay|comptabil|termin|complet/, 'settled']];
const tmap = v => { const k = norm(v); for (const [re, t] of TYPE_MAP) if (re.test(k)) return t; return null; };
const smap = v => { const k = norm(v); for (const [re, t] of STAGE_MAP) if (re.test(k)) return t; return k ? 'unknown' : 'settled'; };
const yes = v => /^(oui|yes|true|1|x)$/i.test(String(v == null ? '' : v).trim());
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
export const fileHash = text => fnv(String(text));

/** Aperçu d'un import (rien n'est écrit). `src` : { rows (tableau 2D) | text (CSV), account, hash?, coverage? }. Les lignes écartées sont listées avec leur raison. */
export function previewFinanceImport(s, src) {
  const rows = src.rows || parseCSV(src.text || ''), hash = src.hash || fileHash(src.text || JSON.stringify(rows)), account = src.account, out = { account, hash, entries: [], payouts: [], rejected: [], duplicates: [], dupCandidates: [], sameFile: false, error: null, headers: [], coverage: Object.assign({ from: '', to: '', status: 'unknown' }, src.coverage) };
  if (s.batches.some(b => b.account === account && b.hash === hash && b.kind !== 'manual')) { out.sameFile = true; return out; }
  let h = -1, C = {}; for (let i = 0; i < Math.min(10, rows.length - 1); i++) { const m = {}, H = rows[i].map(norm); Object.entries(ALIAS).forEach(([f, l]) => { for (const a of l) { const j = H.indexOf(a); if (j >= 0) { m[f] = j; break; } } }); if (m.amount != null && m.date != null) { h = i; C = m; break; } }
  if (h < 0) { out.error = 'colonnes_introuvables'; out.headers = (rows[0] || []).map(x => String(x).trim()); return out; }
  out.headers = rows[h].map(x => String(x).trim());
  const cell = (r, f) => (C[f] == null ? '' : String(r[C[f]] == null ? '' : r[C[f]]).trim()), seen = new Set(); let dates = [];
  rows.slice(h + 1).forEach((r, i) => {
    if (!r.some(x => String(x).trim() !== '')) return; const row = h + i + 2, cents = amountMinor(cell(r, 'amount')), date = dateIso(cell(r, 'date')).slice(0, 10), typeRaw = cell(r, 'type'), type = typeRaw ? tmap(typeRaw) : 'sale', cur = (cell(r, 'currency') || 'EUR').toUpperCase().slice(0, 3);
    if (cents == null) return out.rejected.push({ row, reason: 'montant_illisible' }); if (!date) return out.rejected.push({ row, reason: 'date_illisible' }); if (!type) return out.rejected.push({ row, reason: 'type_inconnu' });
    if (!/^[A-Z]{3}$/.test(cur)) return out.rejected.push({ row, reason: 'devise_illisible' });
    dates.push(date); const ext = cell(r, 'extId'), key = ext ? account + '|x|' + ext : hash + '|' + row + '|' + type;
    if (seen.has(key)) return out.duplicates.push({ row, reason: 'meme_id_dans_le_fichier' }); seen.add(key);
    if (type === 'payout') { out.payouts.push({ extId: ext || null, ref: cell(r, 'payout') || ext || '', cents: Math.abs(cents), currency: cur, status: smap(cell(r, 'stage')) === 'pending' ? 'announced' : 'sent', sentAt: date, row }); return; }
    out.entries.push({ extId: ext || null, key, orderRef: cell(r, 'order') || null, payoutRef: cell(r, 'payout') || null, type, stage: smap(cell(r, 'stage')) === 'unknown' ? 'pending' : smap(cell(r, 'stage')), scope: cell(r, 'order') ? 'order' : 'account', cents, currency: cur, effectDate: date, descriptive: yes(cell(r, 'desc')), row });
  });
  dates.sort(); if (!out.coverage.from) { out.coverage.from = dates[0] || ''; out.coverage.to = dates[dates.length - 1] || ''; }
  /* même écriture sans identifiant déjà connue : candidat doublon, jamais fusion silencieuse */
  out.entries.forEach(e => { if (e.extId) { const old = s.entries.find(x => x.account === account && x.extId === e.extId); if (old) e.revises = old.id; } else if (s.entries.some(x => x.account === account && !x.extId && x.type === e.type && x.cents === e.cents && x.effectDate === e.effectDate && (x.orderRef || '') === (e.orderRef || ''))) { e.dup = true; out.dupCandidates.push({ row: e.row }); } });
  return out;
}
/** Valide un aperçu. Rejouable : le même opId, ou le même fichier, ne change rien. */
export function commitFinanceImport(s0, pv, opId, now) {
  if (pv.error || pv.sameFile) return { state: s0, batchId: null, noop: true };
  if (opId && s0.ops[opId]) return { state: s0, batchId: s0.ops[opId], noop: true };
  const s = cl(s0), id = 'b' + s.seq++; s.batches.push({ id, account: pv.account, kind: 'csv', hash: pv.hash, coverage: pv.coverage, rows: pv.entries.length + pv.payouts.length, rejected: pv.rejected, at: now || '' });
  pv.entries.forEach(e => { const old = e.revises && s.entries.find(x => x.id === e.revises), en = Object.assign({}, e, { id: 'e' + s.seq++, account: pv.account, batchId: id, rev: 1, history: [] }); delete en.row; delete en.revises;
    if (old) { old.history.push({ cents: old.cents, stage: old.stage, effectDate: old.effectDate, batchId: old.batchId }); Object.assign(old, { cents: en.cents, stage: en.stage, effectDate: en.effectDate, batchId: id, rev: old.rev + 1 }); } else s.entries.push(en); });
  pv.payouts.forEach(p => { const old = p.extId && s.payouts.find(x => x.account === pv.account && x.extId === p.extId); if (old) { Object.assign(old, { cents: p.cents, status: p.status, sentAt: p.sentAt }); return; } s.payouts.push({ id: 'p' + s.seq++, account: pv.account, extId: p.extId, ref: p.ref, cents: p.cents, currency: p.currency, status: p.status, sentAt: p.sentAt, expectedAt: '', source: id }); });
  if (opId) s.ops[opId] = id; return { state: s, batchId: id, noop: false };
}
/** Saisie manuelle d'une écriture (depuis le portail de la plateforme). */
export function addManualEntry(s0, e, now) {
  const s = cl(s0); let b = s.batches.find(x => x.kind === 'manual' && x.account === e.account); if (!b) { b = { id: 'b' + s.seq++, account: e.account, kind: 'manual', hash: 'manual', coverage: { from: '', to: '', status: 'partial' }, rows: 0, rejected: [], at: now || '' }; s.batches.push(b); }
  const c = typeof e.cents === 'number' ? e.cents : amountMinor(e.amount); if (c == null) return { state: s0, error: 'montant_illisible' };
  b.rows++; s.entries.push({ id: 'e' + s.seq++, account: e.account, batchId: b.id, extId: null, key: 'm|' + s.seq, orderRef: e.orderRef || null, payoutRef: null, type: e.type, stage: e.stage || 'settled', scope: e.orderRef ? 'order' : 'account', cents: c, currency: e.currency || 'EUR', effectDate: e.effectDate, descriptive: !!e.descriptive, rev: 1, history: [] });
  return { state: s, error: null };
}
export function addPayout(s0, p) { const s = cl(s0); s.payouts.push(Object.assign({ id: 'p' + s.seq++, extId: null, ref: '', currency: 'EUR', status: 'sent', expectedAt: '', source: 'manual' }, p)); return s; }
export function setCoverage(s0, batchId, cov) { const s = cl(s0), b = s.batches.find(x => x.id === batchId); if (b) Object.assign(b.coverage, cov); return s; }
/** Contrôle bancaire facultatif, 100 % manuel : aucun accès à la banque, aucune coordonnée enregistrée. */
export function confirmBank(s0, payoutId, c) { const s = cl(s0); s.checks[payoutId] = { status: c.status, cents: c.status === 'received' || c.status === 'different' ? c.cents : null, date: c.date || '', note: c.note || '', actor: c.actor || '', at: c.at || '' }; return s; }

/* ---------- rapprochement ---------- */
const linkedEntryCents = (s, e, saleId) => { const L = s.links.filter(l => l.entryId === e.id); if (L.length) return L.filter(l => l.saleId === saleId).reduce((a, l) => a + l.cents, 0); return null; };
/** Ventes → écritures. A (certain) : référence exacte et unique dans le même compte. Un lien manuel prime. */
export function matchEntries(s, sales, account) {
  const S = sales.filter(x => x.account === account), by = {}; S.forEach(x => [x.id, x.code].filter(Boolean).forEach(k => { (by[k] = by[k] || new Set()).add(x.id); }));
  const E = s.entries.filter(e => e.account === account && !e.dup), res = { bySale: {}, orphans: [], unscoped: [] };
  E.forEach(e => {
    const manual = s.links.filter(l => l.entryId === e.id);
    if (manual.length) { manual.forEach(l => { (res.bySale[l.saleId] = res.bySale[l.saleId] || []).push({ e, cents: l.cents, mode: l.mode }); }); return; }
    if (e.scope === 'account' || !e.orderRef) { if (!['sale'].includes(e.type)) res.unscoped.push(e); else res.orphans.push(e); return; }
    const ids = by[e.orderRef]; if (ids && ids.size === 1) { const id = [...ids][0]; (res.bySale[id] = res.bySale[id] || []).push({ e, cents: e.cents, mode: 'exact' }); } else res.orphans.push(e);
  });
  return res;
}
const netParts = x => !x.e.descriptive;
/** État de règlement d'une vente à la date d'arrêté. Une écriture datée après l'arrêté n'est pas encore connue ce jour-là. */
function saleState(s, sale, m, asOf, cov) {
  const L = (m.bySale[sale.id] || []).filter(netParts), known = L.filter(x => !asOf || x.e.effectDate <= asOf);
  const confirmed = known.filter(x => x.e.stage === 'settled').reduce((a, x) => a + x.cents, 0), hasSettled = known.some(x => x.e.stage === 'settled'), pendingL = L.filter(x => x.e.stage === 'pending' && (!asOf || !x.e.effectDate || x.e.effectDate <= asOf)), pending = pendingL.reduce((a, x) => a + x.cents, 0);
  let st; if (hasSettled && !pendingL.length) st = 'reglee'; else if (pendingL.length) st = 'attente_identifiee'; else if (L.length && !known.length) st = 'non_verifie';
  else st = cov(sale) ? 'a_rapprocher' : 'non_verifie';
  return { st, confirmed: hasSettled ? confirmed : null, pending: pendingL.length ? pending : null, linked: L.length > 0 };
}
const covers = (s, account) => sale => s.batches.some(b => b.account === account && b.coverage.status === 'complete' && b.coverage.from && b.coverage.from <= sale.date && b.coverage.to >= sale.date);

/** Les trois vues du mois, sans jamais les additionner. */
export function getCloseSummary(s, sales, o) {
  const { account, month } = o, currency = o.currency || 'EUR', asOf = o.asOf || month + '-31', m = matchEntries(s, sales, account), cov = covers(s, account);
  const S = sales.filter(x => x.account === account && x.currency === currency && inMonth(x.date, month));
  const rows = S.map(x => { const st = saleState(s, x, m, asOf, cov), exp = expectedNet(x); return Object.assign({ sale: x, expected: exp }, st); });
  const comparable = rows.filter(r => r.linked && r.expected != null);
  const sv = { recorded: S.reduce((a, x) => a + (x.price || 0), 0), recordedUnknown: S.filter(x => x.price == null).length, count: S.length,
    expectedNet: rows.reduce((a, r) => a + (r.expected || 0), 0), expectedUnknown: rows.filter(r => r.expected == null).length, expectedIsEstimate: true,
    confirmed: comparable.reduce((a, r) => a + (r.confirmed || 0), 0), pending: comparable.reduce((a, r) => a + (r.pending || 0), 0),
    comparableExpected: comparable.reduce((a, r) => a + r.expected, 0), comparableCount: comparable.length, rows,
    counts: { reglee: 0, attente_identifiee: 0, non_verifie: 0, a_rapprocher: 0 } };
  rows.forEach(r => { sv.counts[r.st]++; });
  sv.gap = sv.comparableCount ? sv.comparableExpected - sv.confirmed - sv.pending : null;                     /* attendu − confirmé − attente identifiée, sur le même périmètre */
  const mv = s.entries.filter(e => e.account === account && e.currency === currency && !e.dup && !e.descriptive && inMonth(e.effectDate, month));
  const movements = { byType: {}, settled: 0, pendingCount: 0, count: mv.length }; mv.forEach(e => { if (e.stage === 'settled') { movements.byType[e.type] = (movements.byType[e.type] || 0) + e.cents; movements.settled += e.cents; } else movements.pendingCount++; });
  const po = s.payouts.filter(p => p.account === account && p.currency === currency && inMonth(p.sentAt, month)).map(p => { const c = s.checks[p.id] || null; return { payout: p, check: c, gap: c && (c.status === 'received' || c.status === 'different') && isN(c.cents) ? p.cents - c.cents : null, state: !c ? 'non_verifie' : c.status === 'received' ? 'recu' : c.status === 'different' ? 'virement_a_verifier' : 'virement_a_verifier' }; });
  return { account, currency, month, asOf, sales: sv, movements, payouts: { list: po, total: po.reduce((a, x) => a + x.payout.cents, 0), count: po.length },
    coverage: s.batches.filter(b => b.account === account).map(b => ({ id: b.id, kind: b.kind, status: b.coverage.status, from: b.coverage.from, to: b.coverage.to, rows: b.rows, rejected: b.rejected.length })) };
}

/* ---------- écarts à traiter ---------- */
const age = d => (d ? Date.parse(d) : 0);
/** Liste des écarts, triée par montant puis ancienneté. Chaque écart a une clé stable ; une résolution documentée la fait sortir de la liste « à traiter ». */
export function issuesFor(s, sales, o) {
  const sum = getCloseSummary(s, sales, o), m = matchEntries(s, sales, o.account), out = [], S = sales.filter(x => x.account === o.account);
  const push = i => { const r = s.res[i.key]; out.push(Object.assign({ resolved: !!r, resolution: r || null }, i)); };
  sum.sales.rows.forEach(r => {
    if (r.st === 'a_rapprocher') push({ key: 'sale:' + r.sale.id, type: 'a_rapprocher', saleId: r.sale.id, cents: r.expected != null ? r.expected : r.sale.price, date: r.sale.date });
    if (r.linked && r.expected != null && r.confirmed != null) { const d = r.expected - r.confirmed - (r.pending || 0); if (d !== 0) push({ key: 'gap:' + r.sale.id, type: 'ecart_montant', saleId: r.sale.id, cents: d, date: r.sale.date, expected: r.expected, confirmed: r.confirmed }); }
    const late = (m.bySale[r.sale.id] || []).find(x => x.e.stage === 'settled' && x.e.effectDate > o.month + '-31');
    if (late && r.st !== 'reglee') push({ key: 'late:' + r.sale.id, type: 'reglee_hors_periode', saleId: r.sale.id, cents: late.cents, date: late.e.effectDate });
  });
  m.orphans.forEach(e => { if (!inMonth(e.effectDate, o.month) && !o.allMonths) return; const used = new Set(Object.values(m.bySale).flat().map(x => x.e.id));
    if (used.has(e.id)) return; const cand = e.type === 'sale' ? S.filter(x => !(m.bySale[x.id] || []).length && Math.abs((age(x.date) - age(e.effectDate)) / 864e5) <= 3 && (x.price === e.cents || expectedNet(x) === e.cents)) : [];
    push({ key: 'entry:' + e.id, type: 'a_rapprocher_ecriture', entryId: e.id, cents: e.cents, date: e.effectDate, suggestions: cand.map(x => x.id), ambiguous: cand.length > 1 }); });
  m.unscoped.forEach(e => { if (inMonth(e.effectDate, o.month)) push({ key: 'adj:' + e.id, type: 'ajustement_non_ventile', entryId: e.id, cents: e.cents, date: e.effectDate, kind: e.type }); });
  sum.payouts.list.forEach(p => { if (p.state === 'virement_a_verifier' || p.payout.status === 'rejected') push({ key: 'payout:' + p.payout.id, type: 'virement_a_verifier', payoutId: p.payout.id, cents: p.gap != null ? p.gap : p.payout.cents, date: p.payout.sentAt }); });
  s.entries.filter(e => e.account === o.account && e.dup).forEach(e => push({ key: 'dup:' + e.id, type: 'doublon_candidat', entryId: e.id, cents: e.cents, date: e.effectDate }));
  out.sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents) || age(a.date) - age(b.date)); return { issues: out, summary: sum };
}
/** Lie une écriture à une vente (suggestion validée ou saisie manuelle) ou documente un écart. Refuse un dépassement du montant de l'écriture. */
export function resolveIssue(s0, key, decision, evidence, expectedRev) {
  const s = cl(s0), cur = s.res[key];
  if (expectedRev != null && ((cur && cur.rev) || 0) !== expectedRev) return { state: s0, error: 'revision' };
  const rev = ((cur && cur.rev) || 0) + 1, rec = { kind: decision.kind, cause: decision.cause || '', evidence: evidence || '', actor: decision.actor || '', at: decision.at || '', rev, history: (cur ? cur.history || [] : []).concat(cur ? [{ kind: cur.kind, cause: cur.cause, at: cur.at, actor: cur.actor }] : []) };
  if (decision.kind === 'link') {
    const e = s.entries.find(x => x.id === decision.entryId); if (!e) return { state: s0, error: 'ecriture_inconnue' }; const cents = isN(decision.cents) ? decision.cents : e.cents;
    if (Math.sign(cents) !== Math.sign(e.cents) || Math.abs(cents) + s.links.filter(l => l.entryId === e.id && l.saleId !== decision.saleId).reduce((a, l) => a + Math.abs(l.cents), 0) > Math.abs(e.cents)) return { state: s0, error: 'montant_depasse' };
    s.links = s.links.filter(l => !(l.entryId === e.id && l.saleId === decision.saleId)); s.links.push({ entryId: e.id, saleId: decision.saleId, cents, mode: decision.mode || 'manuel', actor: decision.actor || '', at: decision.at || '', evidence: evidence || '' }); rec.entryId = e.id; rec.saleId = decision.saleId;
  }
  if (decision.kind === 'dup_keep' || decision.kind === 'dup_drop') { const e = s.entries.find(x => x.id === decision.entryId); if (e) { if (decision.kind === 'dup_keep') e.dup = false; else s.entries = s.entries.filter(x => x.id !== e.id); } }
  s.res[key] = rec; return { state: s, error: null };
}

/* ---------- clôture versionnée ---------- */
const OPEN = new Set(['a_rapprocher', 'ecart_montant', 'a_rapprocher_ecriture', 'ajustement_non_ventile', 'virement_a_verifier', 'doublon_candidat']);
/** Fige la période. Sans exceptions, tout écart doit être traité ; avec `withExceptions`, les écarts restants et leur motif sont enregistrés. Un virement non confirmé en banque n'empêche jamais la clôture. */
export function closePeriod(s0, sales, o) {
  if (o.opId && s0.ops[o.opId]) return { state: s0, error: null, snapshot: s0.ops[o.opId + ':snap'] || null, noop: true };
  const key = periodKey(o.account, o.currency, o.month), cur = s0.periods[key] || { status: 'open', rev: 0, snapshots: [] };
  if (o.expectedRevision != null && o.expectedRevision !== cur.rev) return { state: s0, error: 'revision' };
  const { issues, summary } = issuesFor(s0, sales, o), left = issues.filter(i => !i.resolved && OPEN.has(i.type));
  if (left.length && !o.withExceptions) return { state: s0, error: 'ecarts_non_traites', left };
  const s = cl(s0), snap = { version: cur.snapshots.length + 1, asOf: o.asOf, at: o.now || '', actor: o.actor || '', summary: cl(summary), sources: s.batches.filter(b => b.account === o.account).map(b => ({ id: b.id, kind: b.kind, hash: b.hash, coverage: b.coverage, rows: b.rows })),
    exceptions: left.map(i => ({ key: i.key, type: i.type, cents: i.cents, reason: (o.reasons && o.reasons[i.key]) || o.reason || '' })), note: o.note || '' };
  s.periods[key] = { status: left.length ? 'closed_exceptions' : 'closed', rev: cur.rev + 1, snapshots: cur.snapshots.concat([snap]) };
  if (o.opId) { s.ops[o.opId] = key; s.ops[o.opId + ':snap'] = snap; } return { state: s, error: null, snapshot: snap };
}
/** Rouvre : un nouveau brouillon, la version close reste intacte. */
export function reopenPeriod(s0, o) {
  const key = periodKey(o.account, o.currency, o.month), cur = s0.periods[key]; if (!cur || cur.status === 'open') return { state: s0, error: 'pas_cloturee' };
  const s = cl(s0); s.periods[key] = Object.assign({}, cur, { status: 'open', rev: cur.rev + 1, reopenedFor: o.reason || '' }); return { state: s, error: null };
}
/** Écritures arrivées après la dernière clôture : si leur date d'effet est antérieure à l'arrêté, le résultat aurait changé (nouvelle version proposée) ; sinon c'est un mouvement du mois suivant. */
export function lateEntries(s, o) {
  const cur = s.periods[periodKey(o.account, o.currency, o.month)], snap = cur && cur.snapshots[cur.snapshots.length - 1]; if (!snap) return [];
  const bt = {}; s.batches.forEach(b => { bt[b.id] = b.at; });
  return s.entries.filter(e => e.account === o.account && (bt[e.batchId] || '') > snap.at && !e.dup).map(e => ({ entryId: e.id, cents: e.cents, effectDate: e.effectDate, kind: e.effectDate <= snap.asOf ? 'aurait_change' : 'mouvement_suivant' }));
}
export const periodStatus = (s, o) => (s.periods[periodKey(o.account, o.currency, o.month)] || { status: 'open', rev: 0, snapshots: [] });

/* ---------- export ---------- */
/** Une cellule qui commence par = + - @ est neutralisée (pas de formule exécutable dans le CSV produit). */
export const safeCell = v => { let x = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(x) && !/^-?\d+([.,]\d+)?$/.test(x)) x = "'" + x; return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const eu = c => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
export function csvExport(summary, issues) {
  const L = [['Récapitulatif de rapprochement Max', summary.account, summary.currency, summary.month, 'Situation au ' + summary.asOf]];
  L.push([]); L.push(['Ventes du mois', 'Ventes enregistrées', eu(summary.sales.recorded), 'Net attendu (estimation)', eu(summary.sales.expectedNet), 'Confirmé (périmètre comparable)', eu(summary.sales.confirmed), 'En attente identifiée', eu(summary.sales.pending), 'À vérifier', eu(summary.sales.gap)]);
  L.push(['Mouvements plateforme du mois', 'Net confirmé', eu(summary.movements.settled)]); L.push(['Virements du mois', 'Total', eu(summary.payouts.total), 'Nombre', summary.payouts.count]);
  L.push([]); L.push(['Écart', 'Type', 'Montant', 'Date', 'Traité']); (issues || []).forEach(i => L.push([i.key, i.type, eu(i.cents), i.date, i.resolved ? 'oui' : 'non']));
  return L.map(r => r.map(safeCell).join(';')).join('\n');
}
