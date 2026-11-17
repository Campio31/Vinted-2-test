import { describe, it, expect } from 'vitest';
import * as C from '../src/modules/close-core.js';

const sale = (id, date, price, fees, account = 'TikTok', code) => ({ id, code: code || id, account, date, price, fees, currency: 'EUR', label: id });
const entry = (s, e) => C.addManualEntry(s, Object.assign({ account: 'TikTok', currency: 'EUR', stage: 'settled' }, e), 'T0').state;
const sum = (s, sales, o) => C.getCloseSummary(s, sales, Object.assign({ account: 'TikTok', month: '2026-11', asOf: '2026-11-30' }, o));

/* 600 € nets attendus : 6 ventes de 100 € sans frais ; 550 € confirmés sur 5, 35 € en attente identifiée sur 1 (qui vaut 100 €, 65 déjà comptés ailleurs : on teste l'identité sur le périmètre) */
describe('Clôture : montants et statuts', () => {
  it('600 attendus, 550 confirmés, 35 explicitement en attente : 15 à vérifier, sans cause inventée', () => {
    const sales = [sale('a', '2026-11-03', 20000, 0), sale('b', '2026-11-05', 20000, 0), sale('c', '2026-11-09', 20000, 0)];
    let s = C.emptyState();
    s = entry(s, { orderRef: 'a', type: 'sale', cents: 20000, effectDate: '2026-11-04' }); s = entry(s, { orderRef: 'b', type: 'sale', cents: 20000, effectDate: '2026-11-06' });
    s = entry(s, { orderRef: 'c', type: 'sale', cents: 15000, effectDate: '2026-11-10' }); s = entry(s, { orderRef: 'c', type: 'sale', cents: 3500, stage: 'pending', effectDate: '2026-11-10' });
    const v = sum(s, sales).sales; expect(v.expectedNet).toBe(60000); expect(v.confirmed).toBe(55000); expect(v.pending).toBe(3500); expect(v.gap).toBe(1500);
  });
  it('aucune donnée de règlement : « Non vérifié », jamais « impayée » ; net inconnu reste inconnu', () => {
    const sales = [sale('a', '2026-11-03', 5000, null)], v = sum(C.emptyState(), sales).sales;
    expect(v.rows[0].st).toBe('non_verifie'); expect(v.expectedUnknown).toBe(1); expect(v.gap).toBe(null); expect(v.rows[0].expected).toBe(null);
  });
  it('une source complète qui ne cite pas la vente : « À rapprocher », pas « impayée »', () => {
    let s = entry(C.emptyState(), { orderRef: 'zz', type: 'sale', cents: 100, effectDate: '2026-11-04' }); s = C.setCoverage(s, s.batches[0].id, { from: '2026-11-01', to: '2026-11-30', status: 'complete' });
    expect(sum(s, [sale('a', '2026-11-03', 5000, 0)]).sales.rows[0].st).toBe('a_rapprocher');
  });
  it('vente du 30 novembre réglée le 2 décembre : bonne date dans chaque vue, en attente à l\'arrêté du 30 novembre', () => {
    const sales = [sale('a', '2026-11-30', 1800, 0)]; let s = entry(C.emptyState(), { orderRef: 'a', type: 'sale', cents: 1800, stage: 'pending', effectDate: '2026-11-30' }); s = entry(s, { orderRef: 'a', type: 'sale', cents: 1800, effectDate: '2026-12-02' });
    const nov = sum(s, sales), dec = sum(s, sales, { month: '2026-12', asOf: '2026-12-31' });
    expect(nov.sales.rows[0].st).toBe('attente_identifiee'); expect(nov.sales.count).toBe(1); expect(nov.movements.settled).toBe(0); expect(dec.sales.count).toBe(0); expect(dec.movements.settled).toBe(1800);
    const apres = sum(s, sales, { asOf: '2026-12-31' }); expect(apres.sales.rows[0].confirmed).toBe(1800);
  });
  it('estimation 100 €, écriture finale 95 € : confirmé 95 €, jamais 195 ; écart signalé', () => {
    const sales = [sale('a', '2026-11-03', 10000, 0)]; let s = entry(C.emptyState(), { orderRef: 'a', type: 'sale', cents: 9500, effectDate: '2026-11-05' });
    const v = sum(s, sales).sales; expect(v.confirmed).toBe(9500); expect(v.gap).toBe(500); expect(C.issuesFor(s, sales, { account: 'TikTok', month: '2026-11', asOf: '2026-11-30' }).issues.some(i => i.type === 'ecart_montant' && i.cents === 500)).toBe(true);
  });
  it('18 € nets avec une commission descriptive : 18 € pris en compte, commission non déduite une seconde fois', () => {
    const sales = [sale('a', '2026-11-03', 2000, 200)]; let s = entry(C.emptyState(), { orderRef: 'a', type: 'sale', cents: 1800, effectDate: '2026-11-05' }); s = entry(s, { orderRef: 'a', type: 'fee', cents: -200, descriptive: true, effectDate: '2026-11-05' });
    const v = sum(s, sales).sales; expect(v.confirmed).toBe(1800); expect(v.gap).toBe(0);
  });
  it('remboursement : écriture négative qui diminue le net, sans toucher au stock', () => {
    const sales = [sale('a', '2026-11-03', 2000, 0)]; let s = entry(C.emptyState(), { orderRef: 'a', type: 'sale', cents: 2000, effectDate: '2026-11-05' }); s = entry(s, { orderRef: 'a', type: 'refund', cents: -500, effectDate: '2026-11-20' });
    expect(sum(s, sales).sales.confirmed).toBe(1500); expect(sum(s, sales).movements.byType.refund).toBe(-500);
  });
  it('deux comptes avec la même référence : aucun rapprochement croisé', () => {
    const sales = [sale('a', '2026-11-03', 2000, 0, 'Vinted', 'REF1')]; const s = entry(C.emptyState(), { account: 'TikTok', orderRef: 'REF1', type: 'sale', cents: 2000, effectDate: '2026-11-05' });
    expect(C.getCloseSummary(s, sales, { account: 'Vinted', month: '2026-11', asOf: '2026-11-30' }).sales.rows[0].linked).toBe(false);
  });
  it('une référence qui désigne deux ventes ne rapproche rien automatiquement', () => {
    const sales = [sale('a', '2026-11-03', 1800, 0, 'TikTok', 'DUP'), sale('b', '2026-11-04', 1800, 0, 'TikTok', 'DUP')]; const s = entry(C.emptyState(), { orderRef: 'DUP', type: 'sale', cents: 1800, effectDate: '2026-11-05' });
    expect(sum(s, sales).sales.rows.every(r => !r.linked)).toBe(true);
  });
  it('deux achats de 18 € le même jour, sans référence : deux candidats, aucun lien automatique', () => {
    const sales = [sale('a', '2026-11-03', 1800, 0), sale('b', '2026-11-03', 1800, 0)]; const s = entry(C.emptyState(), { type: 'sale', cents: 1800, effectDate: '2026-11-04' });
    const r = C.issuesFor(s, sales, { account: 'TikTok', month: '2026-11', asOf: '2026-11-30' }), i = r.issues.find(x => x.type === 'a_rapprocher_ecriture');
    expect(i.suggestions.length).toBe(2); expect(i.ambiguous).toBe(true); expect(r.summary.sales.rows.every(x => !x.linked)).toBe(true);
  });
  it('un ajustement sans commande reste au niveau du compte', () => {
    const s = entry(C.emptyState(), { type: 'fee', cents: -300, effectDate: '2026-11-12' }); const r = C.issuesFor(s, [], { account: 'TikTok', month: '2026-11', asOf: '2026-11-30' });
    expect(r.issues.some(i => i.type === 'ajustement_non_ventile')).toBe(true);
  });
});

describe('Clôture : virements', () => {
  it('un virement de 400 € s\'affiche à part, sans être soustrait des ventes du mois', () => {
    let s = C.addPayout(C.emptyState(), { account: 'TikTok', cents: 40000, sentAt: '2026-11-15' }); const sales = [sale('a', '2026-11-03', 2000, 0)];
    const v = sum(s, sales); expect(v.payouts.total).toBe(40000); expect(v.sales.recorded).toBe(2000); expect(v.payouts.list[0].state).toBe('non_verifie');
  });
  it('380 € confirmés en banque pour 400 € : écart de virement de 20 €, pas un écart de vente', () => {
    let s = C.addPayout(C.emptyState(), { account: 'TikTok', cents: 40000, sentAt: '2026-11-15' }); const id = s.payouts[0].id; s = C.confirmBank(s, id, { status: 'different', cents: 38000, date: '2026-11-17', actor: 'moi', at: 'T' });
    const r = C.issuesFor(s, [], { account: 'TikTok', month: '2026-11', asOf: '2026-11-30' }); const i = r.issues.find(x => x.type === 'virement_a_verifier'); expect(i.cents).toBe(2000); expect(r.summary.payouts.list[0].gap).toBe(2000);
  });
  it('virement non confirmé en banque : « non vérifié » et la période reste clôturable', () => {
    const s = C.addPayout(C.emptyState(), { account: 'TikTok', cents: 40000, sentAt: '2026-11-15' }); const r = C.closePeriod(s, [], { account: 'TikTok', month: '2026-11', asOf: '2026-11-30', opId: 'o1', now: 'T1' });
    expect(r.error).toBe(null); expect(C.periodStatus(r.state, { account: 'TikTok', currency: 'EUR', month: '2026-11' }).status).toBe('closed');
  });
});

describe('Clôture : imports', () => {
  const CSV = 'ID écriture;Commande;Type;Montant;Devise;Date;Statut\nT1;a;Vente;18,00;EUR;03/11/2026;Réglé\nT2;a;Commission;-2,00;EUR;03/11/2026;Réglé\n';
  it('aperçu avant validation : lignes reconnues, rejetées, doublons', () => {
    const p = C.previewFinanceImport(C.emptyState(), { text: CSV + 'T3;b;Vente;abc;EUR;03/11/2026;Réglé\nT1;a;Vente;18,00;EUR;03/11/2026;Réglé\n', account: 'TikTok' });
    expect(p.entries.length).toBe(2); expect(p.rejected[0].reason).toBe('montant_illisible'); expect(p.duplicates.length).toBe(1);
  });
  it('même relevé importé deux fois : aucune écriture ni montant doublé', () => {
    const a = C.commitFinanceImport(C.emptyState(), C.previewFinanceImport(C.emptyState(), { text: CSV, account: 'TikTok' }), 'op1', 'T').state, p2 = C.previewFinanceImport(a, { text: CSV, account: 'TikTok' });
    expect(p2.sameFile).toBe(true); expect(C.commitFinanceImport(a, p2, 'op2').state).toBe(a); expect(a.entries.length).toBe(2);
    expect(C.commitFinanceImport(a, C.previewFinanceImport(C.emptyState(), { text: CSV, account: 'TikTok' }), 'op1').noop).toBe(true);
  });
  it('même écriture dans un autre fichier avec un identifiant : mise à jour tracée, pas de doublon ; un remboursement n\'est pas un doublon', () => {
    let s = C.commitFinanceImport(C.emptyState(), C.previewFinanceImport(C.emptyState(), { text: CSV, account: 'TikTok' }), 'o1', 'T1').state;
    const csv2 = 'ID écriture;Commande;Type;Montant;Devise;Date;Statut\nT1;a;Vente;17,50;EUR;03/11/2026;Réglé\nT9;a;Remboursement;-5,00;EUR;20/11/2026;Réglé\n';
    s = C.commitFinanceImport(s, C.previewFinanceImport(s, { text: csv2, account: 'TikTok' }), 'o2', 'T2').state; expect(s.entries.length).toBe(3); const t1 = s.entries.find(e => e.extId === 'T1'); expect(t1.cents).toBe(1750); expect(t1.rev).toBe(2); expect(t1.history.length).toBe(1);
  });
  it('sans identifiant : mêmes date et montant = candidat doublon exclu des totaux, pas de fusion silencieuse', () => {
    const csv = 'Commande;Type;Montant;Date\nx;Vente;18,00;03/11/2026\n'; let s = C.commitFinanceImport(C.emptyState(), C.previewFinanceImport(C.emptyState(), { text: csv, account: 'TikTok' }), 'o1', 'T').state;
    const p = C.previewFinanceImport(s, { text: csv + '\n', account: 'TikTok', hash: 'autre' }); expect(p.dupCandidates.length).toBe(1); s = C.commitFinanceImport(s, p, 'o2').state; expect(s.entries.length).toBe(2);
    const sales = [sale('x', '2026-11-03', 1800, 0)]; expect(sum(s, sales).sales.confirmed).toBe(1800);                    /* une seule écriture compte */
  });
  it('colonnes introuvables : refus propre', () => { expect(C.previewFinanceImport(C.emptyState(), { text: 'a;b\n1;2\n', account: 'X' }).error).toBe('colonnes_introuvables'); });
  it('un virement dans le fichier va dans Virements, pas dans les écritures', () => {
    const p = C.previewFinanceImport(C.emptyState(), { text: 'Type;Montant;Date;ID écriture\nVirement;400,00;15/11/2026;P1\n', account: 'TikTok' }); expect(p.payouts.length).toBe(1); expect(p.entries.length).toBe(0);
  });
});

describe('Clôture : résolution, versions, export', () => {
  it('un lien manuel ne peut pas dépasser le montant de l\'écriture', () => {
    const s = entry(C.emptyState(), { type: 'sale', cents: 1800, effectDate: '2026-11-04' }), id = s.entries[0].id;
    expect(C.resolveIssue(s, 'entry:' + id, { kind: 'link', entryId: id, saleId: 'a', cents: 2500 }, '', null).error).toBe('montant_depasse');
    const r = C.resolveIssue(s, 'entry:' + id, { kind: 'link', entryId: id, saleId: 'a', cents: 1800, actor: 'moi', at: 'T' }, 'capture', 0); expect(r.error).toBe(null);
    expect(sum(r.state, [sale('a', '2026-11-03', 1800, 0)]).sales.rows[0].confirmed).toBe(1800);
    expect(C.resolveIssue(r.state, 'entry:' + id, { kind: 'document', cause: 'test' }, '', 0).error).toBe('revision');
  });
  it('clôture avec exceptions : le motif est enregistré ; sans exceptions, les écarts bloquent', () => {
    const s = entry(C.emptyState(), { type: 'fee', cents: -300, effectDate: '2026-11-12' }), o = { account: 'TikTok', month: '2026-11', asOf: '2026-11-30', now: 'T1' };
    expect(C.closePeriod(s, [], o).error).toBe('ecarts_non_traites'); const r = C.closePeriod(s, [], Object.assign({ withExceptions: true, reason: 'frais à voir' }, o));
    expect(r.snapshot.exceptions[0].reason).toBe('frais à voir'); expect(C.periodStatus(r.state, { account: 'TikTok', currency: 'EUR', month: '2026-11' }).status).toBe('closed_exceptions');
  });
  it('clôturer deux fois avec le même identifiant crée une seule version', () => {
    const o = { account: 'TikTok', month: '2026-11', asOf: '2026-11-30', opId: 'same', now: 'T1' }; const a = C.closePeriod(C.emptyState(), [], o), b = C.closePeriod(a.state, [], o);
    expect(b.noop).toBe(true); expect(C.periodStatus(a.state, { account: 'TikTok', currency: 'EUR', month: '2026-11' }).snapshots.length).toBe(1);
  });
  it('relevé tardif après la clôture : la version figée ne change pas ; on signale ce qui aurait changé', () => {
    const o = { account: 'TikTok', month: '2026-11', asOf: '2026-11-30', now: 'T1' }, a = C.closePeriod(C.emptyState(), [], o); let s = a.state;
    s = C.addManualEntry(s, { account: 'TikTok', type: 'sale', cents: 1000, effectDate: '2026-11-20', stage: 'settled' }, 'T2').state; s = C.addManualEntry(s, { account: 'TikTok', type: 'sale', cents: 500, effectDate: '2026-12-02', stage: 'settled' }, 'T2').state;
    const L = C.lateEntries(s, { account: 'TikTok', currency: 'EUR', month: '2026-11' }); expect(L.map(x => x.kind).sort()).toEqual(['aurait_change', 'mouvement_suivant']); expect(C.periodStatus(s, { account: 'TikTok', currency: 'EUR', month: '2026-11' }).snapshots[0].summary.movements.settled).toBe(0);
    const r = C.reopenPeriod(s, { account: 'TikTok', currency: 'EUR', month: '2026-11', reason: 'relevé reçu' }); expect(r.error).toBe(null); expect(C.periodStatus(r.state, { account: 'TikTok', currency: 'EUR', month: '2026-11' }).snapshots.length).toBe(1);
  });
  it('l\'export neutralise les formules et garde les montants lisibles', () => {
    expect(C.safeCell('=1+1')).toBe("'=1+1"); expect(C.safeCell('-3,10')).toBe('-3,10'); expect(C.safeCell('@cmd')).toBe("'@cmd"); expect(C.safeCell('a;b')).toBe('"a;b"');
    const s = entry(C.emptyState(), { type: 'fee', cents: -300, effectDate: '2026-11-12' }), r = C.issuesFor(s, [], { account: 'TikTok', month: '2026-11', asOf: '2026-11-30' }); expect(C.csvExport(r.summary, r.issues)).toContain('Récapitulatif de rapprochement Max');
  });
  it('un mouvement financier ne crée jamais de vente', () => {
    const s = entry(C.emptyState(), { orderRef: 'inconnue', type: 'sale', cents: 1800, effectDate: '2026-11-04' }); expect(C.issuesFor(s, [], { account: 'TikTok', month: '2026-11', asOf: '2026-11-30' }).issues.some(i => i.type === 'a_rapprocher_ecriture')).toBe(true);
    expect(sum(s, []).sales.count).toBe(0);
  });
});
