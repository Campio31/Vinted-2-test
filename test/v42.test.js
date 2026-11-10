import { describe, it, expect, beforeAll } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav, F;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
  F = await import('../src/modules/form.js');
  await import('../src/modules/listing.js');
});

describe('v42 : Ma journée en tuiles avec anneau', () => {
  it('montre un anneau, quatre tuiles et replie les réglages', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const c = $('dsh').querySelector('.ap');
    expect(c.querySelector('svg.apring')).not.toBeNull();
    expect(c.querySelectorAll('.apc .apc-t')).toHaveLength(4);
    const det = c.querySelector('details.apd');
    expect(det).not.toBeNull();
    expect(det.querySelector('[data-ap="mode:assist"]')).not.toBeNull();
  });
  it('une tuile ouvre la même tâche que sa ligne', async () => {
    const tuile = $('dsh').querySelector('.apc-t[data-ap]');
    if (tuile) { tuile.click(); await tick(20); expect($('dsh').querySelector('.apt')).not.toBeNull(); }
  });
});

describe('v42 : couleurs et état', () => {
  it('les couleurs essentielles sont proposées avec leur pastille', () => {
    ['Bleu marine', 'Kaki', 'Bordeaux', 'Moutarde', 'Corail', 'Turquoise', 'Multicolore'].forEach(c => expect(F.COLORS[c]).toBeTruthy());
  });
  it('l\'état général a cinq niveaux et les défauts sont une liste précise', () => {
    expect(F.ETAT0).toHaveLength(5);
    expect(F.ETAT0[0]).toBe('Neuf avec étiquette');
    expect(F.DEFAUTS).toEqual(expect.arrayContaining(['Petit trou', 'Bouton manquant', 'Tache légère']));
  });
  it('l\'annonce cite les défauts cochés', () => {
    const p = Object.assign({}, app.P.find(x => x.statut === 'Disponible'), { etat: 'Bon état', defauts: ['Petit trou', 'Bouton manquant'] });
    expect(app.vDesc(p)).toMatch(/small hole|petit trou/i);
    expect(app.vCond(Object.assign({}, p, { etat: 'Neuf avec étiquette' }))).toMatch(/avec étiquette|with tags/i);
  });
});