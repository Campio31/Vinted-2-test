import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const clic = sel => document.querySelector(sel).click();

describe('accueil d\'un nouveau compte', () => {
  beforeAll(async () => {
    await import('../src/main.js');
    await new Promise(r => setTimeout(r, 300));
  });

  it('démarre vide et propose l\'accueil', async () => {
    expect(app.P).toHaveLength(0);
    await new Promise(r => setTimeout(r, 1600));
    expect($('welcome').hidden).toBe(false);
    expect($('welcome').textContent).toContain(t('Question {i} sur {n}', { i: 1, n: 3 }));
  });

  it('3 questions, puis profil, objectif, mode simple et pièces d\'exemple', async () => {
    clic('[data-wo="micro"]');
    expect($('welcome').textContent).toContain(t('Question {i} sur {n}', { i: 2, n: 3 }));
    clic('[data-wo="live"]');
    expect($('welcome').textContent).toContain(t('Question {i} sur {n}', { i: 3, n: 3 }));
    expect(document.querySelector('[data-wgo]').disabled).toBe(true);
    clic('[data-wo="comp"]');
    expect(document.querySelector('[data-wgo]').disabled).toBe(false);
    clic('[data-wgo]');
    expect($('welcome').hidden).toBe(true);
    expect(app.cfg.onb).toMatchObject({ statut: 'micro', canal: 'live', obj: 'comp' });
    expect(app.cfg.mode).toBe('simple');
    expect(app.cfg.goal).toBe(500);
    await new Promise(r => setTimeout(r, 400));
    expect(app.P.length).toBeGreaterThan(5);
    expect(app.P.every(p => p.ex)).toBe(true);
    expect(app.view).toBe('dash');
  });

  it('« Aujourd\'hui » propose de supprimer les exemples, qui partent en un clic', async () => {
    app.renderDash();
    expect($('dsh').textContent).toContain('pièces d\'exemple');
    clic('#dsh [data-td="delex"]');
    /* la suppression est asynchrone : on attend qu'elle soit finie (jusqu'à 4 s si la machine est chargée) */
    for (let i = 0; i < 40 && app.P.some(p => p.ex); i++) await new Promise(r => setTimeout(r, 100));
    expect(app.P.filter(p => p.ex)).toHaveLength(0);
  });

  it('stock vide : « Aujourd\'hui » invite à ajouter une première pièce', () => {
    app.renderDash();
    expect($('dsh').textContent).toContain('Ajouter ma première pièce');
    expect($('dsh').querySelectorAll('.tdt')).toHaveLength(4);
  });

  it('« Passer » ne bloque personne', async () => {
    app.openWelcome();
    expect($('welcome').hidden).toBe(false);
    clic('[data-wskip]');
    expect($('welcome').hidden).toBe(true);
    expect(app.cfg.onb.skipped).toBe(1);
  });
});
