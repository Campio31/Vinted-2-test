/* ---------- Live connecté : import d'un export de commandes (CSV) ----------
   Lit un export de commandes TikTok Shop (ou tout CSV de même forme), reconnaît les colonnes françaises et anglaises, et nourrit le moteur (live-core.js).
   Pur : pas d'écran, pas de réseau. Réimporter le même fichier ne change rien (lignes identifiées par commande + référence). */
import { ingestLines, normalizeLine, toMinor } from './live-core.js';

export const IMPORT_ACCOUNT = 'tiktok-import';

/** Texte CSV → tableau de lignes. Gère BOM, guillemets, retours à la ligne dans une cellule, séparateur « ; » « , » tabulation. */
export function parseCSV(text) {
  let s = String(text == null ? '' : text).replace(/^﻿/, '');
  const first = s.split(/\r?\n/, 1)[0] || '';
  const cnt = c => (first.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length;
  const d = [';', '\t', ','].reduce((b, c) => (cnt(c) > cnt(b) ? c : b), ',');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

const norm = h => String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/* alias normalisés (sans accents ni ponctuation) ; le premier trouvé gagne */
const ALIAS = {
  order: ['order id', 'order number', 'id de commande', 'id commande', 'numero de commande', 'n de commande', 'commande'],
  sku: ['seller sku', 'sku vendeur', 'sku du vendeur', 'reference vendeur', 'reference', 'sku'],
  skuId: ['sku id', 'id sku', 'id de sku', 'variation id', 'id de variation'],
  product: ['product name', 'nom du produit', 'produit', 'nom de l article', 'article', 'titre'],
  variation: ['variation', 'variante', 'sku name', 'nom du sku'],
  qty: ['quantity', 'quantite', 'qte', 'qty'],
  status: ['order status', 'statut de la commande', 'statut commande', 'statut', 'status'],
  subtotal: ['sku subtotal after discount', 'sous total apres remise', 'sous total du sku apres remise', 'sku subtotal before discount', 'sous total du sku', 'sous total', 'subtotal', 'order amount', 'montant de la commande', 'total'],
  unit: ['sku unit original price', 'prix unitaire', 'prix du sku', 'unit price', 'prix'],
  date: ['created time', 'date de creation', 'heure de creation', 'date de commande', 'order date', 'paid time', 'date de paiement', 'date'],
  live: ['live id', 'id du live', 'id de live', 'live', 'live session', 'session live'],
};
/** Associe chaque champ à l'index de sa colonne. */
export function mapColumns(headers) {
  const H = headers.map(norm), out = {};
  Object.entries(ALIAS).forEach(([f, list]) => { for (const a of list) { const i = H.indexOf(a); if (i >= 0) { out[f] = i; break; } } });
  return out;
}

/* statuts affichés (français / anglais) → codes TikTok connus du moteur ; le premier motif trouvé gagne */
const STATUS = [[/annul|cancel/, 'CANCELLED'], [/en attente de paiement|unpaid|a payer/, 'UNPAID'], [/awaiting shipment|attente d expedition|a expedier/, 'AWAITING_SHIPMENT'], [/awaiting collection|attente de collecte|a collecter/, 'AWAITING_COLLECTION'], [/en attente|on hold|retenu/, 'ON_HOLD'],
  [/partiellement|partially/, 'PARTIALLY_SHIPPING'], [/in transit|en transit|en cours de livraison|expedi|shipped/, 'IN_TRANSIT'], [/deliver|livre/, 'DELIVERED'], [/complet|termin|finalis/, 'COMPLETED']];
export function statusCode(raw) { const k = norm(raw); if (!k) return ''; for (const [re, c] of STATUS) if (re.test(k)) return c; return String(raw).trim(); }

/** « 12,34 € », « EUR 1 234,50 », « €12.34 » → centimes ; null si illisible. */
export function amountMinor(txt) {
  let t = String(txt == null ? '' : txt).replace(/[\s  ]/g, '').replace(/[^\d,.\-]/g, ''); if (!t) return null;
  const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (lc >= 0) t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
  else if (ld >= 0 && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  return toMinor(t);
}
/** « 12/11/2026 19:44:03 » ou « 2026-11-12 19:44 » → « 2026-11-12T19:44:03 » ; chaîne vide si illisible. */
export function dateIso(txt) {
  const t = String(txt == null ? '' : txt).trim(), p = n => String(n).padStart(2, '0');
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/); if (m) return `${m[1]}-${m[2]}-${m[3]}T${p(m[4] || 0)}:${m[5] || '00'}:${m[6] || '00'}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/); if (m) return `${m[3]}-${p(m[2])}-${p(m[1])}T${p(m[4] || 0)}:${m[5] || '00'}:${m[6] || '00'}`;
  return '';
}
const slug = s => norm(s).replace(/ /g, '-').slice(0, 40) || 'live';

/** Lit le texte d'un export et renvoie les lignes brutes + un rapport (rien n'est écrit dans l'état). opts.live : 'one' (tout le fichier = un live) | 'none' (hors live) ; opts.liveTitle. */
export function readExport(text, opts) {
  const o = Object.assign({ live: 'none', liveTitle: '' }, opts), rows = parseCSV(text), rep = { rows: 0, lines: 0, skipped: [], unknownStatus: [], noAmount: 0, lives: [], error: null, headers: [] };
  if (rows.length < 2) { rep.error = 'fichier_vide'; return { raws: [], report: rep }; }
  rep.headers = rows[0].map(x => x.trim()); const C = mapColumns(rows[0]);
  if (C.order == null || (C.sku == null && C.skuId == null && C.product == null)) { rep.error = 'colonnes_introuvables'; return { raws: [], report: rep }; }
  const cell = (r, f) => (C[f] == null ? '' : String(r[C[f]] == null ? '' : r[C[f]]).trim()), seen = {}, raws = [], liveId = o.live === 'one' ? 'csv-' + slug(o.liveTitle) : null, lives = new Set(), unk = new Set();
  rows.slice(1).forEach((r, i) => {
    rep.rows++; const order = cell(r, 'order'); if (!order) { rep.skipped.push({ row: i + 2, reason: 'sans_numero_de_commande' }); return; }
    const sku = cell(r, 'sku'), skuId = cell(r, 'skuId'), name = [cell(r, 'product'), cell(r, 'variation')].filter(Boolean).join(' · '), ref = sku || skuId || name;
    if (!ref) { rep.skipped.push({ row: i + 2, reason: 'sans_reference' }); return; }
    const k = order + '|' + ref; seen[k] = (seen[k] || 0) + 1;                      /* même référence deux fois dans une commande : numérotée dans l'ordre du fichier */
    const qty = Math.max(1, parseInt(cell(r, 'qty'), 10) || 1), st = statusCode(cell(r, 'status'));
    let gross = null; if (C.subtotal != null) gross = amountMinor(cell(r, 'subtotal')); if (gross == null && C.unit != null) { const u = amountMinor(cell(r, 'unit')); gross = u == null ? null : u * qty; }
    if (gross == null) rep.noAmount++;
    const fileLive = cell(r, 'live'), lid = fileLive || liveId, upd = dateIso(cell(r, 'date'));
    if (lid) lives.add(lid);
    const code = st && /^[A-Z_]+$/.test(st) ? st : '';
    if (!code) unk.add(st || '(vide)');
    const raw = { orderId: order, lineId: ref + (seen[k] > 1 ? '#' + seen[k] : ''), variantId: skuId || sku || null, merchantSku: sku || null, quantity: qty, status: code || st, gross: gross == null ? null : gross, updatedAt: upd || null, soldAt: upd ? upd.slice(0, 10) : '', productName: name };
    if (lid) raw.liveId = lid; else raw.live = false;
    raws.push(raw);
  });
  rep.lines = raws.length; rep.lives = [...lives]; rep.unknownStatus = [...unk];
  return { raws, report: rep };
}

/** Importe un export dans l'état Live : crée (ou réutilise) le compte « import de fichier », ajoute les lignes, titre le live. Renvoie { state, report }. */
export function importExport(s0, text, opts) {
  const o = Object.assign({ live: 'none', liveTitle: '', now: '' }, opts), { raws, report } = readExport(text, o);
  if (report.error || !raws.length) { if (!report.error) report.error = 'aucune_ligne'; return { state: s0, report }; }
  let s = JSON.parse(JSON.stringify(s0));
  if (!s.accounts.some(a => a.id === IMPORT_ACCOUNT)) s.accounts.push({ id: IMPORT_ACCOUNT, provider: 'tiktok_shop', shop: 'TikTok Shop (import de fichier)', market: 'FR', status: 'connected', manual: true, tenant: 'local', scopes: [], lastSync: '', caps: { orders: 'documented', lives: 'documented', finance: 'documented', inventory_write: 'documented' } });
  s.accounts.find(a => a.id === IMPORT_ACCOUNT).lastSync = o.now || raws.reduce((m, r) => (r.updatedAt && r.updatedAt > m ? r.updatedAt : m), '');
  s = ingestLines(s, raws.map(r => normalizeLine('tiktok_shop', IMPORT_ACCOUNT, r)));
  if (o.live === 'one' && o.liveTitle) s.sessions.forEach(x => { if (x.accountId === IMPORT_ACCOUNT && x.extLiveId === 'csv-' + slug(o.liveTitle) && !x.title) x.title = o.liveTitle; });
  return { state: s, report };
}
