import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
let W, R, texts;
const mois = (d = new Date()) => d.toISOString().slice(0, 7);
const moisAvant = (n = 1) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 7); };

beforeAll(async () => {
  await demarrer(200);
  W = await import('../src/modules/wrapped.js');
  R = await import('../src/modules/wrapped-ready.js');
  /* un « canvas » qui note les textes écrits, pour vérifier ce qui sort dans les images */
  texts = [];
  const ctx = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 10 }) : k === 'fillText' ? s => { texts.push(String(s)); } : () => {}, set: () => true });
  HTMLCanvasElement.prototype.getContext = () => ctx;
  document.fonts = { load: () => Promise.resolve() };
});
afterEach(() => { vi.useRealTimers(); });

describe('Wrapped : nouvelles données', () => {
  const per = moisAvant(1);
  it('la pièce star est celle qui a rapporté le plus', () => {
    const d = W.wrappedData(per);
    const S = app.P.filter(p => p.statut === 'Vendu' && (p.dv || '').startsWith(per));
    const best = Math.max(...S.map(p => (p.pv || 0) - (p.achat || 0) - (p.frais || 0)));
    expect(d.star).toBeTruthy();
    expect((d.star.pv || 0) - (d.star.achat || 0) - (d.star.frais || 0)).toBe(best);
  });
  it('compare à la période d\'avant', () => {
    const d = W.wrappedData(per);
    expect(d.prev.per).toBe(moisAvant(2));
    const S0 = app.P.filter(p => p.statut === 'Vendu' && (p.dv || '').startsWith(moisAvant(2)));
    expect(d.prev.n).toBe(S0.length);
    const ca0 = S0.reduce((a, p) => a + (p.pv || 0), 0);
    if (ca0) expect(d.prev.dCa).toBe(Math.round((d.ca - ca0) / ca0 * 100));
    expect(W.prevPer('2026-01')).toBe('2025-12');
    expect(W.prevPer('2026')).toBe('2025');
  });
  it('trouve le jour de la semaine où tu vends le plus', () => {
    const d = W.wrappedData(per), S = app.P.filter(p => p.statut === 'Vendu' && (p.dv || '').startsWith(per)), n = [0, 0, 0, 0, 0, 0, 0];
    S.forEach(p => { n[new Date(p.dv + 'T12:00:00').getDay()]++; });
    expect(d.wk.n).toBe(Math.max(...n));
  });
});

describe('Wrapped : images et mode discret', () => {
  it('les nouvelles images sont là', async () => {
    texts.length = 0;
    const d = W.wrappedData(moisAvant(1)), out = await W.makeWrapped(d, false);
    const all = texts.join(' | ');
    expect(out.length).toBeGreaterThanOrEqual(7);
    expect(all).toContain(t('Ta pièce star'));
    expect(all).toContain(t('Par rapport à {p}', { p: '' }).trim().slice(0, 8));
    expect(all).toContain(t('Ton jour de vente'));
    expect(all).toMatch(/€/);
  });
  it('en mode discret, aucun euro n\'est écrit', async () => {
    texts.length = 0;
    const d = W.wrappedData(moisAvant(1)), out = await W.makeWrapped(d, true);
    expect(out.length).toBeGreaterThanOrEqual(7);
    expect(texts.join(' | ')).not.toMatch(/€|EUR/);
    expect(texts.join(' | ')).toMatch(/%/);
  });
  it('la case « Mode discret » est retenue et masque les euros dans l\'aperçu', async () => {
    localStorage.removeItem('wrDisc');
    W.openWrapped(moisAvant(1));
    expect($('shc').textContent).toMatch(/€/);
    const c = $('wr_disc'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem('wrDisc'))).toBe(true);
    expect($('shc').querySelector('.kpis').textContent).not.toMatch(/€/);
    expect($('shc').querySelector('.kpis').textContent).toMatch(/%/);
    $('wr_disc').checked = false; $('wr_disc').dispatchEvent(new Event('change', { bubbles: true }));
    $('sheet').hidden = true;
  });
});

describe('Wrapped prêt automatiquement', () => {
  const fixe = iso => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };
  it('annoncé pendant les 7 premiers jours du mois, pour le mois écoulé', () => {
    localStorage.removeItem('wrSeen');
    const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 3, 10);
    fixe(first.toISOString());
    expect(R.wrappedDue()).toBe(moisAvant(1));
  });
  it('pas annoncé au milieu du mois', () => {
    localStorage.removeItem('wrSeen');
    const now = new Date(); fixe(new Date(now.getFullYear(), now.getMonth(), 15, 10).toISOString());
    expect(R.wrappedDue()).toBeNull();
  });
  it('en janvier, c\'est le Wrapped de l\'année', () => {
    localStorage.removeItem('wrSeen');
    const y = new Date().getFullYear();
    fixe(new Date(y + 1, 0, 2, 10).toISOString());
    expect(R.wrappedDue()).toBe(String(y));
  });
  it('rappel du jour, bandeau et notification, puis plus rien une fois vu', () => {
    localStorage.removeItem('wrSeen');
    const now = new Date(); fixe(new Date(now.getFullYear(), now.getMonth(), 3, 10).toISOString());
    const per = moisAvant(1);
    expect(app.rappelsList().some(r => r.k === 'wrapped:' + per && r.tool === 'wrapped')).toBe(true);
    $('cb').hidden = true;
    R.checkWrappedBanner();
    expect($('cb').hidden).toBe(false);
    expect($('cb').textContent).toMatch(/Wrapped/);
    const items = [];
    app.pushExtra.forEach(f => f((o, h, m) => new Date(now.getFullYear(), now.getMonth(), 3 + o, h, m || 0), (tag, d, body) => items.push({ tag, d, body })));
    expect(items.map(i => i.tag)).toContain('wrapped:' + per);
    $('cb_go').click();
    expect($('sheet').hidden).toBe(false);
    expect(R.wrappedDue()).toBeNull();
    expect(app.rappelsList().some(r => String(r.k).startsWith('wrapped:'))).toBe(false);
    $('sheet').hidden = true;
  });
  it('fermer le bandeau suffit à le faire disparaître pour de bon', () => {
    localStorage.removeItem('wrSeen');
    const now = new Date(); fixe(new Date(now.getFullYear(), now.getMonth(), 4, 10).toISOString());
    $('cb').hidden = true;
    R.checkWrappedBanner();
    $('cb_x').click();
    expect(R.wrappedDue()).toBeNull();
  });
});
