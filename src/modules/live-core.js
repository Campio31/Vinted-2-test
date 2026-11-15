/* ---------- Live connecté : le moteur (pur, sans écran ni réseau) ----------
   Implémente la spécification « Max Live » (docs/Max-Live-Spec-Technique.md) : commandes et lignes normalisées, attribution au live et à la cible
   (pièce, variante, ballot), effets de stock sans doublon, finance séparée en brut / provisoire / comptabilisé, résultat d'un ballot, liste « À rapprocher ».
   Tout est calculé à partir d'un état JSON simple ; chaque fonction renvoie un nouvel état (rien n'est modifié sur place), ce qui rend les rejeux sans danger.
   Les montants sont des centimes entiers. Le moteur ne parle à aucune plateforme : les connecteurs (démo ici, TikTok Shop côté serveur) lui fournissent des lignes. */

export const cl = s => JSON.parse(JSON.stringify(s));
export const emptyState = () => ({ v: 1, accounts: [], sessions: [], ballots: [], rules: [], links: [], variants: {}, lines: {}, effects: {}, movements: [], anomalies: [], entries: {}, overrides: [], seq: 1 });
const nid = (s, p) => p + (s.seq++);

/* ---------- argent : centimes entiers, jamais de calcul flottant ---------- */
/** « 12,34 » ou « 12.34 » → 1234 ; renvoie null si le texte n'est pas un montant. */
export function toMinor(txt) {
  if (typeof txt === 'number') return Number.isInteger(txt) ? txt : Math.round(txt * 100);
  const m = String(txt == null ? '' : txt).trim().replace(',', '.').match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/); if (!m) return null;
  const c = +m[2] * 100 + (m[3] ? +(m[3] + '0').slice(0, 2) : 0); return m[1] ? -c : c;
}
export const sumMinor = L => L.reduce((a, x) => a + (x || 0), 0);

/* ---------- statuts : la correspondance est propre à chaque plateforme ---------- */
const TIKTOK = { UNPAID: 'pending', ON_HOLD: 'pending', AWAITING_SHIPMENT: 'confirmed', PARTIALLY_SHIPPING: 'confirmed', AWAITING_COLLECTION: 'confirmed', IN_TRANSIT: 'confirmed', DELIVERED: 'confirmed', COMPLETED: 'confirmed', CANCELLED: 'cancelled' };
const WHATNOT = { pending: 'pending', unpaid: 'pending', paid: 'confirmed', shipped: 'confirmed', delivered: 'confirmed', completed: 'confirmed', cancelled: 'cancelled', canceled: 'cancelled' };
export function mapStatus(provider, raw) {
  const k = String(raw == null ? '' : raw); if (provider === 'tiktok_shop') return TIKTOK[k.toUpperCase()] || 'unknown';
  if (provider === 'whatnot') return WHATNOT[k.toLowerCase()] || 'unknown';
  return TIKTOK[k.toUpperCase()] || WHATNOT[k.toLowerCase()] || 'unknown';   /* connecteur de test : les deux vocabulaires */
}
/** Ligne de commande brute (forme interne indicative) → ligne canonique. Un identifiant de live absent n'est jamais remplacé par « le dernier live ouvert ». */
export function normalizeLine(provider, accountId, raw) {
  const liveId = raw.liveId == null || raw.liveId === '' ? null : String(raw.liveId);
  return {
    accountId, orderId: String(raw.orderId), lineId: String(raw.lineId), variantId: raw.variantId == null ? null : String(raw.variantId), listingId: raw.listingId == null ? null : String(raw.listingId),
    merchantSku: raw.merchantSku || null, externalLiveId: liveId, source: liveId ? 'live' : raw.live === false ? 'non_live' : 'unknown', quantity: Math.max(1, +raw.quantity || 1),
    status: mapStatus(provider, raw.status), rawStatus: String(raw.status == null ? '' : raw.status), gross: raw.gross == null ? null : toMinor(raw.gross), providerUpdatedAt: raw.updatedAt || null, restock: !!raw.restock, soldAt: raw.soldAt || (raw.updatedAt || '').slice(0, 10) || null,
  };
}
export const lineKey = l => l.accountId + '|' + l.orderId + '|' + l.lineId;

/* ---------- règles : une cible par portée, un seul défaut par live ---------- */
export function validateRule(s, r) {
  if (!s.ballots.some(b => b.id === r.ballotId)) return 'ballot_inconnu';
  if (!s.sessions.some(x => x.id === r.sessionId)) return 'live_inconnu';
  const same = s.rules.filter(x => x.sessionId === r.sessionId && x.id !== r.id);
  if (r.isDefault) { if (same.some(x => x.isDefault && x.ballotId !== r.ballotId)) return 'defaut_en_double'; }
  else if (same.some(x => !x.isDefault && x.subjectId === r.subjectId && x.ballotId !== r.ballotId)) return 'regle_concurrente';
  return null;
}
export function addRule(s, r) {
  const e = validateRule(s, r); if (e) return { state: s, error: e };
  const n = cl(s); const rule = Object.assign({ id: nid(n, 'r'), subjectType: 'listing', subjectId: null, isDefault: false }, r);
  if (!n.rules.some(x => x.sessionId === rule.sessionId && x.ballotId === rule.ballotId && x.isDefault === rule.isDefault && x.subjectId === rule.subjectId)) n.rules.push(rule);
  return { state: recompute(n), error: null };
}
export function addBallot(s, b) {
  const n = cl(s), id = b.id || nid(n, 'b'), cost = Math.max(0, toMinor(b.landedCost) || 0);
  n.ballots.push({ id, label: b.label, supplier: b.supplier || '', receivedAt: b.receivedAt || '', landedCost: cost, currency: b.currency || 'EUR', knownUnits: b.knownUnits == null ? null : b.knownUnits, revisions: [{ at: b.at || '', cost }] });
  return { state: n, id };
}
/** Révise le coût d'un ballot : l'historique est gardé et les résultats sont recalculés. */
export function setBallotCost(s, id, cost, at) { const n = cl(s), b = n.ballots.find(x => x.id === id); if (!b) return s; b.landedCost = Math.max(0, toMinor(cost) || 0); b.revisions.push({ at: at || '', cost: b.landedCost }); return n; }
export function setSessionMode(s, sessionId, mode) { const n = cl(s), x = n.sessions.find(q => q.id === sessionId); if (x) x.mode = mode; return recompute(n); }
export function addLink(s, link) {
  const n = cl(s); n.links = n.links.filter(l => !(l.accountId === link.accountId && l.extVariantId === link.extVariantId));
  n.links.push(Object.assign({ source: 'manual', verifiedAt: '' }, link)); return recompute(n);
}
/** Correction manuelle du stock : un mouvement daté, jamais un écrasement silencieux. */
export function adjustStock(s, id, delta, reason) {
  const n = cl(s), v = n.variants[id]; if (!v) return s; v.onHand += delta;
  n.movements.push({ lineKey: null, variantId: id, deltaOnHand: delta, deltaReserved: 0, reason: reason || 'correction', causationKey: 'adj#' + n.movements.length }); stockGaps(n); return n;
}
export function addVariant(s, v) { const n = cl(s); n.variants[v.id] = Object.assign({ label: v.id, onHand: 0, reserved: 0, unique: false, ballot: null }, v); return n; }

/* ---------- attribution : le live, puis la cible, puis le ballot ---------- */
/** { sessionId, liveStatus, target:{kind,id}|null, ballotId, status:'ok'|'ambiguous'|'to_match', reason } pour une ligne. */
export function attribute(s, line) {
  const out = { sessionId: null, liveStatus: line.source, target: null, ballotId: null, status: 'ok', reason: '' };
  if (line.source === 'live') { const x = s.sessions.find(q => q.accountId === line.accountId && q.extLiveId === line.externalLiveId); if (x) out.sessionId = x.id; }
  const subj = [line.listingId, line.variantId, line.merchantSku].filter(Boolean);
  const bySku = line.merchantSku ? s.links.filter(l => l.accountId === line.accountId && l.merchantSku === line.merchantSku) : [];
  const link = s.links.find(l => l.accountId === line.accountId && l.extVariantId && l.extVariantId === line.variantId) || (bySku.length === 1 ? bySku[0] : null);
  if (link) { out.target = { kind: link.kind, id: link.targetId }; const v = s.variants[link.targetId]; if (v && v.ballot) out.ballotId = v.ballot; }
  if (out.sessionId && !out.ballotId) {
    const rs = s.rules.filter(r => r.sessionId === out.sessionId && !r.isDefault && subj.includes(r.subjectId)), ids = [...new Set(rs.map(r => r.ballotId))];
    if (ids.length === 1) out.ballotId = ids[0]; else if (ids.length > 1) { out.status = 'ambiguous'; out.reason = 'regles_concurrentes'; }
    const ses = s.sessions.find(q => q.id === out.sessionId), def = s.rules.find(r => r.sessionId === out.sessionId && r.isDefault);
    if (!out.target && !out.ballotId && out.status === 'ok' && ses && ses.mode === 'exclusive_ballot' && def) out.ballotId = def.ballotId;   /* le défaut ne vaut que pour une ligne non classée */
  }
  const ov = [...s.overrides].reverse().find(o => o.lineKey === lineKey(line));
  if (ov) { if (ov.newTarget && ov.newTarget.ballotId !== undefined) { out.ballotId = ov.newTarget.ballotId; out.status = 'ok'; out.reason = 'correction'; } if (ov.newTarget && ov.newTarget.target) { out.target = ov.newTarget.target; out.status = 'ok'; } }
  if (out.status === 'ok' && !out.target && !out.ballotId) { out.status = 'to_match'; out.reason = line.source === 'non_live' ? 'hors_live_sans_cible' : 'cible_inconnue'; }
  return out;
}

/* ---------- stock : effet cible moins effet déjà compté ---------- */
const zero = () => ({ onHand: 0, reserved: 0 });
/** Effet voulu d'une ligne sur le stock : en attente → réservé ; confirmée → retiré du physique ; annulée → réservation libérée, physique rendu seulement si la plateforme le dit. */
function desiredEffect(line, prev) {
  if (line.status === 'pending') return { onHand: 0, reserved: line.quantity };
  if (line.status === 'confirmed') return { onHand: -line.quantity, reserved: 0 };
  if (line.status === 'cancelled') return { onHand: line.restock ? 0 : prev.onHand, reserved: 0 };
  return { onHand: prev.onHand, reserved: prev.reserved };   /* statut inconnu : aucun nouvel effet */
}
function move(n, key, kind, id, d, reason) {
  if (!d.onHand && !d.reserved) return; const v = n.variants[id]; if (!v) return;
  v.onHand += d.onHand; v.reserved += d.reserved;
  n.movements.push({ lineKey: key, variantId: id, deltaOnHand: d.onHand, deltaReserved: d.reserved, reason, causationKey: key + '#' + n.movements.length });
}
function applyStock(n, line, att) {
  const key = lineKey(line), prev = n.effects[key] || Object.assign(zero(), { kind: null, id: null }), tgt = att.target && n.variants[att.target.id] ? att.target : null;
  /* la liaison a changé : on inverse l'ancien effet, puis on applique le nouveau (en une seule fois) */
  if (prev.id && (!tgt || tgt.id !== prev.id)) { move(n, key, prev.kind, prev.id, { onHand: -prev.onHand, reserved: -prev.reserved }, 'reliaison'); n.effects[key] = { kind: null, id: null, onHand: 0, reserved: 0 }; }
  if (!tgt) return;
  const cur = n.effects[key] && n.effects[key].id === tgt.id ? n.effects[key] : { kind: tgt.kind, id: tgt.id, onHand: 0, reserved: 0 }, want = desiredEffect(line, cur);
  move(n, key, tgt.kind, tgt.id, { onHand: want.onHand - cur.onHand, reserved: want.reserved - cur.reserved }, line.status);
  n.effects[key] = { kind: tgt.kind, id: tgt.id, onHand: want.onHand, reserved: want.reserved };
}
/** Vente impossible : le fait de vente est gardé, un écart de stock est ouvert (le solde théorique peut être négatif). */
function stockGaps(n) {
  n.anomalies = n.anomalies.filter(a => a.type !== 'stock_gap');
  Object.entries(n.variants).forEach(([id, v]) => { if (v.onHand < 0) n.anomalies.push({ type: 'stock_gap', variantId: id, missing: -v.onHand }); });
}

/* ---------- ingestion : rejouable, résiste au désordre ---------- */
function ensureSession(n, line) {
  if (line.source !== 'live') return;
  if (!n.sessions.some(q => q.accountId === line.accountId && q.extLiveId === line.externalLiveId)) n.sessions.push({ id: nid(n, 's'), accountId: line.accountId, extLiveId: line.externalLiveId, title: '', startsAt: line.soldAt || '', endsAt: '', state: 'unknown', mode: 'normal' });
}
/** Applique des lignes canoniques. Une ligne plus ancienne que celle déjà connue est ignorée ; deux envois identiques donnent le même état. */
export function ingestLines(s, lines) {
  const n = cl(s);
  lines.forEach(line => {
    const key = lineKey(line), old = n.lines[key];
    if (old && old.providerUpdatedAt && line.providerUpdatedAt && line.providerUpdatedAt < old.providerUpdatedAt) return;
    ensureSession(n, line);
    n.lines[key] = Object.assign({}, old || {}, line);
  });
  return recompute(n);
}
/** Recalcule l'attribution et les effets de stock de toutes les lignes (après une règle, une liaison, un rejeu). */
export function recompute(s) {
  const n = cl(s);
  Object.values(n.lines).forEach(line => { const att = attribute(n, line); line.att = att; applyStock(n, line, att); });
  stockGaps(n); return n;
}
/** Correction explicite d'une ligne, avec historique ; les résultats sont recalculés sans dupliquer les recettes. */
export function overrideLine(s, key, newTarget, actor, reason, at) {
  const n = cl(s), line = n.lines[key]; if (!line) return s;
  n.overrides.push({ lineKey: key, oldTarget: line.att ? { ballotId: line.att.ballotId, target: line.att.target } : null, newTarget, actor: actor || '', reason: reason || '', createdAt: at || '' });
  return recompute(n);
}

/* ---------- finance : brut, provisoire, comptabilisé — jamais additionnés ---------- */
/** entrée = { key, orderId, lineId?, sessionId?, type:'sale'|'fee'|'refund'|'adjustment', amount (signé, centimes), stage:'provisional'|'settled' } ; importer deux fois la même clé ne change rien. */
export function ingestEntries(s, entries) {
  const n = cl(s); entries.forEach(e => { n.entries[e.accountId + '|' + e.key] = Object.assign({}, e, { amount: toMinor(e.amount) }); }); return n;
}
/** Net d'une commande : le comptabilisé remplace l'estimation, qui n'est jamais ajoutée. null = frais inconnus (brut seulement). */
export function orderNet(s, accountId, orderId) {
  const E = Object.values(s.entries).filter(e => e.accountId === accountId && e.orderId === orderId); if (!E.length) return null;
  const settled = E.filter(e => e.stage === 'settled');
  return settled.length ? { net: sumMinor(settled.map(e => e.amount)), stage: 'settled' } : { net: sumMinor(E.map(e => e.amount)), stage: 'provisional' };
}
const orderLines = (s, accountId, orderId) => Object.values(s.lines).filter(l => l.accountId === accountId && l.orderId === orderId);
/** Lignes comptées (confirmées) d'une cible donnée, avec leur net : au niveau de la ligne si la plateforme le donne, sinon de la commande quand toutes ses lignes ont la même cible. */
function targetRows(s, pick) {
  const rows = [];
  Object.values(s.lines).forEach(l => {
    if (!l.att || l.att.status !== 'ok' || !pick(l)) return; if (l.status === 'cancelled') return;
    const own = Object.values(s.entries).filter(e => e.accountId === l.accountId && e.orderId === l.orderId && e.lineId === l.lineId);
    let net = null, stage = null, spread = false;
    if (own.length) { const st = own.filter(e => e.stage === 'settled'); stage = st.length ? 'settled' : 'provisional'; net = sumMinor((st.length ? st : own).map(e => e.amount)); }
    else { const on = orderNet(s, l.accountId, l.orderId); if (on) { const sib = orderLines(s, l.accountId, l.orderId), same = sib.every(q => q.att && pick(q) && q.status !== 'cancelled'); if (same && sib[0] === l) { net = on.net; stage = on.stage; } else if (same) { net = 0; stage = on.stage; } else spread = true; } }
    rows.push({ line: l, gross: l.status === 'confirmed' || l.status === 'pending' ? l.gross : null, net, stage, notSpread: spread });
  });
  return rows;
}
const sumRows = rows => {
  const g = rows.filter(r => r.gross != null), n = rows.filter(r => r.net != null), st = new Set(n.map(r => r.stage));
  return { gross: g.length ? sumMinor(g.map(r => r.gross)) : null, net: n.length ? sumMinor(n.map(r => r.net)) : null, stage: !n.length ? null : st.size > 1 ? 'mixed' : [...st][0], items: rows.reduce((a, r) => a + r.line.quantity, 0), notSpread: rows.filter(r => r.notSpread).length };
};
/** reste_a_recuperer = max(0, coût livré − net attribué) ; ecart_vs_cout = net attribué − coût livré. */
export function ballotResult(s, ballotId) {
  const b = s.ballots.find(x => x.id === ballotId); if (!b) return null;
  const T = sumRows(targetRows(s, l => l.att.ballotId === ballotId)), net = T.net, outside = Object.values(s.lines).filter(l => l.att && l.att.status === 'ambiguous').length;
  return { ballotId, label: b.label, cost: b.landedCost, currency: b.currency, gross: T.gross, net, stage: T.stage, provisional: T.stage === 'provisional' || T.stage === 'mixed', items: T.items,
    reste: net == null ? null : Math.max(0, b.landedCost - net), ecart: net == null ? null : net - b.landedCost, notSpread: T.notSpread, ambiguous: outside,
    sessions: [...new Set(Object.values(s.lines).filter(l => l.att && l.att.ballotId === ballotId && l.att.sessionId).map(l => l.att.sessionId))] };
}
/** Bilan d'un live : seules les lignes qui portent son identifiant comptent ; les ventes hors live n'y sont pas. */
export function sessionSummary(s, sessionId) {
  const L = Object.values(s.lines).filter(l => l.att && l.att.sessionId === sessionId), live = L.filter(l => l.status !== 'cancelled');
  const T = sumRows(targetRows(s, l => l.att.sessionId === sessionId));
  return { sessionId, orders: new Set(L.map(l => l.accountId + l.orderId)).size, items: T.items, gross: T.gross, net: T.net, stage: T.stage, cancelled: L.filter(l => l.status === 'cancelled').length, toMatch: L.filter(l => l.att.status !== 'ok').length, lines: L.length, liveLines: live.length };
}
/** Ventes hors live d'une pièce explicitement issue d'un ballot : comptées pour le ballot dans une rubrique à part. */
export function offLiveForBallot(s, ballotId) { return sumRows(targetRows(s, l => l.att.ballotId === ballotId && l.att.sessionId == null)); }

/* ---------- à rapprocher ---------- */
export function toMatch(s) {
  const out = [];
  Object.entries(s.lines).forEach(([key, l]) => {
    if (!l.att) return;
    if (l.att.status === 'to_match') out.push({ type: l.att.reason === 'hors_live_sans_cible' ? 'hors_live' : (l.variantId || l.merchantSku ? 'sku_inconnu' : 'cible_inconnue'), lineKey: key, line: l });
    else if (l.att.status === 'ambiguous') out.push({ type: 'ambigu', lineKey: key, line: l });
    else if (l.att.sessionId && l.att.target && !l.att.ballotId && s.sessions.find(q => q.id === l.att.sessionId).mode === 'exclusive_ballot') out.push({ type: 'sans_ballot', lineKey: key, line: l });
  });
  /* frais enregistrés au niveau de la commande alors que ses lignes vont vers des cibles différentes : non ventilés */
  const seen = new Set();
  Object.entries(s.lines).forEach(([key, l]) => {
    const oid = l.accountId + '|' + l.orderId; if (seen.has(oid) || !l.att) return; seen.add(oid);
    const sib = orderLines(s, l.accountId, l.orderId).filter(q => q.att && q.att.status === 'ok' && q.status !== 'cancelled'), sig = new Set(sib.map(q => (q.att.ballotId || '') + '|' + (q.att.target ? q.att.target.id : '')));
    const hasOrderLevel = Object.values(s.entries).some(e => e.accountId === l.accountId && e.orderId === l.orderId && !e.lineId), hasLineLevel = Object.values(s.entries).some(e => e.accountId === l.accountId && e.orderId === l.orderId && e.lineId);
    if (hasOrderLevel && !hasLineLevel && sig.size > 1) out.push({ type: 'frais_non_ventiles', lineKey: key, line: l });
  });
  s.anomalies.forEach(a => out.push(Object.assign({ type: a.type }, a)));
  s.accounts.filter(a => a.status === 'reconnect').forEach(a => out.push({ type: 'acces_perdu', accountId: a.id }));
  return out;
}

/* ---------- compte : ce qui est documenté, autorisé ou vérifié, capacité par capacité ---------- */
export const CAPS = ['orders', 'lives', 'finance', 'inventory_write'];
export function capLevel(account, cap) { return (account.caps && account.caps[cap]) || 'documented'; }
/** « Sync stock active » n'apparaît que si l'écriture est vérifiée ; avec la seule lecture, le stock reste interne à Max. */
export const stockSyncActive = account => capLevel(account, 'inventory_write') === 'verified';
/** Cloisonnement par tenant : un espace ne voit que ses comptes et ce qui s'y rattache. */
export function forTenant(s, tenant) {
  const ids = new Set(s.accounts.filter(a => a.tenant === tenant).map(a => a.id)), n = emptyState();
  n.accounts = s.accounts.filter(a => ids.has(a.id)); n.sessions = s.sessions.filter(x => ids.has(x.accountId)); n.links = s.links.filter(x => ids.has(x.accountId));
  Object.entries(s.lines).forEach(([k, l]) => { if (ids.has(l.accountId)) n.lines[k] = l; }); Object.entries(s.entries).forEach(([k, e]) => { if (ids.has(e.accountId)) n.entries[k] = e; });
  const sess = new Set(n.sessions.map(x => x.id)); n.rules = s.rules.filter(r => sess.has(r.sessionId)); const bal = new Set(n.rules.map(r => r.ballotId)); n.ballots = s.ballots.filter(b => bal.has(b.id) || b.tenant === tenant);
  return n;
}
