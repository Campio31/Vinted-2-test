/* ---------- Live connecté : connecteur de test ----------
   Donne au moteur des commandes simulées qui ressemblent à celles d'une vraie boutique (lives, achats hors live, annulation, SKU inconnu, frais provisoires puis comptabilisés).
   Il ne touche JAMAIS aux fiches réelles de Syno : tout reste dans l'état Live. */
import { addBallot, addLink, addRule, addVariant, ingestEntries, ingestLines, normalizeLine, setSessionMode } from './live-core.js';

export const DEMO_ACCOUNT = 'demo-test';
const ACC = { id: DEMO_ACCOUNT, provider: 'test', shop: 'Boutique de démonstration', market: 'FR', status: 'connected', tenant: 'local', scopes: ['orders.read', 'lives.read', 'finance.read'], lastSync: '', caps: { orders: 'verified', lives: 'authorized', finance: 'authorized', inventory_write: 'documented' } };

/** Lignes brutes de la démonstration : deux lives, des achats hors live, une annulation, un SKU inconnu. */
export const demoRawLines = () => [
  { orderId: 'D-1001', lineId: '1', variantId: 'ext-tee-m-noir', merchantSku: 'TEE-M-NOIR', liveId: 'LIVE-A', quantity: 2, status: 'AWAITING_SHIPMENT', gross: '24,00', updatedAt: '2026-11-10T20:12:00Z' },
  { orderId: 'D-1002', lineId: '1', variantId: 'ext-veste-1', merchantSku: 'VESTE-CUIR-1', liveId: 'LIVE-A', quantity: 1, status: 'COMPLETED', gross: '58,00', updatedAt: '2026-11-10T20:20:00Z' },
  { orderId: 'D-1003', lineId: '1', listingId: 'ANN-12', liveId: 'LIVE-A', quantity: 1, status: 'AWAITING_SHIPMENT', gross: '35,00', updatedAt: '2026-11-10T20:31:00Z' },
  { orderId: 'D-1004', lineId: '1', variantId: 'ext-inconnu', merchantSku: 'MYSTERE-9', liveId: 'LIVE-B', quantity: 1, status: 'AWAITING_SHIPMENT', gross: '20,00', updatedAt: '2026-11-10T20:40:00Z' },
  { orderId: 'D-1005', lineId: '1', variantId: 'ext-tee-m-noir', merchantSku: 'TEE-M-NOIR', live: false, quantity: 1, status: 'AWAITING_SHIPMENT', gross: '13,00', updatedAt: '2026-11-11T09:02:00Z' },
  { orderId: 'D-1006', lineId: '1', variantId: 'ext-tee-l-noir', merchantSku: 'TEE-L-NOIR', liveId: 'LIVE-B', quantity: 1, status: 'CANCELLED', gross: '12,00', updatedAt: '2026-11-12T19:44:00Z' },
  { orderId: 'D-1007', lineId: '1', listingId: 'ANN-31', liveId: 'LIVE-B', quantity: 1, status: 'AWAITING_SHIPMENT', gross: '42,00', updatedAt: '2026-11-12T19:58:00Z' },
];
const demoEntries = () => [
  { key: 'e1', orderId: 'D-1001', type: 'sale', amount: '24,00', stage: 'provisional' }, { key: 'e2', orderId: 'D-1001', type: 'fee', amount: '-3,10', stage: 'provisional' },
  { key: 'e3', orderId: 'D-1002', type: 'sale', amount: '58,00', stage: 'settled' }, { key: 'e4', orderId: 'D-1002', type: 'fee', amount: '-7,25', stage: 'settled' },
  { key: 'e5', orderId: 'D-1003', type: 'sale', amount: '35,00', stage: 'provisional' }, { key: 'e6', orderId: 'D-1003', type: 'fee', amount: '-4,50', stage: 'provisional' },
  { key: 'e7', orderId: 'D-1007', type: 'sale', amount: '42,00', stage: 'provisional' }, { key: 'e8', orderId: 'D-1007', type: 'fee', amount: '-5,40', stage: 'provisional' },
].map(e => Object.assign({ accountId: DEMO_ACCOUNT }, e));

/** Remplit l'état avec la démonstration : compte, stock, ballot « exclusif » pour le premier live, liaisons de références. */
export function loadDemo(s0) {
  let s = JSON.parse(JSON.stringify(s0)); s.accounts = s.accounts.filter(a => a.id !== DEMO_ACCOUNT); s.accounts.push(Object.assign({}, ACC));
  s = addVariant(s, { id: 'v-tee-m-noir', label: 'T-shirt noir M', onHand: 6, unique: false });
  s = addVariant(s, { id: 'v-tee-l-noir', label: 'T-shirt noir L', onHand: 4, unique: false });
  s = addVariant(s, { id: 'v-veste-1', label: 'Veste en cuir (pièce unique)', onHand: 1, unique: true });
  s = addLink(s, { accountId: DEMO_ACCOUNT, extVariantId: 'ext-tee-m-noir', merchantSku: 'TEE-M-NOIR', kind: 'variant', targetId: 'v-tee-m-noir', source: 'demo' });
  s = addLink(s, { accountId: DEMO_ACCOUNT, extVariantId: 'ext-tee-l-noir', merchantSku: 'TEE-L-NOIR', kind: 'variant', targetId: 'v-tee-l-noir', source: 'demo' });
  s = addLink(s, { accountId: DEMO_ACCOUNT, extVariantId: 'ext-veste-1', merchantSku: 'VESTE-CUIR-1', kind: 'piece', targetId: 'v-veste-1', source: 'demo' });
  s = ingestLines(s, demoRawLines().map(r => normalizeLine('test', DEMO_ACCOUNT, r)));
  const b = addBallot(s, { label: 'Ballot de démonstration', supplier: 'Fournisseur test', landedCost: '540,00', at: '2026-11-08' }); s = b.state;
  const a = s.sessions.find(x => x.extLiveId === 'LIVE-A'), c = s.sessions.find(x => x.extLiveId === 'LIVE-B');
  a.title = 'Live du 10 novembre'; c.title = 'Live du 12 novembre'; a.state = c.state = 'ended';
  s = setSessionMode(s, a.id, 'exclusive_ballot'); s = addRule(s, { sessionId: a.id, ballotId: b.id, isDefault: true }).state;
  s = addRule(s, { sessionId: c.id, ballotId: b.id, subjectType: 'listing', subjectId: 'ANN-31' }).state;
  s = ingestEntries(s, demoEntries()); s.accounts.find(x => x.id === DEMO_ACCOUNT).lastSync = '2026-11-12T20:30:00Z';
  return s;
}
/** Rejoue les mêmes notifications, puis un événement plus ancien : l'état ne doit pas changer (rejeu sans danger). */
export function replayDemo(s) {
  const lines = demoRawLines().map(r => normalizeLine('test', DEMO_ACCOUNT, r)); const old = Object.assign({}, lines[1], { status: 'pending', providerUpdatedAt: '2026-11-10T19:00:00Z' });
  return ingestLines(ingestLines(s, lines), [old]);
}
