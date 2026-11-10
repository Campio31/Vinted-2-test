import { app } from '../state.js';
import { $, esc } from './core.js';
import { tx } from './storage.js';
import { VER } from './proofs.js';

/* ---------- Mon compte et mes données, À propos ---------- */
/* Exporter, supprimer le compte (et tout ce qu'il contient côté serveur), ou effacer les données de cet appareil.
   La suppression du compte appelle la fonction delete_my_account() du serveur (docs/compte-setup.sql). */
let asking = false;
const MOT = () => [t('SUPPRIMER'), 'SUPPRIMER', 'DELETE'].map(s => String(s).toUpperCase());

export function renderAccount() {
  const c = $('acc'); if (!c) return;
  if (c.contains(document.activeElement) && document.activeElement.id === 'ac_t') return;
  const logged = !!(app.cloud && app.user);
  const keepTyped = $('ac_t') ? $('ac_t').value : '';
  c.innerHTML = `<h3>${t('Mon compte et mes données')}</h3>
   <p class="sub">${logged ? t('Connecté : {e}', { e: esc(app.user.email || '') }) + '. ' : ''}${t('Tu peux emporter toutes tes données quand tu veux, ou tout effacer.')}</p>
   <div class="acts"><button type="button" class="btn sec" id="ac_exp">${t('Exporter toutes mes données')}</button></div>
   ${asking ? `<div class="warn" style="margin-top:12px"><b>${logged ? t('Supprimer mon compte') : t('Effacer les données de cet appareil')}</b><br>${logged ? t('Ton compte, ton stock, tes ventes, tes photos et tes réglages seront supprimés du serveur et de cet appareil. Impossible de revenir en arrière : exporte tes données avant.') : t('Ton stock, tes ventes, tes photos et tes réglages seront effacés de cet appareil. Impossible de revenir en arrière : exporte tes données avant.')}</div>
      <label class="l" for="ac_t" style="margin-top:12px">${t('Tape SUPPRIMER pour confirmer')}</label><input type="text" id="ac_t" autocomplete="off" autocapitalize="characters" value="${esc(keepTyped)}">
      <div class="acts two"><button type="button" class="btn red" id="ac_go" disabled>${t('Supprimer définitivement')}</button><button type="button" class="btn sec" id="ac_no">${t('Annuler')}</button></div><div class="hint" id="ac_m" role="alert"></div>`
    : `<div class="acts"><button type="button" class="btn sec" id="ac_del">${logged ? t('Supprimer mon compte…') : t('Effacer les données de cet appareil…')}</button></div>`}`;
  const go = $('ac_go'); if (go) go.disabled = !MOT().includes(keepTyped.trim().toUpperCase());
  renderAbout();
}

function renderAbout() {
  const c = $('abo'); if (!c) return;
  const mail = (window.STOCK_CONFIG || {}).feedbackEmail || '';
  c.innerHTML = `<h3>${t('À propos de Max')}</h3>
   <div class="kv" style="grid-template-columns:auto 1fr"><dt>${t('Version')}</dt><dd>${esc(VER)} · ${esc(typeof __RELEASE__ === 'string' ? __RELEASE__ : '')}</dd><dt>${t('Contact')}</dt><dd>${mail ? `<a href="mailto:${esc(mail)}">${esc(mail)}</a>` : `<button type="button" class="lnk" id="ab_idee">${t('Écrire ou proposer une idée')}</button>`}</dd></div>
   <div class="acts two"><a class="btn sec" href="confidentialite.html" target="_blank" rel="noopener">${t('Confidentialité')}</a><a class="btn sec" href="conditions.html" target="_blank" rel="noopener">${t('Conditions d\'utilisation')}</a></div>
   <p class="sub" style="margin-top:12px">${t('Les calculs fiscaux et de rentabilité de Max sont des estimations, pas un conseil fiscal ou comptable.')}</p>`;
}

async function removeCloudPhotos() {
  const bucket = app.sb.storage.from('photos'), uid = app.user.id;
  for (const dir of [uid, uid + '/backups']) {
    for (let i = 0; i < 50; i++) {
      const r = await bucket.list(dir, { limit: 100 });
      if (r.error || !r.data || !r.data.length) break;
      const names = r.data.filter(x => x.id).map(x => dir + '/' + x.name);
      if (!names.length) break;
      const d = await bucket.remove(names);
      if (d.error || r.data.length < 100) break;
    }
  }
}

export async function wipeEverything() {
  for (const s of ['pieces', 'photos', 'outbox', 'meta']) await tx(s, 'readwrite', st => { st.clear(); });
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* stockage indisponible */ }
  try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* pas de cache */ }
  app.P = []; app.DEP = [];
}

export async function deleteAccountAndData() {
  if (app.cloud && app.user) {
    await removeCloudPhotos();
    const r = await app.sb.rpc('delete_my_account');
    if (r.error) {
      if (r.error.code === 'PGRST202' || r.error.code === '42883' || /could not find the function|does not exist/i.test(r.error.message || '')) throw new Error(t('La suppression de compte n\'est pas encore activée sur ce serveur. Écris-nous pour la demander.'));
      throw r.error;
    }
    try { await app.sb.auth.signOut(); } catch (e) { /* déjà déconnecté */ }
  }
  await wipeEverything();
}

document.addEventListener('click', async e => {
  if (!e.target.closest('#acc,#abo')) return;
  if (e.target.closest('#ab_idee')) return app.openTool('idee');
  if (e.target.closest('#ac_exp')) return app.exportJSON();
  if (e.target.closest('#ac_del')) { asking = true; return renderAccount(); }
  if (e.target.closest('#ac_no')) { asking = false; return renderAccount(); }
  if (e.target.closest('#ac_go')) {
    const m = $('ac_m'); $('ac_go').disabled = true; m.textContent = t('Suppression en cours…');
    try { await deleteAccountAndData(); location.reload(); }
    catch (er) { m.textContent = (er && er.message) || t('erreur'); $('ac_go').disabled = false; }
  }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'ac_t') return;
  $('ac_go').disabled = !MOT().includes(e.target.value.trim().toUpperCase());
});
app.renderAccount = renderAccount;
