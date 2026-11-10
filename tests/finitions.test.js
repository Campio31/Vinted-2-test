import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '..');
let nav, core;
beforeAll(async () => {
  await demarrer(150);
  nav = await import('../src/modules/nav.js');
  core = await import('../src/modules/settings-core.js');
});

describe('M2 : fenêtres accessibles', () => {
  it('les fenêtres sont annoncées comme des dialogues', () => {
    expect($('shc').getAttribute('role')).toBe('dialog');
    expect($('shc').getAttribute('aria-modal')).toBe('true');
    for (const id of ['auth', 'scan', 'welcome']) expect($(id).getAttribute('role'), id).toBe('dialog');
  });

  it('ouverture : titre, focus dans la fenêtre, reste de la page inactif', async () => {
    nav.go('tools'); await tick(10);
    const ouvreur = $('tl'); ouvreur.focus();
    await app.openTool('treso'); await tick(20);
    expect($('sheet').hidden).toBe(false);
    expect($('app').hasAttribute('inert')).toBe(true);
    expect($('app').getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe($('shc'));
    const h = $($('shc').getAttribute('aria-labelledby'));
    expect(h && h.textContent.length).toBeGreaterThan(2);
  });

  it('Tab reste dans la fenêtre, dans les deux sens', () => {
    const items = [...$('shc').querySelectorAll('button,a[href],input,select,textarea,summary')].filter(e => !e.closest('[hidden]'));
    expect(items.length).toBeGreaterThan(1);
    const first = items[0], last = items[items.length - 1];
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    const ev2 = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(ev2);
    expect(document.activeElement).toBe(last);
  });

  it('fermeture : la page redevient active et le focus revient au bouton d\'origine', async () => {
    $('sheet').hidden = true; await tick(20);
    expect($('app').hasAttribute('inert')).toBe(false);
    expect($('app').hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe($('tl'));
  });

  it('l\'accueil rend lui aussi le reste inactif', async () => {
    app.openWelcome(); await tick(20);
    expect($('app').hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe($('welcome'));
    $('welcome').hidden = true; await tick(20);
    expect($('app').hasAttribute('inert')).toBe(false);
  });
});

describe('m1, m2, m3 : cibles, texte, étiquettes', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8') + fs.readFileSync(path.join(root, 'src/mode.css'), 'utf8');
  it('aucun texte sous 12 px', () => {
    const petits = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => +m[1]).filter(v => v < 12);
    expect(petits).toEqual([]);
  });
  it('les questions de l\'aide et les champs heure font au moins 44 px', () => {
    expect(css).toMatch(/details>summary\{min-height:44px/);
    expect(css).toMatch(/input\[type=time\],input\[type=datetime-local\][^{]*\{min-height:44px\}/);
  });
  it('les étiquettes des cartes passent à la ligne au lieu d\'être coupées', () => {
    expect(css).toMatch(/\.li \.m small\{display:flex;flex-wrap:wrap/);
  });
});

describe('m4 : champ e-mail', () => {
  it('est un vrai champ e-mail', () => {
    expect($('au_mail').type).toBe('email');
    expect($('au_mail').getAttribute('autocomplete')).toMatch(/email/);
  });
});

describe('m5 : compteur de résultats', () => {
  it('affiche le nombre de résultats et un bouton pour effacer la recherche', async () => {
    nav.go('list'); app.filt = 'Tous'; await tick(10);
    const q = 'nike';
    const attendu = app.P.filter(p => p.statut !== 'Vendu' && app.matchFilt(p) && app.searchScore(p, app.searchToks(q)) >= 0).length;
    $('q').value = q; $('q').dispatchEvent(new Event('input', { bubbles: true })); await tick(300);
    const l = $('lst').querySelector('.srh');
    expect(l).toBeTruthy();
    expect(l.textContent).toContain(String(attendu));
    expect(l.textContent).toContain('nike');
    $('q_clr').click(); await tick(20);
    expect($('q').value).toBe('');
    expect($('lst').querySelector('.srh')).toBeNull();
  });
});

describe('m6 : point hors ligne ou en attente', () => {
  it('règles : seulement avec un compte, hors ligne, ou en attente depuis plus de 2 minutes', () => {
    const base = { cloud: true, user: { id: 1 }, online: true, pending: 0, since: 0, now: 1e6 };
    expect(app.dotState({ ...base, cloud: false })).toBeNull();
    expect(app.dotState({ ...base, user: null })).toBeNull();
    expect(app.dotState(base)).toBeNull();
    expect(app.dotState({ ...base, online: false })).toMatchObject({ k: 'offline' });
    expect(app.dotState({ ...base, pending: 3, since: 1e6 - 60e3 })).toBeNull();
    expect(app.dotState({ ...base, pending: 3, since: 1e6 - 130e3 })).toMatchObject({ k: 'waiting', n: 3 });
  });
  it('le point apparaît hors ligne et disparaît au retour du réseau', () => {
    expect($('offdot').hidden).toBe(true);
    app.cloud = true; app.user = { id: 'u1' }; app.online = false; app.refreshStatus();
    expect($('offdot').hidden).toBe(false);
    expect($('offdot').getAttribute('aria-label').length).toBeGreaterThan(3);
    app.online = true; app.refreshStatus();
    expect($('offdot').hidden).toBe(true);
    app.cloud = false; app.user = null;
  });
  it('un clic sur le point mène aux Réglages', () => {
    app.cloud = true; app.user = { id: 'u1' }; app.online = false; app.refreshStatus();
    $('offdot').click();
    expect(app.view).toBe('set');
    app.online = true; app.cloud = false; app.user = null; app.refreshStatus();
  });
});

describe('réglages : une copie plus ancienne ne remplace pas un réglage récent', () => {
  const reset = () => { app.cfg = Object.assign({}, app.cfg, { goal: 0, _ts: {} }); };
  it('chaque modification garde sa date, et elle part avec les réglages', () => {
    reset();
    const avant = Date.now();
    app.setCfg({ goal: 500 }, true);
    expect(app.cfg._ts.goal).toBeGreaterThanOrEqual(avant);
    expect(core.syncCfg()._ts.goal).toBe(app.cfg._ts.goal);
  });
  it('une copie du serveur plus ancienne est ignorée', () => {
    reset(); app.setCfg({ goal: 500 }, true);
    core.applyCfg({ goal: 100, _ts: { goal: app.cfg._ts.goal - 5000 } });
    expect(app.cfg.goal).toBe(500);
  });
  it('une copie du serveur plus récente (modifiée sur un autre appareil) est appliquée', () => {
    reset(); app.setCfg({ goal: 500 }, true);
    const t = app.cfg._ts.goal + 5000;
    core.applyCfg({ goal: 900, _ts: { goal: t } });
    expect(app.cfg.goal).toBe(900);
    expect(app.cfg._ts.goal).toBe(t);
  });
  it('une copie ancienne sans dates ne remplace pas un réglage modifié ici', () => {
    reset(); app.setCfg({ goal: 500 }, true);
    core.applyCfg({ goal: 100 });
    expect(app.cfg.goal).toBe(500);
  });
  it('sur un appareil neuf (rien de modifié), le serveur gagne, avec ou sans dates', () => {
    reset();
    core.applyCfg({ goal: 300 });
    expect(app.cfg.goal).toBe(300);
    reset();
    core.applyCfg({ goal: 400, _ts: { goal: Date.now() - 1000 } });
    expect(app.cfg.goal).toBe(400);
  });
  it('restaurer une sauvegarde ne ramène pas d\'anciennes dates', async () => {
    reset();
    const exp = await import('../src/modules/export-import.js');
    exp.restoreSettings({ settings: { goal: 800, _ts: { goal: 1 } } });
    expect(app.cfg.goal).toBe(800);
    expect(app.cfg._ts.goal).toBeGreaterThan(1e12);
  });
});
