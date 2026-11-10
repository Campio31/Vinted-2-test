import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '..');
let nav;
beforeAll(async () => {
  await demarrer(120);
  nav = await import('../src/modules/nav.js');
  app.histBootMs = 0;
});

describe('bouton Retour', () => {
  it('une fenêtre ouverte s\'ajoute à l\'historique, et Retour la ferme sans changer d\'onglet', async () => {
    nav.go('list'); nav.go('dash'); await tick(20);
    expect(history.state).toMatchObject({ max: 'view', v: 'dash' });
    await app.openTool('trash'); await tick(20);
    expect($('sheet').hidden).toBe(false);
    expect(history.state.max).toBe('sheet');
    history.back(); await tick(60);
    expect($('sheet').hidden).toBe(true);
    expect(app.view).toBe('dash');
    expect(history.state).toMatchObject({ max: 'view', v: 'dash' });
  });

  it('Retour revient à l\'onglet précédent, puis encore au précédent', async () => {
    nav.go('add'); nav.go('list'); nav.go('sales'); await tick(20);
    history.back(); await tick(60);
    expect(app.view).toBe('list');
    history.back(); await tick(60);
    expect(app.view).toBe('add');
  });

  it('fermer une fenêtre avec la croix ne laisse pas d\'entrée en trop', async () => {
    nav.go('dash'); await tick(20);
    const avant = history.length;
    await app.openTool('trash'); await tick(20);
    $('sheet').querySelector('[data-x]').click(); await tick(60);
    expect($('sheet').hidden).toBe(true);
    expect(history.state).toMatchObject({ max: 'view', v: 'dash' });
    await app.openTool('trash'); await tick(20);
    history.back(); await tick(60);
    expect(app.view).toBe('dash');
    expect(history.length).toBeGreaterThanOrEqual(avant);
  });
});

describe('brouillon du formulaire Ajouter', () => {
  it('la saisie est gardée pendant qu\'on la remplit', async () => {
    localStorage.removeItem('addDraft');
    nav.go('add');
    app.addForm.reset({ entree: '2026-10-30' });
    document.querySelector('#fadd [data-f="cat"][data-v="Sweat"]').click();
    await tick(450);
    const d = JSON.parse(localStorage.getItem('addDraft'));
    expect(d.cat).toBe('Sweat');
  });

  it('à la réouverture, la saisie est reprise, et on peut la jeter', async () => {
    const { restoreDraft } = await import('../src/modules/add-view.js');
    app.addForm.reset({ entree: '2026-10-30' }); await tick(450);
    localStorage.setItem('addDraft', JSON.stringify({ cat: 'Veste', marque: 'Nike', entree: '2020-01-01' }));
    restoreDraft();
    expect(app.addForm.state.cat).toBe('Veste');
    expect(app.addForm.state.marque).toBe('Nike');
    expect(app.addForm.state.entree).not.toBe('2020-01-01');
    expect($('toast').textContent).toContain('Saisie reprise');
    $('tu').click(); await tick(450);
    expect(app.addForm.state.marque).toBeUndefined();
    expect(localStorage.getItem('addDraft')).toBeNull();
  });

  it('un brouillon vide ou absent ne change rien, et ajouter la pièce efface le brouillon', async () => {
    const { restoreDraft } = await import('../src/modules/add-view.js');
    localStorage.removeItem('addDraft');
    app.addForm.reset({ entree: '2026-10-30' });
    restoreDraft();
    expect(app.addForm.dirty).toBe(false);
    app.addForm.reset({ entree: '2026-10-30', cat: 'Tshirt', marque: 'Nike', achat: '5', grade: 'A', taille: 'M', genre: 'Homme' });
    await tick(450);
    expect(localStorage.getItem('addDraft')).not.toBeNull();
    $('fok').click(); await tick(450);
    expect(localStorage.getItem('addDraft')).toBeNull();
  });
});

describe('colis à préparer', () => {
  it('un vieux colis n\'est plus à préparer (14 jours)', () => {
    const base = app.P.find(p => p.statut === 'Vendu');
    const j = n => Date.now() - n * 864e5;
    const a = Object.assign({}, base, { id: 'col-vieux', exp: undefined, vt: j(20) });
    const b = Object.assign({}, base, { id: 'col-recent', exp: undefined, vt: j(2) });
    const c = Object.assign({}, base, { id: 'col-parti', exp: '2026-10-29', vt: j(1) });
    app.P.push(a, b, c);
    const ids = app.colisList().map(p => p.id);
    expect(ids).toContain('col-recent');
    expect(ids).not.toContain('col-vieux');
    expect(ids).not.toContain('col-parti');
    app.P = app.P.filter(p => !p.id.startsWith('col-'));
  });
});

describe('contrastes', () => {
  const css = fs.readFileSync(path.join(root, 'src/mode.css'), 'utf8');
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const tok = n => css.match(new RegExp('--' + n + ':(#[0-9A-Fa-f]{6})'))[1];
  it('textes secondaire, vert et rouge lisibles en mode clair (4,5 pour 1)', () => {
    for (const fond of ['#FFFFFF', '#F1F2F4', '#E9EAED']) {
      expect(ratio(tok('mute'), fond)).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(tok('mint'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tok('red'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
  it('pastilles pleines lisibles en mode sombre', () => {
    expect(ratio('#0E0F11', '#3FBF8A')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#0E0F11', '#F0605F')).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(/data-theme="dark"\] \.pill\.g-A/);
  });
});

describe('config.js frais au chargement (service worker)', () => {
  it('config.js passe d\'abord par le réseau, le reste d\'abord par le cache', async () => {
    const src = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    const H = {}; const reseau = []; const caches = { open: async () => ({ put() {} }), match: async () => 'cache', keys: async () => [], delete: async () => true };
    const ctx = { self: { addEventListener: (t, f) => { H[t] = f; }, registration: {}, clients: {} }, caches, URL, Request, Promise, location: { origin: 'https://x.test' }, fetch: (req, opt) => { reseau.push([req.url, opt && opt.cache]); return Promise.resolve({ ok: true, clone: () => ({}) }); } };
    vm.runInNewContext(src, ctx);
    const rep = url => new Promise(res => { H.fetch({ request: { method: 'GET', url }, respondWith: p => res(p) }); });
    await rep('https://x.test/Vinted-2/config.js');
    expect(reseau[0]).toEqual(['https://x.test/Vinted-2/config.js', 'no-store']);
    const autre = await rep('https://x.test/Vinted-2/i18n.js');
    expect(autre).toBe('cache');
    expect(reseau[1][1]).toBeUndefined(); // les autres fichiers : cache d'abord, le réseau ne fait que rafraîchir
  });
});

describe('Réglages : sections, à propos, légal', () => {
  it('4 sections, sans texte de développeur', () => {
    nav.go('set');
    const t = [...document.querySelectorAll('#v-set .shd')].map(h => h.textContent.trim());
    expect(t).toEqual(['Compte', 'Préférences', 'Mes données', 'Aide et informations'].map(x => window.t(x)));
    expect($('sy').textContent).not.toMatch(/config\.js|SYNCHRONISATION|\.md/);
  });
  it('À propos : version, contact, pages légales', () => {
    nav.go('set');
    const a = $('abo');
    expect(a.textContent).toMatch(/v\d+/);
    expect(a.querySelector('a[href="confidentialite.html"]')).toBeTruthy();
    expect(a.querySelector('a[href="conditions.html"]')).toBeTruthy();
    expect(a.querySelector('#ab_idee, a[href^="mailto:"]')).toBeTruthy();
  });
  it('l\'écran de connexion renvoie vers les deux pages', () => {
    const l = [...$('auth').querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(l).toEqual(expect.arrayContaining(['conditions.html', 'confidentialite.html']));
  });
  it('les deux pages légales existent, avec ou sans les passages « À COMPLÉTER » (une fois remplis, ils disparaissent)', () => {
    for (const f of ['confidentialite.html', 'conditions.html']) {
      const h = fs.readFileSync(path.join(root, 'public', f), 'utf8');
      expect(h).toMatch(/<title>/);
      expect(h).toMatch(/Dernière mise à jour/);
      expect(h.length).toBeGreaterThan(1500);
    }
    expect(fs.readFileSync(path.join(root, 'docs/compte-setup.sql'), 'utf8')).toMatch(/delete_my_account/);
  });
});

describe('suppression du compte et des données', () => {
  it('sans compte : effacer les données de l\'appareil, avec confirmation par la saisie de SUPPRIMER', () => {
    app.cloud = false;
    nav.go('set');
    expect($('ac_del').textContent).toMatch(/appareil|device/i);
    $('ac_del').click();
    expect($('ac_go').disabled).toBe(true);
    $('ac_t').value = 'oups'; $('ac_t').dispatchEvent(new Event('input', { bubbles: true }));
    expect($('ac_go').disabled).toBe(true);
    $('ac_t').value = ' supprimer '; $('ac_t').dispatchEvent(new Event('input', { bubbles: true }));
    expect($('ac_go').disabled).toBe(false);
    $('ac_no').click();
    expect($('ac_del')).toBeTruthy();
  });

  it('avec un compte : photos supprimées, fonction serveur appelée, puis tout est effacé ici', async () => {
    const { deleteAccountAndData } = await import('../src/modules/account.js');
    const rpc = vi.fn(async () => ({ error: null })), signOut = vi.fn(), removed = [];
    let n = 0;
    app.cloud = true; app.user = { id: 'u1', email: 'a@b.fr' };
    app.sb = { rpc, auth: { signOut }, storage: { from: () => ({ list: async () => (n++ === 0 ? { data: [{ id: 'f', name: 'p1.jpg' }] } : { data: [] }), remove: async names => { removed.push(...names); return {}; } }) } };
    localStorage.setItem('cfg', '{"goal":5}');
    await deleteAccountAndData();
    expect(removed).toEqual(['u1/p1.jpg']);
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(signOut).toHaveBeenCalled();
    expect(app.P).toHaveLength(0);
    expect(localStorage.getItem('cfg')).toBeNull();
  });

  it('si le script serveur n\'est pas lancé, rien n\'est effacé et le message est clair', async () => {
    const { deleteAccountAndData } = await import('../src/modules/account.js');
    app.cloud = true; app.user = { id: 'u1' }; app.P = [{ id: 'x', cat: 'Tshirt', marque: 'Nike', statut: 'Disponible' }];
    app.sb = { rpc: async () => ({ error: { code: 'PGRST202', message: 'Could not find the function' } }), auth: { signOut: vi.fn() }, storage: { from: () => ({ list: async () => ({ data: [] }), remove: async () => ({}) }) } };
    await expect(deleteAccountAndData()).rejects.toThrow(/pas encore activée|not yet|ancora/i);
    expect(app.P).toHaveLength(1);
  });
});
