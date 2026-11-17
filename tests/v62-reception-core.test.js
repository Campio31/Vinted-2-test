import { describe, it, expect } from 'vitest';
import * as R from '../src/modules/reception-core.js';

const mk = (o) => { const a = R.newReception(R.emptyStore(), Object.assign({ ballot: 'B1', receivedAt: '2026-11-17' }, o)); return { store: a.store, id: a.id }; };
const get = (c) => R.find(c.store, c.id);
const set = (c, p) => { const r = R.patch(c.store, c.id, null, p); expect(r.error).toBe(null); c.store = r.store; return c; };

describe('Réception : quantités et écarts', () => {
  it('50 A annoncées, 42 A + 6 B reçues : 48 reçues, 2 manquantes si l\'attente est close, 6 déclassées', () => {
    const c = mk({ expected: { A: 50, B: null, C: null } }); set(c, { counts: { A: 42, B: 6, C: null, V: null }, closeWait: true });
    const g = R.gaps(get(c), 0); expect(g.received).toBe(48); expect(g.missing).toBe(2); expect(g.downgraded).toBe(6); expect(g.over).toBe(0);
  });
  it('tant que l\'attente n\'est pas close, le reste est « attendu », pas manquant', () => {
    const c = mk({ expected: { A: 50, B: null, C: null } }); set(c, { counts: { A: 42, B: 6, C: null, V: null } });
    const g = R.gaps(get(c), 0); expect(g.missing).toBe(0); expect(g.remaining).toBe(2);
  });
  it('« À vérifier » est reçue, pas manquante, et ne compte pas comme un grade en trop', () => {
    const c = mk({ expectedTotal: 10 }); set(c, { counts: { A: 7, B: null, C: null, V: 3 } });
    const g = R.gaps(get(c), 0); expect(g.received).toBe(10); expect(g.remaining).toBe(0); expect(g.over).toBe(0);
  });
  it('sans grade promis, un tri en A/B/C n\'est pas une non-conformité', () => {
    const c = mk({ expectedTotal: 20 }); set(c, { counts: { A: 10, B: 6, C: 4, V: null } }); const g = R.gaps(get(c), 0); expect(g.downgraded).toBe(0); expect(g.missing).toBe(0);
  });
  it('deux livraisons de 30 et 20 sur une commande de 50 : 20 restantes, puis aucun manquant', () => {
    const c1 = mk({ expectedTotal: 50, orderRef: 'CMD', counts: { A: 30, B: null, C: null, V: null } }); expect(R.gaps(get(c1), 0).remaining).toBe(20);
    const c2 = mk({ expectedTotal: 50, orderRef: 'CMD', counts: { A: 20, B: null, C: null, V: null } }); const g = R.gaps(get(c2), 30); expect(g.remaining).toBe(0); expect(g.missing).toBe(0);
  });
  it('vide = non renseigné, jamais zéro', () => {
    const c = mk({}); expect(R.receivedTotal(get(c))).toBe(null); expect(R.expectedTotalOf(get(c))).toBe(null);
    set(c, { mode: 'closed', unverified: true }); expect(R.receivedTotal(get(c))).toBe(null);
    set(c, { unverified: false, closedTotal: 0 }); expect(R.receivedTotal(get(c))).toBe(0);
  });
});

describe('Réception : ventilation', () => {
  const c48 = () => { const c = mk({}); set(c, { counts: { A: 48, B: null, C: null, V: null }, alloc: { A: { draft: 30, ballot: 12, quarantine: 6 } } }); return c; };
  it('48 reçues ventilées 30 / 12 / 6 : 30 places, 12 en ballot, 6 isolées, 0 à traiter', () => {
    const r = get(c48()), a = R.allocation(r); expect(R.validate(r)).toEqual([]); expect(a.total).toEqual({ draft: 30, ballot: 12, quarantine: 6, unprocessed: 0 }); expect(R.slots(r).length).toBe(30);
    const x = R.recap(r); expect(x.drafts).toBe(30); expect(x.ballot).toBe(12); expect(x.quarantine).toBe(6);
  });
  it('une ventilation ne dépasse jamais ce qui a été reçu dans le grade', () => {
    const c = c48(); set(c, { alloc: { A: { draft: 40, ballot: 12, quarantine: 6 } } }); expect(R.validate(get(c)).some(e => e.code === 'ventilation_depasse')).toBe(true);
  });
  it('mélange de grades : chaque grade garde son propre plafond', () => {
    const c = mk({}); set(c, { counts: { A: 5, B: 3, C: null, V: null }, alloc: { A: { draft: 5 }, B: { draft: 4 } } }); expect(R.validate(get(c)).some(e => e.code === 'ventilation_depasse' && e.k === 'B')).toBe(true);
  });
  it('ballot fermé, quantité inconnue : aucune fiche, pas de faux total, transfert vers Live possible', () => {
    const c = mk({}); set(c, { mode: 'closed', unverified: true }); const r = get(c); expect(R.validate(r)).toEqual([]); expect(R.slots(r).length).toBe(0); const a = R.allocation(r); expect(a.rows[0].ballot).toBe(null); expect(R.recap(r).unverified).toBe(true);
  });
  it('ballot fermé : aucun brouillon sans tri', () => {
    const c = mk({}); set(c, { mode: 'closed', closedTotal: 20, alloc: { T: { draft: 5 } } }); expect(R.validate(get(c)).some(e => e.code === 'brouillons_sans_tri')).toBe(true);
  });
  it('coût : répartition indicative par pièce, nulle si coût ou total inconnu', () => {
    const c = mk({ costCents: 54000 }); set(c, { counts: { A: 48, B: null, C: null, V: null } }); expect(R.unitCost(get(c), null)).toBe(11.25);
    expect(R.unitCost(Object.assign({}, get(c), { costCents: null }), null)).toBe(null); const u = mk({}); set(u, { costCents: 100, mode: 'closed', unverified: true }); expect(R.unitCost(get(u), null)).toBe(null);
  });
  it('un brouillon n\'est pas publiable : « Pas Disponible », indicateur brouillon, lien stable vers la place', () => {
    const r = get(c48()), sl = R.slots(r)[0], p = R.pieceFor(r, sl, 11.25, 1); expect(p.statut).toBe('Pas Disponible'); expect(p.brouillon).toBe(1); expect(p.id).toBe('rc-' + r.id + '-A-0'); expect(p.achat).toBe(11.25); expect(p.rec.slot).toBe('A-0'); expect(p.grade).toBe('A');
  });
});

describe('Réception : validation rejouable', () => {
  it('double validation et reprise après arrêt : aucune fiche en double', () => {
    const c = mk({}); set(c, { counts: { A: 4, B: null, C: null, V: null }, alloc: { A: { draft: 4 } } });
    const b1 = R.beginConfirm(c.store, c.id, 'op1'); expect(b1.error).toBe(null); c.store = b1.store;
    c.store = R.markCreated(c.store, c.id, ['rc-' + c.id + '-A-0', 'rc-' + c.id + '-A-1'], []); expect(get(c).state).toBe('confirming');           /* arrêt à mi-chemin */
    const b2 = R.beginConfirm(c.store, c.id, 'op1'); expect(b2.error).toBe(null); expect(b2.store).toBe(c.store === b2.store ? c.store : b2.store);
    const b3 = R.beginConfirm(c.store, c.id, 'autre'); expect(b3.error).toBe('autre_operation');
    c.store = R.markCreated(c.store, c.id, ['rc-' + c.id + '-A-2', 'rc-' + c.id + '-A-3'], []); expect(get(c).state).toBe('confirmed'); expect(get(c).created.length).toBe(4);
    const b4 = R.beginConfirm(c.store, c.id, 'op2'); expect(b4.already).toBe(true);
  });
  it('un brouillon invalide est refusé avant de verrouiller', () => {
    const c = mk({ ballot: '' }); expect(R.beginConfirm(c.store, c.id, 'x').error).toBe('invalide'); expect(get(c).state).toBe('draft');
  });
  it('une modification fondée sur une révision périmée est refusée ; une réception confirmée est verrouillée', () => {
    const c = mk({}); const r0 = get(c).rev; set(c, { supplier: 'F' }); expect(R.patch(c.store, c.id, r0, { supplier: 'G' }).error).toBe('revision');
    set(c, { counts: { A: 1, B: null, C: null, V: null }, alloc: { A: { ballot: 1 } } }); c.store = R.markCreated(R.beginConfirm(c.store, c.id, 'o').store, c.id, [], []); expect(get(c).state).toBe('confirmed'); expect(R.patch(c.store, c.id, null, { supplier: 'Z' }).error).toBe('verrouillee');
  });
  it('le cumul des livraisons confirmées d\'une même commande est calculé', () => {
    const c = mk({ orderRef: 'CMD', counts: { A: 30, B: null, C: null, V: null }, alloc: { A: { ballot: 30 } } }); c.store = R.markCreated(R.beginConfirm(c.store, c.id, 'o').store, c.id, [], []);
    expect(R.priorReceived(c.store, 'B1', 'CMD', 'autre')).toBe(30); expect(R.priorReceived(c.store, 'B1', 'AUTRE', 'x')).toBe(0);
  });
  it('le récap fournisseur écrit « non renseigné » pour les champs inconnus', () => {
    const c = mk({ expected: { A: 50, B: null, C: null } }); set(c, { counts: { A: 42, B: 6, C: null, V: null }, closeWait: true, issues: [{ type: 'defect', qty: 2, note: 'taches', photos: ['p1'] }] });
    const txt = R.supplierText(get(c), s => s); expect(txt).toContain('Fournisseur : non renseigné'); expect(txt).toContain('Manquantes : 2'); expect(txt).toContain('Déclassées : 6'); expect(txt).toContain('Défaut ×2 : taches');
  });
});
