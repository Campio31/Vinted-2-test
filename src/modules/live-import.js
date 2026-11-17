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
  /* rapport « performance des lives » (une ligne par live, sans le détail des articles) */
  room: ['room id', 'id de la salle', 'id du direct'],
  rtitle: ['room title', 'titre du live', 'titre de la salle', 'titre du direct'],
  rstart: ['start time', 'heure de debut', 'debut'],
  rend: ['end time', 'heure de fin', 'fin'],
  rdur: ['duration', 'duree'],
  gmv: ['attributed gmv', 'gmv attribue', 'gmv'],
  items: ['attributed items sold', 'articles vendus attribues', 'articles vendus'],
  rorders: ['attributed orders', 'commandes attribuees'],
  customers: ['customers', 'clients', 'acheteurs'],
  views: ['views', 'vues'],
  followers: ['new followers', 'nouveaux abonnes'],
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
export const readExport = (text, opts) => readRows(parseCSV(text), opts);

/** Trouve la ligne d'en-têtes (parmi les 10 premières : un export peut commencer par un titre) et le type de fichier : « orders » ou « summary ». */
function findHeader(rows) {
  for (let h = 0; h < Math.min(10, rows.length - 1); h++) {
    const C = mapColumns(rows[h]);
    if (C.room != null && C.gmv != null) return { h, C, kind: 'summary' };
    if (C.order != null && (C.sku != null || C.skuId != null || C.product != null)) return { h, C, kind: 'orders' };
  }
  return null;
}
/** Rapport « performance des lives » : une ligne par live. Les ventes n'ont pas le détail des articles : on garde UNE ligne de synthèse par live (montant brut, nombre d'articles), sans effet sur le stock. */
function readSummary(rows, h, C) {
  const rep = { rows: 0, lines: 0, skipped: [], unknownStatus: [], noAmount: 0, lives: [], error: null, headers: rows[h].map(x => String(x).trim()), kind: 'summary' }, raws = [], stats = {};
  const cell = (r, f) => (C[f] == null ? '' : String(r[C[f]] == null ? '' : r[C[f]]).trim()), int = v => { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return isNaN(n) ? 0 : n; };
  rows.slice(h + 1).forEach((r, i) => {
    const id = cell(r, 'room'); if (!id) return; rep.rows++;
    const gmv = amountMinor(cell(r, 'gmv')), items = int(cell(r, 'items')), st = dateIso(cell(r, 'rstart'));
    stats[id] = { title: cell(r, 'rtitle'), startsAt: st, endsAt: dateIso(cell(r, 'rend')), duration: cell(r, 'rdur'), gmv: gmv || 0, items, orders: int(cell(r, 'rorders')), customers: int(cell(r, 'customers')), views: int(cell(r, 'views')), followers: int(cell(r, 'followers')) };
    rep.lives.push(id); if (gmv == null) { rep.noAmount++; return; }
    if (gmv <= 0 && items <= 0) { rep.skipped.push({ row: h + i + 2, reason: 'live_sans_vente' }); return; }
    raws.push({ orderId: 'resume-' + id, lineId: '1', liveId: id, quantity: Math.max(1, items), status: 'AWAITING_SHIPMENT', gross: gmv, updatedAt: st || null, soldAt: st ? st.slice(0, 10) : '', summary: true });
  });
  rep.lines = rep.lives.length; return { raws, report: rep, stats };
}
export function readRows(rows, opts) {
  const o = Object.assign({ live: 'none', liveTitle: '' }, opts), rep = { rows: 0, lines: 0, skipped: [], unknownStatus: [], noAmount: 0, lives: [], error: null, headers: [] };
  if (rows.length < 2) { rep.error = 'fichier_vide'; return { raws: [], report: rep }; }
  const F = findHeader(rows);
  if (!F) { rep.headers = rows[0].map(x => String(x).trim()); rep.error = 'colonnes_introuvables'; return { raws: [], report: rep }; }
  if (F.kind === 'summary') return readSummary(rows, F.h, F.C);
  rows = rows.slice(F.h); rep.headers = rows[0].map(x => String(x).trim()); const C = F.C;
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
export const importExport = (s0, text, opts) => importRows(s0, parseCSV(text), opts);
/** Fichier brut (octets) : un classeur Excel (.xlsx, reconnu à son en-tête « PK ») ou du texte CSV. */
export async function importFile(s0, bytes, opts) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u[0] === 0x50 && u[1] === 0x4B) { let rows; try { rows = await xlsxRows(u); } catch (e) { return { state: s0, report: { rows: 0, lines: 0, skipped: [], unknownStatus: [], noAmount: 0, lives: [], headers: [], error: 'excel_illisible' } }; } return importRows(s0, rows, opts); }
  return importExport(s0, new TextDecoder('utf-8').decode(u), opts);
}
export function importRows(s0, rows, opts) {
  const o = Object.assign({ live: 'none', liveTitle: '', now: '' }, opts), { raws, report, stats } = readRows(rows, o);
  if (report.error || (!raws.length && !(stats && Object.keys(stats).length))) { if (!report.error) report.error = 'aucune_ligne'; return { state: s0, report }; }
  let s = JSON.parse(JSON.stringify(s0));
  if (!s.accounts.some(a => a.id === IMPORT_ACCOUNT)) s.accounts.push({ id: IMPORT_ACCOUNT, provider: 'tiktok_shop', shop: 'TikTok Shop (import de fichier)', market: 'FR', status: 'connected', manual: true, tenant: 'local', scopes: [], lastSync: '', caps: { orders: 'documented', lives: 'documented', finance: 'documented', inventory_write: 'documented' } });
  s.accounts.find(a => a.id === IMPORT_ACCOUNT).lastSync = o.now || raws.reduce((m, r) => (r.updatedAt && r.updatedAt > m ? r.updatedAt : m), '');
  s = ingestLines(s, raws.map(r => normalizeLine('tiktok_shop', IMPORT_ACCOUNT, r)));
  if (stats) s.sessions.forEach(x => { const k = x.accountId === IMPORT_ACCOUNT && stats[x.extLiveId]; if (k) { x.title = k.title || x.title; x.startsAt = k.startsAt || x.startsAt; x.endsAt = k.endsAt || x.endsAt; x.state = 'ended'; x.stats = k; } });
  /* un live sans aucune vente n'a pas de ligne : on garde quand même sa fiche */
  if (stats) Object.entries(stats).forEach(([id, k]) => { if (!s.sessions.some(x => x.accountId === IMPORT_ACCOUNT && x.extLiveId === id)) s.sessions.push({ id: 's' + (s.seq++), accountId: IMPORT_ACCOUNT, extLiveId: id, title: k.title, startsAt: k.startsAt, endsAt: k.endsAt, state: 'ended', mode: 'normal', stats: k }); });
  if (o.live === 'one' && o.liveTitle) s.sessions.forEach(x => { if (x.accountId === IMPORT_ACCOUNT && x.extLiveId === 'csv-' + slug(o.liveTitle) && !x.title) x.title = o.liveTitle; });
  return { state: s, report };
}

/* ---------- classeur Excel (.xlsx) : lecture sans bibliothèque ---------- */
/* Un .xlsx est une archive zip. On lit l'annuaire central, on décompresse (deflate brut) la première feuille et les textes partagés. Aucune formule n'est évaluée. */
async function inflate(data) {
  const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(data); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
export async function unzip(u) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('zip');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {}, dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('zip');
    const meth = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true), name = dec.decode(u.subarray(p + 46, p + 46 + nl));
    const ln = dv.getUint16(lo + 26, true), lx = dv.getUint16(lo + 28, true), start = lo + 30 + ln + lx, raw = u.subarray(start, start + csize);
    out[name] = { meth, raw }; p += 46 + nl + xl + cl;
  }
  return out;
}
const unxml = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colIdx = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const texts = x => [...x.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => unxml(m[1])).join('');
/** Octets d'un .xlsx → tableau de lignes (première feuille), cellules en texte. */
export async function xlsxRows(u) {
  const z = await unzip(u), dec = new TextDecoder(), get = async n => { const f = z[n]; if (!f) return ''; return dec.decode(f.meth === 0 ? f.raw : await inflate(f.raw)); };
  const sheets = Object.keys(z).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1], 10) - parseInt(b.match(/(\d+)\.xml/)[1], 10));
  if (!sheets.length) throw new Error('feuille');
  const sst = [...(await get('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1])), xml = await get(sheets[0]), rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = cm[1], ref = (at.match(/\br="([A-Z]+\d+)"/) || [])[1], t = (at.match(/\bt="(\w+)"/) || [])[1], body = cm[2] || '', v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (!ref) continue; row[colIdx(ref)] = t === 's' ? (sst[+v] == null ? '' : sst[+v]) : t === 'inlineStr' ? texts(body) : v == null ? '' : unxml(v);
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
    if (row.some(x => String(x).trim() !== '')) rows.push(row);
  }
  return rows;
}
