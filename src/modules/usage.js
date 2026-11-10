import { app } from '../state.js';
import { $, LSg, LSs } from './core.js';
import { CFG0 } from './settings-core.js';

/* ---------- mesures d'usage anonymes ---------- */
/* Seuls des compteurs partent vers le serveur : « tel écran ou outil ouvert N fois tel jour », rattachés au compte pour compter les utilisateurs actifs.
   Jamais le contenu du stock, des ventes, des pseudos ou des prix. Désactivable dans Outils > Confort.
   Les compteurs attendent dans le navigateur (localStorage) tant que l'utilisateur est hors-ligne ou non connecté. */
Object.assign(CFG0, { stats: true });

const KEY = 'usageQ';
let timer = null;
let busy = false;
let dead = false;
let visitDay = '';

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const clean = s => String(s).toLowerCase().replace(/[^a-z0-9_:.-]/g, '').slice(0, 40);
export const usageOn = () => !!app.cloud && app.cfg.stats !== false;
export const usageQueue = () => LSg(KEY, {});

export function track(name) {
  if (!usageOn()) return;
  const k = clean(name);
  if (!k) return;
  const q = usageQueue(), id = today() + '|' + k;
  if (!(id in q) && Object.keys(q).length >= 300) return;
  q[id] = (q[id] || 0) + 1;
  LSs(KEY, q);
  clearTimeout(timer);
  timer = setTimeout(flushUsage, 3000);
}

export async function flushUsage() {
  if (busy || dead || !usageOn() || !app.sb || !app.user || !app.online) return;
  const q = usageQueue(), ids = Object.keys(q).slice(0, 50);
  if (!ids.length) return;
  busy = true;
  try {
    const r = await app.sb.rpc('track_usage', { p_events: ids.map(id => { const [d, k] = id.split('|'); return { d, k, n: q[id] }; }) });
    if (r.error) {
      /* script admin-setup.sql pas encore lancé : on arrête d'essayer jusqu'au prochain démarrage */
      if (r.error.code === '42883' || r.error.code === 'PGRST202' || /could not find the function|does not exist/i.test(r.error.message || '')) dead = true;
      return;
    }
    const left = usageQueue();
    ids.forEach(id => { left[id] = (left[id] || 0) - q[id]; if (left[id] <= 0) delete left[id]; });
    LSs(KEY, left);
  } catch (e) { /* sans conséquence : on réessaiera */ } finally { busy = false; }
}

export function usageReset() { LSs(KEY, {}); }
app.usageReset = usageReset;

function visit() {
  if (visitDay === today()) return;
  visitDay = today();
  track('_visite');
}

/* écrans de la barre du bas */
$('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.v) track('vue:' + b.dataset.v); }, true);
/* outils (grille Outils, tableau de bord, raccourcis : tout passe par openTool) */
const openTool25 = app.openTool;
app.openTool = function (k) { track('outil:' + k); return openTool25.apply(this, arguments); };

visit();
document.addEventListener('visibilitychange', () => { if (!document.hidden) visit(); });
window.addEventListener('online', () => setTimeout(flushUsage, 1000));
setInterval(flushUsage, 30000);
setTimeout(flushUsage, 6000);
