import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

let V;
const $ = id => document.getElementById(id);
const CSV = 'ID de commande;Statut de la commande;SKU vendeur;Quantité;Sous-total du SKU après remise\n1;Terminée;A1;1;20,00 €\n2;Annulée;B2;1;10,00 €\n';
const attendre = async f => { for (let i = 0; i < 60; i++) { if (f()) return; await new Promise(r => setTimeout(r, 20)); } };
const choisir = (txt, name) => { const inp = $('lv_f'); Object.defineProperty(inp, 'files', { value: [new File([txt], name || 'export.csv', { type: 'text/csv' })], configurable: true }); };
beforeAll(async () => { await demarrer(60); V = await import('../src/modules/live-view.js'); });
afterEach(() => { app.setCfg({ liveco: null }, true); $('sheet').hidden = true; });

describe('Live connecté : import de fichier (écran)', () => {
  it('la carte d\'import est sur l\'onglet Connexions', () => {
    V.openLiveco('conn'); expect($('lv_f')).toBeTruthy(); expect($('shc').textContent).toContain(t('Importer un export de commandes'));
  });
  it('sans fichier, rien ne se passe ; avec un fichier et un nom de live, le live apparaît', async () => {
    V.openLiveco('conn'); $('lv_t').value = 'Live test'; document.querySelector('[data-lv="import"]').click(); expect(app.cfg.liveco && app.cfg.liveco.v ? app.cfg.liveco.sessions.length : 0).toBe(0);
    choisir(CSV); document.querySelector('[data-lv="import"]').click();
    await attendre(() => app.cfg.liveco && app.cfg.liveco.lines && Object.keys(app.cfg.liveco.lines).length === 2);
    expect(Object.keys(app.cfg.liveco.lines).length).toBe(2); expect(app.cfg.liveco.sessions[0].title).toBe('Live test'); expect($('shc').textContent).toContain('Live test');
  });
  it('un fichier sans les bonnes colonnes affiche le message et n\'écrit rien', async () => {
    V.openLiveco('conn'); $('lv_m').value = 'none'; choisir('a;b\n1;2\n'); document.querySelector('[data-lv="import"]').click();
    await attendre(() => $('lv_ir'));
    expect($('lv_ir').textContent).toContain(t('Colonnes introuvables : il faut au moins le numéro de commande et la référence (ou le nom) du produit. Colonnes lues : {c}', { c: 'a, b' })); expect(app.cfg.liveco && app.cfg.liveco.v ? Object.keys(app.cfg.liveco.lines).length : 0).toBe(0);
  });
});
