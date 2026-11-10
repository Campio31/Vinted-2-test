import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav, goals, tools;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
  goals = await import('../src/modules/goals.js');
  tools = await import('../src/modules/tools-index.js');
});
afterEach(() => { $('sheet').hidden = true; });

describe('v43 : outils, corbeille, Bilan', () => {
  it('le Coach du lundi a disparu et la Corbeille est dans les Réglages', async () => {
    expect(tools.TOOLS.some(x => x.k === 'coach' || x.k === 'trash')).toBe(false);
    nav.go('dash'); app.renderDash(); await tick(30);
    expect($('dsh').querySelector('.coachc')).toBeNull();
    expect($('dsh').textContent).not.toMatch(/Rappels du jour|Today's reminders|Reminders of the day/i);
    const c = $('trc');
    expect(c).not.toBeNull();
    expect(c.querySelector('[data-tool="trash"]')).not.toBeNull();
    await app.openTool('trash'); await tick(30);
    expect($('sheet').hidden).toBe(false);
  });
  it('la légende des six mois n\'est plus écrasée par le style du logo', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    expect($('dsh').querySelector('.lgd')).not.toBeNull();
    expect($('dsh').querySelector('.mo + .lg')).toBeNull();
  });
  it('les trois premiers des catégories et des marques sont en or, argent, bronze', async () => {
    app.period = 0; app.renderDash(); await tick(30);
    const card = t => [...$('dsh').querySelectorAll('.card')].find(c => (c.querySelector('h3') || {}).textContent === t);
    for (const titre of ['Par catégorie', 'Meilleures marques']) {
      const c = card(I18N.lang === 'fr' ? titre : t(titre));
      expect(c, titre).toBeTruthy();
      const rows = [...c.querySelectorAll('.hb')];
      expect(rows[0].classList.contains('md-gold')).toBe(true);
      if (rows[1]) expect(rows[1].classList.contains('md-silver')).toBe(true);
      if (rows[2]) expect(rows[2].classList.contains('md-bronze')).toBe(true);
      if (rows[3]) expect(rows[3].className).not.toMatch(/md-/);
    }
    app.period = 90;
  });
});

describe('v43 : trésorerie et ballots', () => {
  it('un ballot acheté sort de la trésorerie, et on peut le supprimer', async () => {
    const tr = await import('../src/modules/treasury.js');
    app.setCfg({ ballotsBought: [] }, true);
    const avant = tr.tresoData().now;
    await app.openTreso(); await tick(20);
    $('bb_n').value = 'Ballot test'; $('bb_v').value = '120'; $('bb_d').value = new Date().toISOString().slice(0, 10);
    $('bb_add').click(); await tick(20);
    expect(app.cfg.ballotsBought).toHaveLength(1);
    expect(tr.tresoData().now).toBeCloseTo(avant - 120, 5);
    $('shc').querySelector('[data-bbd="0"]').click(); await tick(20);
    expect(app.cfg.ballotsBought).toHaveLength(0);
    expect(tr.tresoData().now).toBeCloseTo(avant, 5);
  });
});

describe('v43 : objectifs et courbe', () => {
  it('la projection est montrée d\'une autre couleur sur la barre et sur la courbe', async () => {
    const vendu = app.P.find(x => x.statut === 'Vendu' && (x.pv || 0) > (x.achat || 0)), dv0 = vendu.dv, auj = new Date().toISOString().slice(0, 10);
    vendu.dv = auj;
    app.setCfg({ goal: 100000, goalMode: 'net', goalCA: 0 }, true);
    const h = document.createElement('div'); h.innerHTML = goals.goalHTML ? goals.goalHTML() : app.goalHTML();
    const d = new Date(), fin = d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (!fin) expect(h.querySelector('.gau .gpjarc')).not.toBeNull();
    expect(h.querySelector('.gpj .pjd')).not.toBeNull();
    const an = await import('../src/modules/analytics.js');
    const c = document.createElement('div'); c.innerHTML = an.courbeBody();
    if (!fin) { expect(c.querySelector('path.pj')).not.toBeNull(); expect(c.querySelector('.td')).not.toBeNull(); }
    expect(c.querySelector('.crl .cr-a')).not.toBeNull();
    vendu.dv = dv0;
    app.setCfg({ goal: 0, goalCA: 0, goalMode: 'net' }, true);
  });
});

describe('v43 : Ajouter, onglets séparés', () => {
  it('état et défauts, ballot, made in et dates ont chacun leur onglet', async () => {
    nav.go('add'); app.addForm.draw(); await tick(20);
    /* v49 : 4 étapes ; un onglet de saisie par paramètre, rangés par étape */
    const etape = n => $('fadd').querySelector(`[data-step="${n}"]`).click();
    const a = k => $('fadd').querySelector(`[data-sec="${k}"]`);
    etape(2); expect(a('etat')).not.toBeNull();
    etape(1); expect(a('madein')).not.toBeNull();
    $('fadd').querySelector('[data-tg="madein"]').click();
    expect($('fadd').querySelector('[data-sec="madein"] input[data-k="madein"]')).not.toBeNull();
    etape(3);
    for (const k of ['ballot', 'dates', 'det']) expect(a(k), k).not.toBeNull();
    $('fadd').querySelector('[data-tg="dates"]').click();
    expect($('fadd').querySelector('[data-sec="dates"] input[data-k="entree"]')).not.toBeNull();
    expect($('fadd').querySelector('[data-sec="dates"] input[data-k="pub"]')).not.toBeNull();
    $('fadd').querySelector('[data-tg="ballot"]').click();
    expect($('fadd').querySelector('[data-sec="ballot"] [data-g="ballot"]')).not.toBeNull();
  });
  it('un vêtement neuf n\'affiche pas les défauts', async () => {
    nav.go('add'); app.addForm.draw(); await tick(10);
    $('fadd').querySelector('[data-step="2"]').click();
    $('fadd').querySelector('[data-tg="etat"]').click();
    expect($('fadd').querySelector('[data-g="defauts"]')).not.toBeNull();
    $('fadd').querySelector('[data-f="defauts"][data-v="Petit trou"]').click();
    expect(app.addForm.state.defauts).toContain('Petit trou');
    $('fadd').querySelector('[data-f="etat"][data-v="Neuf avec étiquette"]').click();
    expect($('fadd').querySelector('[data-sec="etat"].open')).not.toBeNull();
    expect($('fadd').querySelector('[data-g="defauts"]')).toBeNull();
    expect(app.addForm.state.defauts).toEqual([]);
    $('fadd').querySelector('[data-f="etat"][data-v="Bon état"]').click();
    expect($('fadd').querySelector('[data-g="defauts"]')).not.toBeNull();
  });
});

describe('v43 : Stock en vitrine, Vente en tuiles', () => {
  it('les cartes du stock sont des vitrines photo avec le statut sur la photo', async () => {
    app.filt = 'Tous'; nav.go('list'); app.renderList(); await tick(30);
    const t0 = $('lst').querySelector('.tl.vit');
    expect(t0).not.toBeNull();
    expect(t0.querySelector('.ph .im')).not.toBeNull();
    expect(t0.querySelector('.ph .stb')).not.toBeNull();
    expect(t0.querySelector('.ph .ov .ti[data-id]')).not.toBeNull();
    expect(t0.querySelector('.bd .vb')).not.toBeNull();
  });
  it('la Vente a quatre tuiles et compare à la période précédente quand une période est choisie', async () => {
    nav.go('sales'); app.salesFilter('all'); await tick(30);
    expect($('ssum').querySelectorAll('.sgt .stt')).toHaveLength(4);
    expect($('ssum').querySelector('.sev')).toBeNull();
    $('sflt').querySelector('[data-sfadv]').click(); await tick(10);
    const m = $('shc').querySelector('[data-fg="per"][data-fv="30"]');
    expect(m).not.toBeNull();
    m.click(); $('fl_ok').click(); await tick(20);
    expect($('ssum').querySelector('.sgc')).not.toBeNull();
    $('sflt').querySelector('[data-sf="all"]').click(); await tick(10);
  });
});

describe('v43 : Ma journée, tâches à glisser', () => {
  it('une tâche reportée à demain disparaît, puis on peut les remettre', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const w = $('dsh').querySelector('.apw');
    expect(w).not.toBeNull();
    expect(w.querySelector('.apbg')).not.toBeNull();
    const avant = $('dsh').querySelectorAll('.apw').length, id = w.dataset.tid;
    w.querySelector('.apz').click(); await tick(20);
    expect($('dsh').querySelectorAll('.apw').length).toBe(avant - 1);
    expect($('dsh').querySelector(`.apw[data-tid="${id}"]`)).toBeNull();
    expect($('dsh').querySelector('.apsn')).not.toBeNull();
    $('dsh').querySelector('[data-ap="unsnooze"]').click(); await tick(20);
    expect($('dsh').querySelectorAll('.apw').length).toBe(avant);
  });
  it('glisser vers la gauche reporte, vers la droite ouvre la tâche', async () => {
    nav.go('dash'); app.renderDash(); await tick(30);
    const w = () => $('dsh').querySelector('.apw .aph').closest('.apw');
    const geste = (el, dx) => {
      const mk = (type, x) => new MouseEvent(type, { bubbles: true, clientX: x, clientY: 10 });
      const ev = (type, x) => { const e = mk(type, x); Object.defineProperty(e, 'pointerId', { value: 1 }); Object.defineProperty(e, 'pointerType', { value: 'touch' }); el.dispatchEvent(e); };
      ev('pointerdown', 200); ev('pointermove', 200 + dx / 2); ev('pointermove', 200 + dx); ev('pointerup', 200 + dx);
    };
    const n = $('dsh').querySelectorAll('.apw').length;
    geste(w().querySelector('.aph'), -150); await tick(400);
    expect($('dsh').querySelectorAll('.apw').length).toBe(n - 1);
    $('dsh').querySelector('[data-ap="unsnooze"]').click(); await tick(20);
    expect($('dsh').querySelectorAll('.apw').length).toBe(n);
  });
});
