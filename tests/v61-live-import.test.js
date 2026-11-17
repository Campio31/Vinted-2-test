import { describe, it, expect } from 'vitest';
import { amountMinor, dateIso, importExport, importFile, importRows, mapColumns, parseCSV, readExport, statusCode, IMPORT_ACCOUNT } from '../src/modules/live-import.js';
import { emptyState, ballotResult, sessionSummary, toMatch } from '../src/modules/live-core.js';

const FR = 'ID de commande;Statut de la commande;SKU vendeur;Nom du produit;Variation;Quantité;Sous-total du SKU après remise;Date de création\n'
  + '5781;En attente d\'expédition;TEE-M-NOIR;T-shirt;Noir M;2;24,00 €;10/11/2026 20:12:00\n'
  + '5782;Terminée;VESTE-1;"Veste ""cuir"", rare";;1;58,00 €;10/11/2026 20:20:00\n'
  + '5783;Annulée;TEE-L-NOIR;T-shirt;Noir L;1;12,00 €;10/11/2026 20:31:00\n';

describe('import CSV Live', () => {
  it('lit le séparateur, les guillemets et les colonnes françaises', () => {
    const r = parseCSV(FR); expect(r.length).toBe(4); expect(r[2][3]).toBe('Veste "cuir", rare');
    const c = mapColumns(r[0]); expect(c.order).toBe(0); expect(c.sku).toBe(2); expect(c.subtotal).toBe(6); expect(c.date).toBe(7);
  });
  it('montants, dates, statuts', () => {
    expect(amountMinor('12,34 €')).toBe(1234); expect(amountMinor('EUR 1 234,50')).toBe(123450); expect(amountMinor('€12.34')).toBe(1234); expect(amountMinor('1,234.50')).toBe(123450); expect(amountMinor('')).toBe(null);
    expect(dateIso('12/11/2026 19:44:03')).toBe('2026-11-12T19:44:03'); expect(dateIso('2026-11-12 19:44')).toBe('2026-11-12T19:44:00'); expect(dateIso('n/a')).toBe('');
    expect(statusCode('En attente d\'expédition')).toBe('AWAITING_SHIPMENT'); expect(statusCode('Annulée')).toBe('CANCELLED'); expect(statusCode('Completed')).toBe('COMPLETED'); expect(statusCode('Livrée')).toBe('DELIVERED');
  });
  it('un fichier sans les colonnes utiles est refusé sans rien écrire', () => {
    const s = emptyState(), r = importExport(s, 'a;b\n1;2\n', { live: 'none' }); expect(r.report.error).toBe('colonnes_introuvables'); expect(r.state).toBe(s);
    expect(importExport(s, '', {}).report.error).toBe('fichier_vide');
  });
  it('importe un live : lignes, statuts, titre, centimes', () => {
    const r = importExport(emptyState(), FR, { live: 'one', liveTitle: 'Live du 10 novembre', now: '2026-11-11T00:00:00Z' }), s = r.state;
    expect(r.report.lines).toBe(3); expect(r.report.unknownStatus).toEqual([]); expect(s.accounts[0].id).toBe(IMPORT_ACCOUNT); expect(s.accounts[0].manual).toBe(true);
    expect(s.sessions.length).toBe(1); expect(s.sessions[0].title).toBe('Live du 10 novembre');
    const L = Object.values(s.lines); expect(L.map(l => l.status).sort()).toEqual(['cancelled', 'confirmed', 'confirmed']); expect(L.find(l => l.merchantSku === 'TEE-M-NOIR').gross).toBe(2400); expect(L.find(l => l.merchantSku === 'TEE-M-NOIR').quantity).toBe(2);
    expect(sessionSummary(s, s.sessions[0].id)).toBeTruthy();
  });
  it('réimporter le même fichier ne change rien', () => {
    const a = importExport(emptyState(), FR, { live: 'one', liveTitle: 'L', now: 'x' }).state, b = importExport(a, FR, { live: 'one', liveTitle: 'L', now: 'x' }).state;
    expect(b).toEqual(a); expect(Object.keys(b.lines).length).toBe(3);
  });
  it('un export plus récent met à jour le statut', () => {
    const a = importExport(emptyState(), FR, { live: 'none' }).state, b = importExport(a, FR.replace('En attente d\'expédition', 'Livrée'), { live: 'none' }).state;
    expect(Object.values(a.lines).find(l => l.merchantSku === 'TEE-M-NOIR').rawStatus).toBe('AWAITING_SHIPMENT'); expect(Object.values(b.lines).find(l => l.merchantSku === 'TEE-M-NOIR').rawStatus).toBe('DELIVERED');
  });
  it('hors live : aucune session créée ; statut inconnu signalé ; deux fois la même référence dans une commande', () => {
    const csv = 'Order ID,Order Status,Seller SKU,Quantity,Unit Price\n9,Bizarre,A1,1,5.50\n9,Bizarre,A1,2,5.50\n10,,,1,3\n';
    const r = importExport(emptyState(), csv, { live: 'none' }); expect(r.state.sessions.length).toBe(0); expect(r.report.lines).toBe(2); expect(r.report.skipped.length).toBe(1); expect(r.report.unknownStatus).toEqual(['Bizarre']);
    const L = Object.values(r.state.lines); expect(L.length).toBe(2); expect(L.map(l => l.gross).sort((a, b) => a - b)).toEqual([550, 1100]);
  });
  it('une colonne Live du fichier prime', () => {
    const { raws, report } = readExport('Order ID;SKU;Live\n1;A;L-1\n2;B;L-2\n3;C;\n', { live: 'one', liveTitle: 'Défaut' }); expect(report.lives.sort()).toEqual(['L-1', 'L-2', 'csv-defaut']); expect(raws[0].liveId).toBe('L-1');
  });
  it('le ballot exclusif utilise les ventes importées', async () => {
    const { addBallot, setSessionMode, addRule } = await import('../src/modules/live-core.js');
    let s = importExport(emptyState(), FR, { live: 'one', liveTitle: 'Live', now: '' }).state; const b = addBallot(s, { label: 'B', landedCost: '100,00' }); s = b.state; const q = s.sessions[0].id;
    s = setSessionMode(s, q, 'exclusive_ballot'); s = addRule(s, { sessionId: q, ballotId: b.id, isDefault: true }).state; const res = ballotResult(s, b.id);
    expect(res).toBeTruthy(); expect(JSON.stringify(res)).toContain('8200');
  });
});

/* classeur .xlsx minimal, entrées « stockées » (sans compression) */
const zipStored = files => {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  Object.entries(files).forEach(([name, txt]) => {
    const nb = enc.encode(name), data = enc.encode(txt), lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(lh.buffer), nb, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
    cd.push(new Uint8Array(ch.buffer), nb); off += 30 + nb.length + data.length;
  });
  const cdSize = cd.reduce((a, x) => a + x.length, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  const all = [...parts, ...cd, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((a, x) => a + x.length, 0)); let p = 0; all.forEach(x => { out.set(x, p); p += x.length; }); return out;
};
const SST = ['2026-11-16 ~ 2026-11-17', 'Room ID', 'Room Title', 'Start Time', 'End Time', 'Duration', 'Attributed GMV', 'Attributed items sold', 'Attributed orders', 'Customers', 'Views', 'New followers', '77', 'Prix de départ 1€ & co', '2026-11-16 17:56:58', '2026-11-16 18:28:42', '0h31m', '46.36 €', '10', '4', '2294', '12'];
const cellS = (r, i) => `<c r="${r}" t="s"><v>${i}</v></c>`;
const XLSX = zipStored({
  'xl/sharedStrings.xml': '<sst>' + SST.map(s => `<si><t>${s.replace(/&/g, '&amp;')}</t></si>`).join('') + '</sst>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1">' + cellS('A1', 0) + '</row><row r="2"></row><row r="3">' + ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((c, i) => cellS(c + '3', i + 1)).join('') + '</row><row r="4">' + [12, 13, 14, 15, 16, 17, 18, 18, 19, 20, 21].map((v, i) => cellS('ABCDEFGHIJKL'[i] + '4', v)).join('') + '</row></sheetData></worksheet>',
});

describe('rapport « performance des lives » (Excel)', () => {
  it('lit un .xlsx : un live, son total brut, ses statistiques, aucune ligne à rapprocher', async () => {
    const r = await importFile(emptyState(), XLSX, {}), s = r.state;
    expect(r.report.error).toBe(null); expect(r.report.kind).toBe('summary'); expect(r.report.lines).toBe(1);
    expect(s.sessions[0].title).toBe('Prix de départ 1€ & co'); expect(s.sessions[0].stats.gmv).toBe(4636); expect(s.sessions[0].stats.customers).toBe(4); expect(s.sessions[0].stats.views).toBe(2294);
    const sm = sessionSummary(s, s.sessions[0].id); expect(sm.gross).toBe(4636); expect(sm.items).toBe(10); expect(toMatch(s).length).toBe(0); expect(Object.keys(s.variants).length).toBe(0);
  });
  it('réimporter le même rapport ne change rien ; un fichier non Excel et non CSV valide est refusé proprement', async () => {
    const a = (await importFile(emptyState(), XLSX, {})).state, b = (await importFile(a, XLSX, {})).state; expect(b).toEqual(a);
    const bad = await importFile(emptyState(), new Uint8Array([0x50, 0x4B, 1, 2, 3]), {}); expect(bad.report.error).toBe('excel_illisible');
  });
  it('le ballot exclusif reçoit le total du live importé', async () => {
    const { addBallot, setSessionMode, addRule } = await import('../src/modules/live-core.js');
    let s = (await importFile(emptyState(), XLSX, {})).state; const b = addBallot(s, { label: 'B', landedCost: '100,00' }); s = b.state; const q = s.sessions[0].id;
    s = setSessionMode(s, q, 'exclusive_ballot'); s = addRule(s, { sessionId: q, ballotId: b.id, isDefault: true }).state; const res = ballotResult(s, b.id);
    expect(res.gross).toBe(4636); expect(res.items).toBe(10);
  });
  it('un live sans vente garde sa fiche mais pas de ligne', () => {
    const r = importRows(emptyState(), [['Room ID', 'Room Title', 'Attributed GMV', 'Attributed items sold'], ['9', 'Live vide', '0,00 €', '0']], {});
    expect(r.state.sessions.length).toBe(1); expect(Object.keys(r.state.lines).length).toBe(0); expect(r.report.skipped.length).toBe(1);
  });
});
