import { app } from '../state.js';
import { $ } from './core.js';

/* ---------- accessibilité des fenêtres ---------- */
/* Une fenêtre ouverte (fiche, outil, accueil, connexion, scanner) est annoncée comme un dialogue, reçoit le focus,
   garde Tab à l'intérieur, rend le reste de la page inactif (`inert`), et rend le focus au bouton d'origine à sa fermeture. */
const shc = $('shc'), appEl = $('app');
shc.setAttribute('role', 'dialog');
shc.setAttribute('aria-modal', 'true');
shc.tabIndex = -1;
for (const [id, label] of [['auth', 'Se connecter'], ['scan', 'Scanner un QR']]) {
  const el = $(id); if (!el) continue;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t(label));
}
const wel = $('welcome'); if (wel) wel.tabIndex = -1;

/* couches, de la plus haute à la plus basse : [élément, conteneur du focus] */
const layers = () => [[$('sheet'), shc], [$('welcome'), $('welcome')], [$('auth'), $('auth')], [$('scan'), $('scan')]].filter(([el]) => el && !el.hidden);
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const focusables = c => [...c.querySelectorAll(FOCUSABLE)].filter(e => !e.closest('[hidden]') && e.getAttribute('aria-hidden') !== 'true');

let opener = null, wasOpen = false;
function sync() {
  const L = layers(), open = L.length > 0;
  if (open) { appEl.setAttribute('inert', ''); appEl.setAttribute('aria-hidden', 'true'); }
  else { appEl.removeAttribute('inert'); appEl.removeAttribute('aria-hidden'); }
  if (open && !wasOpen) {
    const a = document.activeElement;
    opener = a && a !== document.body && !a.closest('#sheet,#welcome,#auth,#scan') ? a : null;
    const c = L[0][1];
    if (c && c.focus) c.focus({ preventScroll: true });
  } else if (!open && wasOpen) {
    if (opener && opener.isConnected) { try { opener.focus({ preventScroll: true }); } catch (e) { /* élément disparu */ } }
    opener = null;
  }
  wasOpen = open;
}

/* titre de la fenêtre = son premier titre h2 */
function title() {
  const h = shc.querySelector('.sh h2');
  if (h) { h.id = 'shc_t'; shc.setAttribute('aria-labelledby', 'shc_t'); shc.removeAttribute('aria-label'); }
  else { shc.removeAttribute('aria-labelledby'); shc.setAttribute('aria-label', t('Fenêtre')); }
}
new MutationObserver(title).observe(shc, { childList: true });
title();

const mo = new MutationObserver(sync);
for (const id of ['sheet', 'welcome', 'auth', 'scan']) { const el = $(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); }
sync();

/* Tab reste dans la fenêtre du dessus */
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const L = layers(); if (!L.length) return;
  const c = L[0][1], items = focusables(c);
  if (!items.length) { e.preventDefault(); c.focus({ preventScroll: true }); return; }
  const first = items[0], last = items[items.length - 1], a = document.activeElement;
  if (!c.contains(a) || a === c) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
});
app.a11ySync = sync;
