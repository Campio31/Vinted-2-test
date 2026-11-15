import { describe, it, expect } from 'vitest';
import * as C from '../src/modules/live-core.js';
import { loadDemo, replayDemo, DEMO_ACCOUNT } from '../src/modules/live-demo.js';

const A = 'acc1';
const base = () => { let s = C.emptyState(); s.accounts.push({ id: A, provider: 'tiktok_shop', tenant: 't1', status: 'connected', caps: { orders: 'verified' } }); return s; };
const L = (o, p = 'tiktok_shop') => C.normalizeLine(p, A, Object.assign({ orderId: 'o1', lineId: '1', quantity: 1, status: 'AWAITING_SHIPMENT', gross: '10,00', updatedAt: '2026-11-10T10:00:00Z' }, o));
const stock = (s, id) => s.variants[id];

describe('argent et statuts', () => {
  it('les montants sont des centimes entiers, sans calcul flottant', () => {
    expect(C.toMinor('12,34')).toBe(1234); expect(C.toMinor('12.3')).toBe(1230); expect(C.toMinor('-3,10')).toBe(-310); expect(C.toMinor('abc')).toBeNull(); expect(C.toMinor('0.07')).toBe(7);
    expect(C.sumMinor([C.toMinor('0,10'), C.toMinor('0,20')])).toBe(30);
  });
  it('les statuts bruts sont traduits plateforme par plateforme, l\'inconnu reste inconnu', () => {
    expect(C.mapStatus('tiktok_shop', 'UNPAID')).toBe('pending'); expect(C.mapStatus('tiktok_shop', 'COMPLETED')).toBe('confirmed'); expect(C.mapStatus('tiktok_shop', 'CANCELLED')).toBe('cancelled');
    expect(C.mapStatus('whatnot', 'paid')).toBe('confirmed'); expect(C.mapStatus('whatnot', 'bizarre')).toBe('unknown'); expect(C.mapStatus('tiktok_shop', 'paid')).toBe('unknown');
  });
  it('un identifiant de live absent n\'est jamais remplacé par « le dernier live »', () => {
    expect(L({ liveId: 'R1' }).source).toBe('live'); expect(L({ live: false }).source).toBe('non_live'); expect(L({}).source).toBe('unknown'); expect(L({}).externalLiveId).toBeNull();
  });
});

describe('critère 1 · pièce unique', () => {
  it('une vente confirmée passe le stock de 1 à 0, deux notifications et un rattrapage ne débitent qu\'une fois', () => {
    let s = C.addVariant(base(), { id: 'p1', unique: true, onHand: 1 }); s = C.addLink(s, { accountId: A, extVariantId: 'x1', kind: 'piece', targetId: 'p1' });
    const line = L({ variantId: 'x1' });
    s = C.ingestLines(s, [line]); s = C.ingestLines(s, [line]); s = C.ingestLines(s, [line, line]);
    expect(stock(s, 'p1').onHand).toBe(0); expect(s.movements).toHaveLength(1);
  });
  it('une commande impayée réserve la pièce, puis payée la retire sans retenir deux fois', () => {
    let s = C.addVariant(base(), { id: 'p1', unique: true, onHand: 1 }); s = C.addLink(s, { accountId: A, extVariantId: 'x1', kind: 'piece', targetId: 'p1' });
    s = C.ingestLines(s, [L({ variantId: 'x1', status: 'UNPAID' })]); expect(stock(s, 'p1')).toMatchObject({ onHand: 1, reserved: 1 });
    s = C.ingestLines(s, [L({ variantId: 'x1', status: 'AWAITING_SHIPMENT', updatedAt: '2026-11-10T11:00:00Z' })]); expect(stock(s, 'p1')).toMatchObject({ onHand: 0, reserved: 0 });
  });
});

describe('critère 2 · variantes', () => {
  it('3 t-shirts M noirs vendus ne touchent ni le L noir ni le M blanc', () => {
    let s = base(); [['m-noir', 10], ['l-noir', 10], ['m-blanc', 10]].forEach(([id, n]) => { s = C.addVariant(s, { id, onHand: n }); s = C.addLink(s, { accountId: A, extVariantId: 'e-' + id, kind: 'variant', targetId: id }); });
    s = C.ingestLines(s, [L({ variantId: 'e-m-noir', quantity: 3 })]);
    expect([stock(s, 'm-noir').onHand, stock(s, 'l-noir').onHand, stock(s, 'm-blanc').onHand]).toEqual([7, 10, 10]);
  });
  it('un SKU inconnu ne modifie aucune autre taille et va dans « À rapprocher »', () => {
    let s = C.addVariant(base(), { id: 'm', onHand: 5 }); s = C.ingestLines(s, [L({ variantId: 'zzz', merchantSku: 'ZZZ', liveId: 'R1' })]);
    expect(stock(s, 'm').onHand).toBe(5); expect(C.toMatch(s).some(x => x.type === 'sku_inconnu')).toBe(true);
  });
  it('un rapprochement tardif applique la vente une seule fois', () => {
    let s = C.addVariant(base(), { id: 'm', onHand: 5 }); s = C.ingestLines(s, [L({ variantId: 'zzz', quantity: 2 })]);
    s = C.addLink(s, { accountId: A, extVariantId: 'zzz', kind: 'variant', targetId: 'm' }); expect(stock(s, 'm').onHand).toBe(3);
    s = C.addLink(s, { accountId: A, extVariantId: 'zzz', kind: 'variant', targetId: 'm' }); expect(stock(s, 'm').onHand).toBe(3);
  });
  it('changer la liaison inverse l\'ancien effet puis applique le nouveau', () => {
    let s = C.addVariant(C.addVariant(base(), { id: 'a', onHand: 5 }), { id: 'b', onHand: 5 });
    s = C.addLink(s, { accountId: A, extVariantId: 'x', kind: 'variant', targetId: 'a' }); s = C.ingestLines(s, [L({ variantId: 'x', quantity: 2 })]); expect(stock(s, 'a').onHand).toBe(3);
    s = C.addLink(s, { accountId: A, extVariantId: 'x', kind: 'variant', targetId: 'b' }); expect([stock(s, 'a').onHand, stock(s, 'b').onHand]).toEqual([5, 3]);
  });
});

describe('critère 3 · ballot exclusif', () => {
  const mk = () => {
    let s = base(); const b = C.addBallot(s, { label: 'B1', landedCost: '540,00' }); s = b.state;
    s = C.ingestLines(s, [L({ orderId: 'o1', listingId: 'a1', liveId: 'R1' }), L({ orderId: 'o2', listingId: 'a2', liveId: 'R2' })]);
    const [r1, r2] = s.sessions; s = C.setSessionMode(s, r1.id, 'exclusive_ballot'); s = C.setSessionMode(s, r2.id, 'exclusive_ballot');
    s = C.addRule(s, { sessionId: r1.id, ballotId: b.id, isDefault: true }).state; s = C.addRule(s, { sessionId: r2.id, ballotId: b.id, isDefault: true }).state;
    return { s, b: b.id };
  };
  it('deux lives liés au même ballot cumulent leurs ventes, et un rejeu ne double rien', () => {
    let { s, b } = mk();
    s = C.ingestEntries(s, [{ accountId: A, key: 'e1', orderId: 'o1', type: 'sale', amount: '10,00', stage: 'settled' }, { accountId: A, key: 'e2', orderId: 'o2', type: 'sale', amount: '10,00', stage: 'settled' }]);
    const r = C.ballotResult(s, b); expect(r.net).toBe(2000); expect(r.sessions).toHaveLength(2);
    const again = C.ingestLines(s, Object.values(s.lines).map(l => ({ ...l }))); expect(C.ballotResult(again, b).net).toBe(2000);
    expect(JSON.stringify(C.ballotResult(C.ingestLines(again, Object.values(again.lines)), b))).toBe(JSON.stringify(r));
  });
  it('le ballot par défaut ne vaut que pour les lignes non classées', () => {
    let { s, b } = mk(); s = C.addVariant(s, { id: 'v', onHand: 3 }); s = C.addLink(s, { accountId: A, extVariantId: 'xv', kind: 'variant', targetId: 'v' });
    s = C.ingestLines(s, [L({ orderId: 'o3', variantId: 'xv', liveId: 'R1' })]);
    expect(s.lines['acc1|o3|1'].att.ballotId).toBeNull(); expect(s.lines['acc1|o1|1'].att.ballotId).toBe(b);
  });
  it('une pièce qui a une provenance ballot débite le stock une fois et compte pour ce ballot', () => {
    let s = base(); const b = C.addBallot(s, { label: 'B1', landedCost: '100,00' }); s = b.state; s = C.addVariant(s, { id: 'p', unique: true, onHand: 1, ballot: b.id }); s = C.addLink(s, { accountId: A, extVariantId: 'xp', kind: 'piece', targetId: 'p' });
    s = C.ingestLines(s, [L({ variantId: 'xp', gross: '40,00' }), L({ variantId: 'xp', gross: '40,00' })]);
    expect(stock(s, 'p').onHand).toBe(0); expect(s.movements).toHaveLength(1); expect(C.ballotResult(s, b.id).gross).toBe(4000);
  });
  it('un ballot « exclusif » sans nombre de pièces ne montre ni stock restant ni taux de vente', () => {
    const { s, b } = mk(); const r = C.ballotResult(s, b); expect(s.ballots[0].knownUnits).toBeNull(); expect(r).not.toHaveProperty('tauxVente'); expect(r).not.toHaveProperty('coutMoyenPiece');
  });
});

describe('critère 4 · ballots mixtes', () => {
  it('deux annonces liées à deux ballots restent séparées ; une annonce commune ambiguë n\'entre dans aucun ballot', () => {
    let s = base(); const b1 = C.addBallot(s, { label: 'B1', landedCost: '100,00' }); s = b1.state; const b2 = C.addBallot(s, { label: 'B2', landedCost: '100,00' }); s = b2.state;
    s = C.ingestLines(s, [L({ orderId: 'o1', listingId: 'a1', liveId: 'R1' }), L({ orderId: 'o2', listingId: 'a2', liveId: 'R1' }), L({ orderId: 'o3', listingId: 'commun', liveId: 'R1' })]);
    const r = s.sessions[0].id;
    s = C.addRule(s, { sessionId: r, ballotId: b1.id, subjectId: 'a1' }).state; s = C.addRule(s, { sessionId: r, ballotId: b2.id, subjectId: 'a2' }).state;
    expect(C.addRule(s, { sessionId: r, ballotId: b2.id, subjectId: 'a1' }).error).toBe('regle_concurrente');
    expect(s.lines['acc1|o1|1'].att.ballotId).toBe(b1.id); expect(s.lines['acc1|o2|1'].att.ballotId).toBe(b2.id);
    expect(s.lines['acc1|o3|1'].att.status).toBe('to_match');
    const sum = C.sessionSummary(s, r); expect(sum.lines).toBe(3); expect(sum.toMatch).toBe(1);
    expect(C.ballotResult(s, b1.id).items).toBe(1); expect(C.ballotResult(s, b2.id).items).toBe(1);
  });
  it('deux ballots en concurrence sur la même annonce rendent la ligne ambiguë (visible dans le live, pas dans les ballots)', () => {
    let s = base(); const b1 = C.addBallot(s, { label: 'B1', landedCost: '100,00' }); s = b1.state; const b2 = C.addBallot(s, { label: 'B2', landedCost: '100,00' }); s = b2.state;
    s = C.ingestLines(s, [L({ listingId: 'a1', liveId: 'R1' })]); const r = s.sessions[0].id;
    s.rules.push({ id: 'x1', sessionId: r, ballotId: b1.id, subjectId: 'a1', subjectType: 'listing', isDefault: false }, { id: 'x2', sessionId: r, ballotId: b2.id, subjectId: 'a1', subjectType: 'listing', isDefault: false });
    s = C.recompute(s); expect(s.lines['acc1|o1|1'].att.status).toBe('ambiguous'); expect(C.ballotResult(s, b1.id).items).toBe(0); expect(C.ballotResult(s, b2.id).items).toBe(0); expect(C.sessionSummary(s, r).toMatch).toBe(1);
  });
  it('un seul ballot par défaut par live', () => {
    let s = base(); const b1 = C.addBallot(s, { label: 'B1', landedCost: '1,00' }); s = b1.state; const b2 = C.addBallot(s, { label: 'B2', landedCost: '1,00' }); s = b2.state;
    s = C.ingestLines(s, [L({ liveId: 'R1', listingId: 'z' })]); const r = s.sessions[0].id;
    s = C.addRule(s, { sessionId: r, ballotId: b1.id, isDefault: true }).state; expect(C.addRule(s, { sessionId: r, ballotId: b2.id, isDefault: true }).error).toBe('defaut_en_double');
  });
});

describe('critère 5 · TikTok mixte', () => {
  it('deux lignes d\'une même commande avec des room_id différents vont dans deux lives différents', () => {
    let s = C.ingestLines(base(), [L({ lineId: '1', liveId: 'R1' }), L({ lineId: '2', liveId: 'R2' })]);
    expect(s.sessions).toHaveLength(2); expect(s.lines['acc1|o1|1'].att.sessionId).not.toBe(s.lines['acc1|o1|2'].att.sessionId);
  });
  it('une ligne explicitement hors live ne rejoint pas le dernier live actif et reste hors du live', () => {
    let s = C.ingestLines(base(), [L({ orderId: 'a', liveId: 'R1' }), L({ orderId: 'b', live: false })]);
    expect(s.lines['acc1|b|1'].att.sessionId).toBeNull(); expect(C.sessionSummary(s, s.sessions[0].id).lines).toBe(1);
  });
  it('une vente hors live d\'une pièce issue d\'un ballot compte pour le ballot, dans une rubrique à part', () => {
    let s = base(); const b = C.addBallot(s, { label: 'B', landedCost: '50,00' }); s = b.state; s = C.addVariant(s, { id: 'p', unique: true, onHand: 1, ballot: b.id }); s = C.addLink(s, { accountId: A, extVariantId: 'xp', kind: 'piece', targetId: 'p' });
    s = C.ingestLines(s, [L({ variantId: 'xp', live: false, gross: '30,00' })]); expect(C.offLiveForBallot(s, b.id).gross).toBe(3000); expect(C.sessionSummary(s, 'x').lines).toBe(0);
  });
});

describe('critère 6 · annulation et retours', () => {
  const setup = () => { let s = C.addVariant(base(), { id: 'v', onHand: 5 }); s = C.addLink(s, { accountId: A, extVariantId: 'x', kind: 'variant', targetId: 'v' }); return s; };
  it('annulation d\'une réservation : libérée une seule fois', () => {
    let s = C.ingestLines(setup(), [L({ variantId: 'x', status: 'UNPAID', quantity: 2 })]); expect(stock(s, 'v').reserved).toBe(2);
    s = C.ingestLines(s, [L({ variantId: 'x', status: 'CANCELLED', quantity: 2, updatedAt: '2026-11-10T12:00:00Z' })]); s = C.ingestLines(s, [L({ variantId: 'x', status: 'CANCELLED', quantity: 2, updatedAt: '2026-11-10T12:00:00Z' })]);
    expect(stock(s, 'v')).toMatchObject({ onHand: 5, reserved: 0 });
  });
  it('annulation avant expédition confirmée par la plateforme : le stock physique est rendu une fois', () => {
    let s = C.ingestLines(setup(), [L({ variantId: 'x', quantity: 2 })]); expect(stock(s, 'v').onHand).toBe(3);
    s = C.ingestLines(s, [L({ variantId: 'x', quantity: 2, status: 'CANCELLED', restock: true, updatedAt: '2026-11-10T12:00:00Z' })]); expect(stock(s, 'v').onHand).toBe(5);
    s = C.ingestLines(s, [L({ variantId: 'x', quantity: 2, status: 'CANCELLED', restock: true, updatedAt: '2026-11-10T12:00:00Z' })]); expect(stock(s, 'v').onHand).toBe(5);
  });
  it('annulation sans retour revendable établi : le stock physique reste retiré', () => {
    let s = C.ingestLines(setup(), [L({ variantId: 'x', quantity: 2 })]); s = C.ingestLines(s, [L({ variantId: 'x', quantity: 2, status: 'CANCELLED', updatedAt: '2026-11-10T12:00:00Z' })]); expect(stock(s, 'v').onHand).toBe(3);
  });
  it('un remboursement seul n\'a aucun effet sur le stock, il ajuste le net', () => {
    let s = C.ingestLines(setup(), [L({ variantId: 'x', liveId: 'R1' })]); const avant = stock(s, 'v').onHand;
    s = C.ingestEntries(s, [{ accountId: A, key: 'e1', orderId: 'o1', type: 'sale', amount: '10,00', stage: 'settled' }, { accountId: A, key: 'e2', orderId: 'o1', type: 'refund', amount: '-4,00', stage: 'settled' }]);
    expect(stock(s, 'v').onHand).toBe(avant); expect(C.orderNet(s, A, 'o1').net).toBe(600);
  });
  it('un statut inconnu ne crée aucun nouvel effet', () => {
    let s = C.ingestLines(setup(), [L({ variantId: 'x', quantity: 2 })]); s = C.ingestLines(s, [L({ variantId: 'x', quantity: 2, status: 'MYSTERE', updatedAt: '2026-11-10T12:00:00Z' })]);
    expect(stock(s, 'v').onHand).toBe(3);
  });
  it('une vente impossible est gardée et ouvre un écart de stock', () => {
    let s = C.addVariant(base(), { id: 'u', unique: true, onHand: 1 }); s = C.addLink(s, { accountId: A, extVariantId: 'x', kind: 'piece', targetId: 'u' });
    s = C.ingestLines(s, [L({ variantId: 'x', quantity: 2, liveId: 'R1' })]); expect(stock(s, 'u').onHand).toBe(-1);
    expect(C.toMatch(s).some(a => a.type === 'stock_gap' && a.missing === 1)).toBe(true); expect(Object.keys(s.lines)).toHaveLength(1);
  });
});

describe('critère 7 · finance', () => {
  const ent = (key, orderId, amount, stage, type = 'sale', extra = {}) => Object.assign({ accountId: A, key, orderId, amount, stage, type }, extra);
  it('frais manquants : brut seulement, jamais « net estimé »', () => {
    let b = C.addBallot(base(), { label: 'B', landedCost: '100,00' }); let s = b.state; s = C.ingestLines(s, [L({ listingId: 'z', liveId: 'R1', gross: '50,00' })]); s = C.setSessionMode(s, s.sessions[0].id, 'exclusive_ballot'); s = C.addRule(s, { sessionId: s.sessions[0].id, ballotId: b.id, isDefault: true }).state;
    const r = C.ballotResult(s, b.id); expect(r.gross).toBe(5000); expect(r.net).toBeNull(); expect(r.reste).toBeNull();
  });
  it('un montant comptabilisé remplace l\'estimation, sans somme des deux ; importer deux fois ne change rien', () => {
    let s = C.ingestEntries(base(), [ent('a', 'o1', '10,00', 'provisional'), ent('b', 'o1', '-1,50', 'provisional', 'fee')]); expect(C.orderNet(s, A, 'o1')).toEqual({ net: 850, stage: 'provisional' });
    const reg = [ent('a2', 'o1', '10,00', 'settled'), ent('b2', 'o1', '-1,20', 'settled', 'fee')]; s = C.ingestEntries(s, reg); expect(C.orderNet(s, A, 'o1')).toEqual({ net: 880, stage: 'settled' });
    const s2 = C.ingestEntries(s, reg); expect(s2.entries).toEqual(s.entries); expect(C.orderNet(s2, A, 'o1').net).toBe(880);
  });
  it('l\'exemple de la spécification : 540 € de ballot, 435, puis 610, puis un remboursement de 20 €', () => {
    let b = C.addBallot(base(), { label: 'B', landedCost: '540,00' }); let s = b.state;
    s = C.ingestLines(s, [L({ orderId: 'l1', listingId: 'x', liveId: 'R1' }), L({ orderId: 'l2', listingId: 'y', liveId: 'R2' })]); const [r1, r2] = s.sessions;
    s = C.setSessionMode(s, r1.id, 'exclusive_ballot'); s = C.setSessionMode(s, r2.id, 'exclusive_ballot'); s = C.addRule(s, { sessionId: r1.id, ballotId: b.id, isDefault: true }).state; s = C.addRule(s, { sessionId: r2.id, ballotId: b.id, isDefault: true }).state;
    s = C.ingestEntries(s, [ent('e1', 'l1', '435,00', 'provisional')]); let r = C.ballotResult(s, b.id); expect(r.net).toBe(43500); expect(r.reste).toBe(10500); expect(r.provisional).toBe(true);
    s = C.ingestEntries(s, [ent('e2', 'l2', '175,00', 'provisional')]); r = C.ballotResult(s, b.id); expect(r.net).toBe(61000); expect(r.reste).toBe(0); expect(r.ecart).toBe(7000);
    s = C.ingestEntries(s, [ent('e3', 'l2', '-20,00', 'provisional', 'refund')]); r = C.ballotResult(s, b.id); expect(r.ecart).toBe(5000);
  });
  it('le coût d\'un ballot peut être révisé : l\'historique est gardé et les résultats suivent', () => {
    let b = C.addBallot(base(), { label: 'B', landedCost: '100,00', at: '2026-01-01' }); let s = C.setBallotCost(b.state, b.id, '120,00', '2026-02-01'); expect(s.ballots[0].revisions).toHaveLength(2); expect(C.ballotResult(s, b.id).cost).toBe(12000);
  });
  it('les frais d\'une commande à plusieurs cibles sans montants par ligne ne sont pas ventilés', () => {
    let s = base(); const b1 = C.addBallot(s, { label: 'B1', landedCost: '10,00' }); s = b1.state; const b2 = C.addBallot(s, { label: 'B2', landedCost: '10,00' }); s = b2.state;
    s = C.ingestLines(s, [L({ lineId: '1', listingId: 'a1', liveId: 'R1' }), L({ lineId: '2', listingId: 'a2', liveId: 'R1' })]); const r = s.sessions[0].id;
    s = C.addRule(s, { sessionId: r, ballotId: b1.id, subjectId: 'a1' }).state; s = C.addRule(s, { sessionId: r, ballotId: b2.id, subjectId: 'a2' }).state;
    s = C.ingestEntries(s, [ent('e1', 'o1', '20,00', 'settled')]);
    expect(C.ballotResult(s, b1.id).net).toBeNull(); expect(C.ballotResult(s, b1.id).notSpread).toBe(1); expect(C.toMatch(s).some(x => x.type === 'frais_non_ventiles')).toBe(true);
    s = C.ingestEntries(s, [ent('l1', 'o1', '12,00', 'settled', 'sale', { lineId: '1' }), ent('l2', 'o1', '8,00', 'settled', 'sale', { lineId: '2' })]);
    expect(C.ballotResult(s, b1.id).net).toBe(1200); expect(C.ballotResult(s, b2.id).net).toBe(800);
  });
});

describe('critère 8 · résilience', () => {
  it('un événement ancien arrivant après une annulation ne fait pas régresser le statut', () => {
    let s = C.addVariant(base(), { id: 'v', onHand: 5 }); s = C.addLink(s, { accountId: A, extVariantId: 'x', kind: 'variant', targetId: 'v' });
    s = C.ingestLines(s, [L({ variantId: 'x', status: 'CANCELLED', updatedAt: '2026-11-10T12:00:00Z' })]); s = C.ingestLines(s, [L({ variantId: 'x', status: 'UNPAID', updatedAt: '2026-11-10T09:00:00Z' })]);
    expect(s.lines['acc1|o1|1'].status).toBe('cancelled'); expect(stock(s, 'v')).toMatchObject({ onHand: 5, reserved: 0 });
  });
  it('rejouer toutes les notifications, puis un événement ancien, laisse l\'état identique', () => {
    const s = loadDemo(C.emptyState()), r = replayDemo(s);
    expect(r.variants).toEqual(s.variants); expect(r.movements).toEqual(s.movements); expect(Object.fromEntries(Object.entries(r.lines).map(([k, l]) => [k, l.status]))).toEqual(Object.fromEntries(Object.entries(s.lines).map(([k, l]) => [k, l.status])));
  });
  it('un compte dont l\'accès est perdu ouvre « À reconnecter »', () => {
    const s = base(); s.accounts[0].status = 'reconnect'; expect(C.toMatch(s).some(x => x.type === 'acces_perdu')).toBe(true);
  });
});

describe('critère 9 · plusieurs vendeurs', () => {
  it('un vendeur ne voit jamais les commandes d\'un autre', () => {
    let s = base(); s.accounts.push({ id: 'acc2', provider: 'tiktok_shop', tenant: 't2', status: 'connected' });
    s = C.ingestLines(s, [L({ orderId: 'o1' }), C.normalizeLine('tiktok_shop', 'acc2', { orderId: 'o9', lineId: '1', quantity: 1, status: 'COMPLETED', gross: '9,00' })]);
    const v1 = C.forTenant(s, 't1'), v2 = C.forTenant(s, 't2'); expect(Object.keys(v1.lines)).toEqual(['acc1|o1|1']); expect(Object.keys(v2.lines)).toEqual(['acc2|o9|1']); expect(v1.accounts.map(a => a.id)).toEqual(['acc1']);
  });
  it('« Sync stock active » seulement quand l\'écriture est vérifiée', () => {
    expect(C.stockSyncActive({ caps: { orders: 'verified' } })).toBe(false); expect(C.stockSyncActive({ caps: { inventory_write: 'authorized' } })).toBe(false); expect(C.stockSyncActive({ caps: { inventory_write: 'verified' } })).toBe(true);
    expect(C.capLevel({}, 'finance')).toBe('documented');
  });
});

describe('correction explicite d\'une ligne', () => {
  it('une ligne à rapprocher peut être corrigée avec historique, sans dupliquer la recette', () => {
    let b = C.addBallot(base(), { label: 'B', landedCost: '50,00' }); let s = b.state; s = C.ingestLines(s, [L({ listingId: 'z', liveId: 'R1', gross: '20,00' })]);
    s = C.ingestEntries(s, [{ accountId: A, key: 'e1', orderId: 'o1', type: 'sale', amount: '20,00', stage: 'settled' }]); expect(C.ballotResult(s, b.id).net).toBeNull();
    s = C.overrideLine(s, 'acc1|o1|1', { ballotId: b.id }, 'moi', 'sûr', '2026-11-12'); expect(C.ballotResult(s, b.id).net).toBe(2000);
    s = C.overrideLine(s, 'acc1|o1|1', { ballotId: b.id }, 'moi', 'sûr', '2026-11-12'); expect(C.ballotResult(s, b.id).net).toBe(2000); expect(s.overrides).toHaveLength(2);
  });
});

describe('connecteur de démonstration', () => {
  it('charge un compte de test, des lives, un ballot et des lignes à rapprocher, sans toucher à rien d\'autre', () => {
    const s = loadDemo(C.emptyState());
    expect(s.accounts.map(a => a.id)).toEqual([DEMO_ACCOUNT]); expect(s.sessions).toHaveLength(2); expect(s.ballots).toHaveLength(1);
    expect(stock(s, 'v-tee-m-noir').onHand).toBe(6 - 2 - 1); expect(stock(s, 'v-veste-1').onHand).toBe(0); expect(stock(s, 'v-tee-l-noir').onHand).toBe(4);
    const types = C.toMatch(s).map(x => x.type); expect(types).toContain('sku_inconnu');
    const r = C.ballotResult(s, s.ballots[0].id); expect(r.net).not.toBeNull(); expect(r.ecart).toBe(r.net - 54000);
    expect(JSON.stringify(loadDemo(s)).length).toBeGreaterThan(100);   /* recharger la démo ne casse rien */
  });
});
