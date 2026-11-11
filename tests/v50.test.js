import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const lire = f => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');

/* public/env.js : version test (isolée) et version publiée (inchangée). On l'exécute avec une fenêtre factice. */
const code = lire('public/env.js');

function faux(path, cfg) {
  class Storage { constructor() { this.m = new Map(); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } clear() { this.m.clear(); } }
  const ouverts = [];
  class IDBFactory { open(n, v) { ouverts.push([n, v]); return {}; } deleteDatabase(n) { ouverts.push(['del', n]); return {}; } }
  const els = [];
  const document = { readyState: 'complete', title: 'Syno', documentElement: { dataset: {} }, head: { appendChild: e => els.push(e) }, body: { appendChild: e => els.push(e) }, createElement: t => ({ tag: t, setAttribute() {}, id: '', textContent: '' }), querySelector: () => null, addEventListener() {} };
  const w = { location: { pathname: path, href: 'https://x.github.io' + path }, STOCK_CONFIG: cfg, Storage, IDBFactory, localStorage: new Storage(), sessionStorage: new Storage(), indexedDB: new IDBFactory(), document };
  new Function('window', code.replace('window.stockEnvInit(window);', '').replace('window.stockEnvInit = function', 'window.stockEnvInit = function'))(w);
  return { w, ouverts, els };
}
const CFG = () => ({ supabaseUrl: 'https://prod.supabase.co', supabaseKey: 'k', sentryDsn: 'https://d', vapidPublicKey: 'v', feedbackEmail: 'a@b.c' });

describe('version test', () => {
  it('le site publié n\'est pas touché', () => {
    const { w, ouverts } = faux('/Vinted-2/', CFG());
    expect(w.stockEnvInit(w)).toBe('prod');
    expect(w.STOCK_CONFIG.supabaseUrl).toBe('https://prod.supabase.co');
    w.localStorage.setItem('cfg', '1');
    expect(w.localStorage.m.has('cfg')).toBe(true);
    w.indexedDB.open('stock-friperie', 2);
    expect(ouverts[0]).toEqual(['stock-friperie', 2]);
  });
  it('une adresse en -test passe en mode test : serveur, suivi et notifications coupés', () => {
    const { w } = faux('/Vinted-2-test/', CFG());
    expect(w.stockEnvInit(w)).toBe('test');
    expect(w.STOCK_CONFIG.supabaseUrl).toBe('');
    expect(w.STOCK_CONFIG.supabaseKey).toBe('');
    expect(w.STOCK_CONFIG.sentryDsn).toBe('');
    expect(w.STOCK_CONFIG.vapidPublicKey).toBe('');
    expect(w.STOCK_CONFIG.feedbackEmail).toBe('a@b.c');
  });
  it('en mode test, les données du navigateur sont rangées à part', () => {
    const { w, ouverts } = faux('/Vinted-2-test/', CFG());
    w.localStorage.setItem('prod', 'garde'); /* écrit avant le mode test : reste intact */
    w.stockEnvInit(w);
    w.localStorage.setItem('cfg', '{"a":1}');
    expect(w.localStorage.m.has('cfg')).toBe(false);
    expect(w.localStorage.m.has('T_cfg')).toBe(true);
    expect(w.localStorage.getItem('cfg')).toBe('{"a":1}');
    w.localStorage.removeItem('cfg');
    expect(w.localStorage.m.has('T_cfg')).toBe(false);
    w.localStorage.setItem('x', '1');
    w.localStorage.clear();
    expect(w.localStorage.m.has('prod')).toBe(true);   /* clear() n'efface que les clés du site test */
    expect(w.localStorage.m.has('T_x')).toBe(false);
    w.indexedDB.open('stock-friperie', 2);
    w.indexedDB.deleteDatabase('stock-friperie');
    expect(ouverts).toEqual([['T_stock-friperie', 2], ['del', 'T_stock-friperie']]);
  });
  it('un projet Supabase de test peut être indiqué dans config.js', () => {
    const c = CFG(); c.test = { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'kt' };
    const { w } = faux('/Vinted-2-test/', c);
    w.stockEnvInit(w);
    expect(w.STOCK_CONFIG.supabaseUrl).toBe('https://test.supabase.co');
    expect(w.STOCK_CONFIG.supabaseKey).toBe('kt');
  });
  it('un domaine perso peut déclarer le mode test avec env: \'test\'', () => {
    const c = CFG(); c.env = 'test';
    const { w, els } = faux('/', c);
    expect(w.stockEnvInit(w)).toBe('test');
    expect(els.some(e => e.id === 'envb' && /TEST/.test(e.textContent))).toBe(true);
    expect(w.document.title).toBe('Syno TEST');
  });
  it('index.html charge env.js juste après config.js, et le service worker a un cache par site', () => {
    const html = lire('index.html');
    expect(html.indexOf('src="env.js"')).toBeGreaterThan(html.indexOf('src="config.js"'));
    expect(html.indexOf('src="env.js"')).toBeLessThan(html.indexOf('src="i18n.js"'));
    const sw = lire('public/sw.js');
    expect(sw).toMatch(/const KEY = VERSION \+ '@' \+ SCOPE/);
    expect(sw).not.toMatch(/caches\.open\(VERSION\)/);
  });
});