import { describe, it, expect, beforeAll } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const visibles = () => [...document.getElementById('dsh').children].filter(el => el.style.display !== 'none');
const cfg = p => { app.cfg = Object.assign({}, app.cfg, p); };

describe('mode simple et avancé', () => {
  beforeAll(async () => { await demarrer(120); });

  it('mode avancé (défaut) : tous les outils, comme avant', async () => {
    const { TOOLS } = await import('../src/modules/tools-index.js');
    expect(app.cfg.mode).not.toBe('simple');
    expect(app.toolsView().list).toHaveLength(TOOLS.length);
  });

  it('les 6 outils majeurs sont fixes, dans les deux modes', async () => {
    const { TOOLS } = await import('../src/modules/tools-index.js');
    const ATTENDU = ['colis', 'trophees', 'qr', 'vintage', 'buyers', 'rapport'];
    cfg({ mode: 'simple', onb: { statut: 'part', canal: 'vinted', obj: 'comp' } });
    expect(app.essentials()).toEqual(ATTENDU);
    cfg({ mode: 'simple', onb: { statut: 'micro', canal: 'both', obj: 'vivre' } });
    expect(app.essentials()).toEqual(ATTENDU);
    expect(app.toolsView().list).toHaveLength(TOOLS.length);
  });

  it('l\'onglet Outils : 6 grandes tuiles, puis tous les autres en liste compacte, dans les deux modes', async () => {
    const { TOOLS, openTools } = await import('../src/modules/tools-index.js');
    openTools();
    expect(app.view).toBe('tools');
    expect(document.querySelectorAll('#tv .tool')).toHaveLength(6);
    expect(document.querySelectorAll('#tv .tool2')).toHaveLength(TOOLS.length - 6);
    document.querySelector('#tv [data-mode="avance"]').click();
    expect(app.cfg.mode).toBe('avance');
    expect(document.querySelectorAll('#tv .tool')).toHaveLength(6);
    expect(document.querySelectorAll('#tv .tool, #tv .tool2')).toHaveLength(TOOLS.length);
  });
});
describe('écran « Aujourd\'hui »', () => {
  it('montre 4 cases, cohérentes avec le stock', async () => {
    const { todayData, todayHTML } = await import('../src/modules/simple-mode.js');
    const d = todayData();
    const h = document.createElement('div'); h.innerHTML = todayHTML();
    expect(h.querySelectorAll('.tdt')).toHaveLength(4);
    expect(d.toPub).toBe(app.P.filter(p => p.statut === 'Disponible' && !p.pub).length);
    expect(d.stale).toBeLessThanOrEqual(app.P.filter(p => p.statut === 'Disponible').length);
  });

  it('mode simple : seul « Aujourd\'hui » est visible, le bilan complet au clic', () => {
    cfg({ mode: 'simple' });
    app.renderDash();
    let v = visibles();
    expect(v.filter(el => el.classList.contains('tdy'))).toHaveLength(1);
    expect(v.filter(el => !el.classList.contains('tdy') && el.tagName !== 'BUTTON')).toHaveLength(0);
    document.querySelector('#dsh [data-td="full"]').click();
    v = visibles();
    expect(v.length).toBeGreaterThan(5);
    document.querySelector('#dsh [data-td="compact"]').click();
    expect(visibles().filter(el => !el.classList.contains('tdy') && el.tagName !== 'BUTTON')).toHaveLength(0);
  });

  it('mode avancé : « Aujourd\'hui » s\'ajoute en haut, le reste du bilan reste là', () => {
    cfg({ mode: 'avance' });
    app.renderDash();
    expect(document.getElementById('dsh').firstElementChild.classList.contains('tdy')).toBe(true);
    expect(visibles().length).toBeGreaterThan(5);
  });

  it('un compte avec du stock ne reçoit pas l\'accueil', async () => {
    await new Promise(r => setTimeout(r, 1500));
    expect(document.getElementById('welcome').hidden).toBe(true);
  });
});
