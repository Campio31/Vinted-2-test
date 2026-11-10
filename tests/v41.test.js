import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav, buy, goals, dash;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
  buy = await import('../src/modules/buyers.js');
  goals = await import('../src/modules/goals.js');
  dash = await import('../src/modules/dashboard.js');
});
afterEach(() => { $('sheet').hidden = true; });

describe('v41 : calendrier, connexion, fiches, acheteurs, réglages', () => {
  it('les cartes à collectionner n\'utilisent plus les noms de classes du calendrier', async () => {
    const K = await import('../src/modules/cartes.js');
    const html = K.cardTile(K.CARDS[0], { e: 3, n: 2 });
    expect(html).not.toMatch(/class="(cdx|cdr|cdet)\b/);
    expect(html).toContain('class="cnx"');
    expect(html).toContain('class="ces e3"');
  });
  it('les champs de connexion sont désactivés tant que l\'écran de connexion est fermé', async () => {
    await import('../src/modules/auth-guard.js');
    expect($('auth').hidden).toBe(true);
    expect($('au_pw').disabled).toBe(true);
    $('auth').hidden = false; await tick(10);
    expect($('au_pw').disabled).toBe(false);
    $('auth').hidden = true; await tick(10);
    expect($('au_pw').disabled).toBe(true);
  });
  it('les fiches à compléter affichent le code du produit', async () => {
    const p = app.P.find(x => x.statut === 'Disponible' && x.marque && !/^non /i.test(x.marque));
    const sauv = Object.assign({}, p);
    Object.assign(p, { code: 'ZZ-123', grade: '', etat: '' });
    await import('../src/modules/complete.js');
    app.openComplete(); await tick(10);
    expect($('shc').textContent).toContain('ZZ-123');
    Object.assign(p, sauv);
  });
  it('le pseudo propose les acheteurs qui ont déjà acheté', () => {
    const ventes = app.P.filter(x => x.statut === 'Vendu').slice(0, 2);
    ventes[0].acheteur = '@marie_p'; ventes[1].acheteur = '@marc_d';
    const sg = buy.buyerSuggest('mar').map(b => b.k);
    expect(sg).toContain('marie_p');
    expect(sg).toContain('marc_d');
    expect(buy.buyerSuggest('marie').map(b => b.k)).toEqual(['marie_p']);
    expect(buy.buyerSuggest('zzzz')).toEqual([]);
    const f = document.createElement('input'); f.id = 's_ps'; document.body.appendChild(f);
    f.value = 'mar'; f.dispatchEvent(new Event('input', { bubbles: true }));
    const chips = document.querySelectorAll('#s_ps_w [data-bsug]');
    expect(chips.length).toBeGreaterThanOrEqual(2);
    chips[0].click();
    expect(f.value.startsWith('@mar')).toBe(true);
    f.remove(); $('s_ps_w') && $('s_ps_w').remove();
  });
  it('Réglages : ouvrir une carte referme la précédente', async () => {
    await import('../src/modules/settings-fold.js');
    nav.go('set'); await tick(30);
    const hs = [...document.querySelectorAll('#v-set h3[data-sec]')];
    expect(hs.length).toBeGreaterThan(2);
    hs[0].click(); hs[1].click();
    const ouvertes = [...document.querySelectorAll('#v-set .sfold')].filter(c => !c.classList.contains('shut'));
    expect(ouvertes).toHaveLength(1);
    expect(ouvertes[0].querySelector('h3').dataset.sec).toBe(hs[1].dataset.sec);
  });
});

describe('v41 : Stock et Vente', () => {
  it('le Stock ne montre que « Tous », « Sélection » et « Filtres »', async () => {
    app.filt = 'Tous'; nav.go('list'); app.renderList(); await tick(30);
    const chips = [...$('flt').querySelectorAll('.chip')].map(c => c.dataset.flt || c.dataset.selmode || c.dataset.fadv);
    expect(chips).toEqual(['Tous', '1', '1']);
    expect($('flt').querySelector('[data-flt="Tous"]').classList.contains('on')).toBe(true);
    $('flt').querySelector('[data-fadv]').click();
    expect($('shc').querySelector('[data-fg="st"][data-fv="Disponible"]')).not.toBeNull();
    $('shc').querySelector('[data-fg="st"][data-fv="Disponible"]').click();
    $('fl_ok').click(); await tick(10);
    expect($('flt').querySelector('[data-fadv]').classList.contains('on')).toBe(true);
    expect($('flt').querySelector('[data-flt="Tous"]').classList.contains('on')).toBe(false);
    $('flt').querySelector('[data-flt="Tous"]').click(); await tick(10);
    expect($('flt').querySelector('[data-flt="Tous"]').classList.contains('on')).toBe(true);
  });
  it('la Vente ne montre que « Toutes » et « Filtres »', async () => {
    nav.go('sales'); await tick(30);
    expect([...$('sflt').querySelectorAll('.chip')]).toHaveLength(2);
    expect($('sflt').querySelector('[data-sf="all"]')).not.toBeNull();
    expect($('sflt').querySelector('[data-sfadv]')).not.toBeNull();
  });
});

describe('v41 : Bilan et objectifs', () => {
  it('le Bilan a un bouton Filtres et sait filtrer par plateforme et par période', async () => {
    nav.go('dash'); app.period = 0; app.cptFilt = ''; app.renderDash(); await tick(30);
    const bouton = $('per').querySelector('[data-badv]');
    expect(bouton).not.toBeNull();
    const hero = () => $('dsh').querySelector('.hero .s').textContent;
    const tout = hero();
    bouton.click();
    const pf = [...$('shc').querySelectorAll('[data-fg="pf"]')];
    expect(pf.length).toBeGreaterThan(0);
    pf[pf.length - 1].click();
    $('fl_ok').click(); await tick(10);
    expect($('per').querySelector('.fact')).not.toBeNull();
    $('per').querySelector('[data-fclr="*"]').click(); await tick(10);
    expect(hero()).toBe(tout);
    app.period = 90;
  });
  it('la période « ce mois-ci » commence au premier du mois', () => {
    app.period = 'mo';
    const r = dash.bilRange();
    expect(r.from).toMatch(/^\d{4}-\d{2}-01$/);
    app.period = 'yr';
    expect(dash.bilRange().from).toMatch(/^\d{4}-01-01$/);
    app.period = 90;
  });
  it('l\'objectif montre une projection au rythme actuel', () => {
    app.setCfg({ goal: 100000, goalMode: 'both', goalCA: 100000 }, true);
    const d = goals.goalCalc('net', 'm');
    expect(d.proj).toBeGreaterThanOrEqual(d.cur);
    expect(d.projPct).toBeCloseTo(d.proj / d.g, 5);
    const html = goals.goalHTML ? goals.goalHTML() : app.goalHTML();
    expect(html).toMatch(/Au rythme actuel|At the current pace/);
    app.setCfg({ goal: 0, goalCA: 0, goalMode: 'net' }, true);
  });
});
