import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

let T, RV, CV;
const $ = id => document.getElementById(id);
const clic = sel => { const b = document.querySelector(sel); expect(b, sel).toBeTruthy(); b.click(); };
const val = (id, v) => { const e = $(id); expect(e, id).toBeTruthy(); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
beforeAll(async () => { await demarrer(60); T = await import('../src/modules/tools-index.js'); RV = await import('../src/modules/reception-view.js'); CV = await import('../src/modules/close-view.js'); });
afterEach(() => { app.setCfg({ recep: null, cloture: null }, true); $('sheet').hidden = true; });

describe('Réceptionner un carton (écrans)', () => {
  it('l\'outil est au menu ; un nouveau carton ouvre l\'étape 1', () => {
    expect(T.TOOLS.some(x => x.k === 'recep')).toBe(true); app.openTool('recep'); expect($('shc').textContent).toContain(t('Nouveau carton')); clic('[data-rc="new"]'); expect($('rc_b')).toBeTruthy();
  });
  it('parcours complet : 5 étapes, 4 brouillons créés, relance sans doublon', () => {
    const avant = app.P.length; RV.openReception(); clic('[data-rc="new"]');
    val('rc_b', 'Ballot test'); val('rc_s', 'Frip'); val('rc_c', '40'); clic('[data-rc="next"]');
    expect($('rc_nA')).toBeTruthy(); val('rc_nA', '3'); val('rc_nB', '1'); clic('[data-rc="next"]');
    expect($('rc_it')).toBeTruthy(); val('rc_iq', '1'); val('rc_in', 'tache'); clic('[data-rc="iadd"]'); expect($('shc').textContent).toContain('tache'); clic('[data-rc="next"]');
    clic('[data-rc="alldraft"]'); clic('[data-rc="next"]'); expect($('shc').textContent).toContain(t('Voici ce qui va être enregistré'));
    clic('[data-rc="confirm"]'); expect(app.P.length).toBe(avant + 4);
    const p = app.P.find(x => x.rec); expect(p.statut).toBe('Pas Disponible'); expect(p.brouillon).toBe(1); expect(p.ballot).toBe('Ballot test'); expect(p.achat).toBe(10);
    expect($('shc').textContent).toContain(t('Réception validée'));
    clic('[data-rc="list"]'); clic('[data-rc="open"]'); expect(app.P.length).toBe(avant + 4);
    app.P.filter(x => x.rec).forEach(x => app.remove(x.id));
  });
  it('« Reprendre plus tard » garde le brouillon à la même étape', () => {
    RV.openReception(); clic('[data-rc="new"]'); val('rc_b', 'Reprise'); clic('[data-rc="next"]'); clic('[data-rc="later"]'); expect(app.cfg.recep.items[0].step).toBe(2); expect(app.cfg.recep.items[0].ballot).toBe('Reprise');
    app.openTool('recep'); clic('[data-rc="open"]'); expect($('rc_nA')).toBeTruthy();
  });
  it('sans nom de ballot ou sans pièce comptée, la validation est refusée', () => {
    RV.openReception(); clic('[data-rc="new"]'); clic('[data-rc="next"]'); clic('[data-rc="next"]'); clic('[data-rc="next"]'); clic('[data-rc="next"]');
    expect(document.querySelector('[data-rc="confirm"]').disabled).toBe(true);
  });
});

describe('Clôture des ventes (écrans)', () => {
  it('l\'outil est au menu et affiche le compte, le mois et la situation', () => {
    expect(T.TOOLS.some(x => x.k === 'cloture')).toBe(true); app.openTool('cloture'); expect($('cl_a')).toBeTruthy(); expect($('cl_m')).toBeTruthy(); expect($('shc').textContent).toContain(t('Clôture des ventes'));
  });
  it('saisie d\'une écriture et d\'un virement, puis clôture avec le bon statut', () => {
    CV.openCloture(1); val('cl_m', '2026-11'); clic('[data-cl="step"][data-v="2"]'); $('cl_t').value = 'fee'; val('cl_am', '-3,10'); $('cl_dt').value = '2026-11-12'; clic('[data-cl="madd"]');
    expect(app.cfg.cloture.entries.length).toBe(1); expect(app.cfg.cloture.entries[0].cents).toBe(-310);
    $('cl_pm').value = '400'; $('cl_pd').value = '2026-11-15'; clic('[data-cl="padd"]'); expect(app.cfg.cloture.payouts[0].cents).toBe(40000);
    clic('[data-cl="step"][data-v="3"]'); expect($('shc').textContent).toContain(t('Ajustement non ventilé'));
    clic('[data-cl="step"][data-v="5"]'); expect($('shc').textContent).toContain(t('Clôturer avec exceptions')); $('cl_reason').value = 'frais à voir'; clic('[data-cl="close"]');
    expect(Object.values(app.cfg.cloture.periods)[0].status).toBe('closed_exceptions'); expect($('shc').textContent).toContain(t('Rouvrir (nouvelle version)'));
    clic('[data-cl="step"][data-v="4"]'); $('cl_bc_' + app.cfg.cloture.payouts[0].id).value = '380'; clic('[data-cl="bank"][data-v="received"]'); expect(Object.values(app.cfg.cloture.checks)[0].status).toBe('different');
  });
  it('un fichier CSV est lu en aperçu avant validation, sans rien écrire', async () => {
    CV.openCloture(1); val('cl_m', '2026-11'); clic('[data-cl="step"][data-v="2"]');
    const inp = $('cl_f'); Object.defineProperty(inp, 'files', { value: [new File(['ID écriture;Commande;Type;Montant;Date;Statut\nT1;a;Vente;18,00;03/11/2026;Réglé\n'], 'r.csv')], configurable: true }); clic('[data-cl="fprev"]');
    for (let i = 0; i < 60 && !$('shc').textContent.includes(t('Aperçu avant validation')); i++) await new Promise(r => setTimeout(r, 20));
    expect($('shc').textContent).toContain(t('Aperçu avant validation')); expect(app.cfg.cloture && app.cfg.cloture.entries ? app.cfg.cloture.entries.length : 0).toBe(0);
    clic('[data-cl="pcommit"]'); expect(app.cfg.cloture.entries.length).toBe(1);
  });
  it('aucune vente n\'est créée ni modifiée par la clôture', () => {
    const avant = JSON.stringify(app.P.map(p => [p.id, p.statut, p.pv, p.achat])); CV.openCloture(); clic('[data-cl="step"][data-v="5"]'); expect(JSON.stringify(app.P.map(p => [p.id, p.statut, p.pv, p.achat]))).toBe(avant);
  });
});
