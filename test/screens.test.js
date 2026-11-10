import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/state.js';
import { demarrer } from './helpers.js';

/* Ouvre chaque écran et chaque fenêtre : une erreur de nom ou d'import casserait ici, pas chez toi. */
const NE_PAS_OUVRIR = ['scan', 'qr_scan']; // caméra
let nav, tools, sel;
beforeAll(async () => {
  await demarrer(200);
  nav = await import('../src/modules/nav.js');
  tools = await import('../src/modules/tools-index.js');
  sel = await import('../src/modules/selection.js');
});

describe('onglets', () => {
  for (const v of ['add', 'quick', 'sales', 'list', 'dash', 'set']) it('onglet ' + v, () => { nav.go(v); expect(document.getElementById('ttl').textContent.length).toBeGreaterThan(0); });
});

describe('fenêtres des outils', () => {
  it('liste tous les outils', () => { expect(tools.TOOLS.length).toBeGreaterThan(10); });
  for (const k of ['qr', 'trophees', 'fisc', 'complete', 'merge', 'depenses', 'treso', 'rapport', 'trash', 'wrapped', 'calcom', 'rappels', 'defis', 'importo', 'aide', 'help', 'news', 'idee', 'planning', 'vintage', 'buyers', 'lives', 'cohortes', 'tranches', 'courbe', 'seuil', 'fourn', 'boutique', 'confort']) {
    it('outil ' + k, async () => { expect(NE_PAS_OUVRIR).not.toContain(k); await app.openTool(k); expect(document.getElementById('sheet').hidden).toBe(false); expect(document.getElementById('shc').innerHTML.length).toBeGreaterThan(50); });
  }
});

describe('fiche d\'une pièce', () => {
  for (const mode of [undefined, 'edit', 'sell', 'ann', 'del']) it('mode ' + (mode || 'fiche') + ' (en stock)', () => { const p = app.P.find(x => x.statut === 'Disponible'); app.openSheet(p.id, mode); expect(document.getElementById('shc').innerHTML.length).toBeGreaterThan(50); });
  for (const mode of [undefined, 'esale', 'ret']) it('mode ' + (mode || 'fiche') + ' (vendue)', () => { const p = app.P.find(x => x.statut === 'Vendu' && x.acheteur); app.openSheet(p.id, mode); expect(document.getElementById('shc').innerHTML.length).toBeGreaterThan(50); });
  it('la fiche montre les pièces similaires', () => { const p = app.P.find(x => x.statut === 'Vendu'); app.openSheet(p.id); expect(document.getElementById('shc').textContent).toContain(t('Pièces similaires déjà vendues')); });
});

describe('bilan', () => {
  it('affiche toutes les cartes et le menu Personnaliser', () => { nav.go('dash'); app.renderDash(); expect(document.querySelectorAll('#dsh > .card, #dsh > .hero').length).toBeGreaterThan(8); expect(document.querySelector('[data-dcust]')).toBeTruthy(); });
  it('masquer une carte la cache', () => { app.setCfg({ dash: { hide: ['S:Par catégorie'], order: [] } }); app.renderDash(); const h = [...document.querySelectorAll('#dsh h3[data-sec]')].find(x => x.dataset.sec === 'Par catégorie'); expect(h.closest('.card').style.display).toBe('none'); });
});

describe('sélection multiple', () => {
  it('active le mode et ouvre les actions', () => { nav.go('list'); sel.selSet(true); app.P.filter(p => p.statut === 'Disponible').slice(0, 3).forEach(p => sel.SEL.add(p.id)); document.querySelector('[data-sa=act]').click(); expect(document.querySelectorAll('#shc [data-sx]').length).toBe(6); sel.selSet(false); });
});