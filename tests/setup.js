/* Prépare un « navigateur » de test : le HTML de l'appli, les scripts classiques, une base IndexedDB factice. */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll } from 'vitest';

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
document.body.innerHTML = body;

window.STOCK_CONFIG = {};
window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.scrollTo = () => {};
Element.prototype.scrollIntoView = function () {}; // pas de défilement dans jsdom
window.print = () => {};
globalThis.matchMedia = window.matchMedia;
globalThis.__RELEASE__ = 'test';
/* i18n.js est un script classique : on l'exécute dans la fenêtre comme le ferait le navigateur */
window.eval(fs.readFileSync(path.join(root, 'public/i18n.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(root, 'public/vintage.js'), 'utf8'));
for (const k of ['I18N', 'K', 't', 'tn', 'tv', 'cn', 'cnFr', 'detectLang', 'VINTAGE']) globalThis[k] = window[k];
globalThis.qrcode = () => ({ addData() {}, make() {}, createSvgTag: () => '<svg></svg>', getModuleCount: () => 21, isDark: () => false });
globalThis.XLSX = { utils: {}, read() { return { SheetNames: [], Sheets: {} } } };
globalThis.jsQR = () => null;globalThis.CanvasRenderingContext2D = window.CanvasRenderingContext2D = class { fillText() {} };
