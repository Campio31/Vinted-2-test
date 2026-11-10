import { $ } from './core.js';

/* Le formulaire de connexion reste dans la page, caché. Certains téléphones y voient un champ de mot de passe et proposent
   « mot de passe » dès qu'on touche n'importe quel champ libre ailleurs (marque, pseudo, note…).
   Tant que l'écran de connexion est fermé, ses champs sont désactivés : les navigateurs les ignorent. */
const el = $('auth');
if (el) {
  const sync = () => el.querySelectorAll('input').forEach(i => { i.disabled = el.hidden; });
  sync();
  if (typeof MutationObserver !== 'undefined') new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['hidden'] });
}
