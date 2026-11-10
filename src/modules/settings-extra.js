import { app } from '../state.js';
import { $ } from './core.js';
import { buzz } from './buyers.js';

/* ---------- Réglages : Confort, Aide et raccourcis (ce ne sont plus des outils) ---------- */
function renderConfort() {
  const c = $('cfc'); if (!c || c.contains(document.activeElement)) return;
  c.innerHTML = `<h3>${t('Confort')}</h3><p class="sub">${t('Vibrations légères et mode une main. Ces choix sont propres à cet appareil.')}</p>
   <label class="chk cfr"><input type="checkbox" id="cc_o"${app.cfg.onehand ? ' checked' : ''}><span><b>${t('Mode une main')}</b><small>${t('Barre d\'actions en bas de l\'écran (chercher, sélection, planning, outils) et bouton Fermer en bas des fenêtres.')}</small></span></label>
   <label class="chk cfr"><input type="checkbox" id="cc_v"${app.cfg.vibr !== false ? ' checked' : ''}><span><b>${t('Vibrations légères')}</b><small>${t('À la validation d\'une vente et à la sélection. Fonctionne sur Android ; l\'iPhone ne les permet pas.')}</small></span></label>
   <label class="chk cfr"><input type="checkbox" id="cc_s"${app.cfg.stats !== false ? ' checked' : ''}><span><b>${t('Mesures d\'usage anonymes')}</b><small>${t('Aide à améliorer Max : seuls des compteurs (écrans et outils ouverts, jours d\'utilisation) sont envoyés. Jamais ton stock, tes ventes, tes prix ni tes acheteurs. Décoche pour refuser.')}</small></span></label>`;
}
function renderHelp() {
  const c = $('hlp'); if (!c) return;
  c.innerHTML = `<h3>${t('Aide et raccourcis')}</h3><p class="sub">${t('Réponses aux questions fréquentes, raccourcis clavier, nouveautés et idées.')}</p>
   <div class="acts two"><button type="button" class="btn" data-tool="aide">${t('Ouvrir l\'aide')}</button><button type="button" class="btn sec" data-tool="idee">${t('Proposer une idée')}</button></div>`;
}
app.renderConfort = renderConfort;
app.renderHelp = renderHelp;
const host = $('v-set');
host.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'cc_o') app.setCfg({ onehand: e.target.checked }, true);
  else if (id === 'cc_v') { app.setCfg({ vibr: e.target.checked }, true); if (e.target.checked) buzz(30); }
  else if (id === 'cc_s') { app.setCfg({ stats: e.target.checked }, true); if (!e.target.checked && app.usageReset) app.usageReset(); }
});
renderConfort(); renderHelp();
