import { describe, it, expect, beforeAll } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
let nav, tools, exp, pf;
beforeAll(async () => {
  await demarrer(150);
  nav = await import('../src/modules/nav.js');
  tools = await import('../src/modules/tools-index.js');
  exp = await import('../src/modules/export-import.js');
  pf = await import('../src/modules/platforms.js');
});

describe('objectifs et sauvegardes', () => {
  it('saisir un objectif le garde, même après un rechargement', () => {
    nav.go('set');
    const inp = $('c_goal');
    inp.value = '450'; inp.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.cfg.goal).toBe(450);
    expect(JSON.parse(localStorage.getItem('cfg')).goal).toBe(450);
  });

  it('restaurer une sauvegarde remet aussi les objectifs et les réglages', async () => {
    app.setCfg({ goal: 0, goalCA: 0, pf1: '' });
    const bk = { pieces: [{ id: 'r1', cat: 'Tshirt', marque: 'Nike', statut: 'Disponible' }], settings: { goal: 700, goalCA: 2000, pf1: 'Ma boutique', lang: 'it', remember: false } };
    await exp.importText(JSON.stringify(bk));
    expect(app.cfg.goal).toBe(700);
    expect(app.cfg.goalCA).toBe(2000);
    expect(app.cfg.pf1).toBe('Ma boutique');
    expect(app.cfg.lang).not.toBe('it'); // réglage propre à l'appareil : jamais remplacé
    expect($('is').textContent).toMatch(/restaur|restored/i);
  });

  it('une valeur vide dans la sauvegarde n\'efface pas un objectif déjà fixé', () => {
    app.setCfg({ goal: 500 });
    exp.restoreSettings({ settings: { goal: 0, goalY: 0, emb: 0.9 } });
    expect(app.cfg.goal).toBe(500);
    expect(app.cfg.emb).toBe(0.9);
  });
});

describe('plateformes au choix', () => {
  it('les réglages parlent de Plateforme 1 et 2, sans nommer Vinted ni TikTok', () => {
    app.setCfg({ pf1: '', pf2: '' });
    nav.go('set');
    const txt = $('cfgc').textContent;
    expect(txt).toContain(t('Plateforme {n}', { n: 1 }));
    expect(txt).toContain(t('Plateforme {n}', { n: 2 }));
    expect(txt).not.toMatch(/Vinted|TikTok/);
    expect($('lgc').textContent).not.toMatch(/Vinted/);
  });

  it('chaque utilisateur nomme ses plateformes, et l\'affichage suit partout', () => {
    nav.go('set');
    const a = $('c_pf1'); a.value = 'Leboncoin'; a.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.cfg.pf1).toBe('Leboncoin');
    expect(tv('Vinted')).toBe('Leboncoin');
    expect(tv('TikTok Live')).toBe('TikTok Live');
    app.setCfg({ pf2: 'Instagram' });
    expect(tv('TikTok Live')).toBe('Instagram');
    expect(pf.pfKey('  leboncoin ')).toBe('Vinted');
    expect(pf.pfKey('instagram')).toBe('TikTok Live');
    expect(pf.pfKey('Autre')).toBe('Autre');
    nav.go('sales');
    expect($('slst').textContent).toMatch(/Leboncoin|Instagram/);
    expect($('slst').textContent).not.toMatch(/Vinted|TikTok/);
  });

  it('sans nom choisi, les noms d\'origine restent', () => {
    app.setCfg({ pf1: '', pf2: '  ' });
    expect(tv('Vinted')).toBe('Vinted');
    expect(tv('TikTok Live')).toBe('TikTok Live');
  });
});

describe('pastille de synchronisation', () => {
  it('cachée sauf en cas de problème', () => {
    app.localState = 'ok'; app.refreshStatus();
    expect($('sync').hidden).toBe(true);
    app.localState = 'err'; app.refreshStatus();
    expect($('sync').hidden).toBe(false);
    expect($('sync').className).toBe('err');
    app.localState = 'ok'; app.refreshStatus();
    expect($('sync').hidden).toBe(true);
  });
});

describe('réglages et outils échangent leur place', () => {
  it('le bouton du haut ouvre les Réglages, l\'onglet du bas ouvre les Outils', () => {
    expect($('tl').getAttribute('aria-label')).toMatch(/Réglages|Settings/);
    const tabs = [...document.querySelectorAll('#nav button')].map(b => b.dataset.v);
    expect(tabs).toContain('tools');
    expect(tabs).not.toContain('set');
    $('tl').click();
    expect(app.view).toBe('set');
    document.querySelector('#nav [data-v="tools"]').click();
    expect(app.view).toBe('tools');
    expect($('ttl').textContent).toBe(t('Outils'));
    expect(document.querySelectorAll('#tv .tool').length).toBeGreaterThan(5);
  });
});

describe('outils déplacés ou retirés', () => {
  it('la liste ne contient plus les outils fusionnés ou retirés', () => {
    const k = tools.TOOLS.map(x => x.k);
    for (const x of ['importo', 'help', 'lives', 'cohortes', 'tranches', 'boutique', 'calcom', 'planning']) expect(k, x).not.toContain(x);
    expect(k).not.toContain('aide');
    for (const x of ['seuil', 'fourn', 'confort']) expect(k, x).not.toContain(x);
  });

  it('l\'import Excel ou CSV est dans les Réglages', async () => {
    nav.go('set');
    expect($('impo')).toBeTruthy();
    $('sheet').hidden = true;
    $('impo').click();
    expect($('sheet').hidden).toBe(false);
    $('sheet').hidden = true;
  });

  it('l\'aide contient les raccourcis', async () => {
    await app.openTool('aide');
    expect($('shc').querySelector('details kbd')).toBeTruthy();
    $('sheet').hidden = true;
  });

  it('le bilan montre le dernier live et la qualité des achats, sans la rentabilité par prix d\'achat', () => {
    app.setCfg({ dash: null });
    nav.go('dash'); app.renderDash();
    for (const k of ['live', 'cohorte']) {
      const c = document.querySelector(`#dsh [data-ck="${k}"]`);
      expect(c, k).toBeTruthy();
      expect(c.style.display, k).not.toBe('none');
    }
    expect(document.querySelector('#dsh [data-ck="tranches"]')).toBeNull();
  });
});

describe('formulaire Ajouter', () => {
  it('plus d\'indicateurs en haut, potentiel de vente à la fin, couleur et matière en menus propres', () => {
    nav.go('add');
    expect($('kp')).toBeNull();
    const kids = [...$('fadd').children];
    const pot = kids.findIndex(e => e.id === 'pot'), lastGrp = kids.map(e => e.classList.contains('grp')).lastIndexOf(true);
    expect(pot).toBeGreaterThan(lastGrp);
    /* v49 : 4 étapes ; couleur et matière sont dans l'étape 2, « Plus de détails » dans l'étape 4 */
    $('fadd').querySelector('[data-step="1"]').click();
    const secs = [...$('fadd').querySelectorAll('.grp')].map(g => g.dataset.sec);
    expect(secs).toContain('coul');
    expect(secs).toContain('mat');
    $('fadd').querySelector('[data-step="3"]').click();
    expect([...$('fadd').querySelectorAll('.grp')].map(g => g.dataset.sec)).toContain('det');
  });

  it('couleur et matière ne sont plus dans « Plus de détails »', () => {
    $('fadd').querySelector('[data-step="3"]').click();
    const det = [...$('fadd').querySelectorAll('.grp')].find(g => g.dataset.sec === 'det');
    det.querySelector('.gh').click();
    const body = $('fadd').querySelector('.grp[data-sec="det"] .gb');
    expect(body).toBeTruthy();
    expect(body.querySelector('[data-f="coul"]')).toBeNull();
    expect(body.querySelector('[data-f="mat"]')).toBeNull();
  });
});

describe('calendrier des ventes : temps forts et planning', () => {
  it('on peut regarder les mois à venir (temps forts et planning)', () => {
    app.calM = ''; app.calD = '';
    nav.go('dash'); app.renderDash();
    expect(document.querySelector('#dsh [data-cal="1"]').disabled).toBe(false);
  });

  it('marque les temps forts et la préparation, et détaille le jour choisi', () => {
    const ev = app.commEventsAll().find(e => e.date >= new Date().toISOString().slice(0, 10));
    app.calM = ev.date.slice(0, 7); app.calD = ev.date;
    nav.go('dash'); app.renderDash();
    expect(document.querySelectorAll('#dsh .cdc.ev').length).toBeGreaterThan(0);
    const det = document.querySelector('#dsh .cdet');
    expect(det).toBeTruthy();
    expect(det.textContent).toContain(t(ev.name));
    expect(det.querySelector('[data-tool="calcom"]')).toBeTruthy();
    expect(det.querySelector('[data-tool="planning"]')).toBeTruthy();
  });

  it('montre les jours de préparation avant un temps fort', () => {
    const ev = app.commEventsAll().find(e => e.date >= new Date().toISOString().slice(0, 10));
    const d = new Date(ev.date + 'T12:00:00'); d.setDate(d.getDate() - 1);
    app.calM = d.toISOString().slice(0, 7); app.calD = d.toISOString().slice(0, 10);
    app.renderDash();
    expect(document.querySelectorAll('#dsh .cdc.pre, #dsh .cdc.ev').length).toBeGreaterThan(0);
    expect(document.querySelector('#dsh .cdet').textContent).toMatch(/Préparation|Preparation/);
  });

  it('le planning apparaît dans le calendrier : point sur les jours prévus et créneaux du jour', () => {
    const ev = app.commEventsAll().find(e => e.date >= new Date().toISOString().slice(0, 10));
    const dow = new Date(ev.date + 'T12:00:00').getDay();
    app.setCfg({ plan: [{ id: 's1', j: dow, k: 'photo', h: '10:00', n: 'ballot' }] });
    app.calM = ev.date.slice(0, 7); app.calD = ev.date;
    app.renderDash();
    expect(document.querySelectorAll('#dsh .cdc.pl').length).toBeGreaterThan(0);
    expect(document.querySelector('#dsh .cdet').textContent).toMatch(/10:00|10h/);
    expect(document.querySelector('#dsh .cdet').textContent).toContain('ballot');
  });
});
