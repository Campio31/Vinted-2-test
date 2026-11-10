import { app } from '../state.js';
import { $ } from './core.js';
import { go } from './nav.js';
import { TI, openTools, sheetHead, showSheet } from './tools-index.js';
import { buzz } from './buyers.js';
import { selSet } from './selection.js';
import { openPlanning } from './supplies-planning.js';

/* ---------- confort : vibrations et mode une main ---------- */
function applyComfort(){document.body.classList.toggle('onehand',!!app.cfg.onehand)}
const setCfg24=app.setCfg;app.setCfg=function(p,l){setCfg24(p,l);if(p&&'onehand' in p)applyComfort()};
const renderAll24=app.renderAll;app.renderAll=function(){renderAll24();applyComfort()};
document.body.insertAdjacentHTML('beforeend',`<div id="ohb"><button type="button" data-oh="find">${TI('<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>')}<span>${t('Chercher')}</span></button><button type="button" data-oh="sel">${TI('<path d="M5 12l4.5 4.5L19 7"/>')}<span>${t('Sélection')}</span></button><button type="button" data-oh="plan">${TI('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>')}<span>${t('Planning')}</span></button><button type="button" data-oh="tools">${TI('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>')}<span>${t('Outils')}</span></button></div>`);
$('ohb').onclick=e=>{const b=e.target.closest('[data-oh]');if(!b)return;const a=b.dataset.oh;if(a==='find'){go('list');setTimeout(()=>$('q').focus(),40)}else if(a==='sel'){go('list');selSet(!app.selMode)}else if(a==='plan')openPlanning();else openTools()};
new MutationObserver(()=>{const c=$('shc');if(!c||$('sheet').hidden||!document.body.classList.contains('onehand')||c.querySelector('.ohx'))return;c.insertAdjacentHTML('beforeend',`<button type="button" class="btn sec ohx" data-x="1">${t('Fermer')}</button>`)}).observe($('shc'),{childList:true});
export function openConfort(){const draw=()=>{showSheet(sheetHead(t('Confort'))+`<div class="card"><label class="chk cfr"><input type="checkbox" id="cf_o"${app.cfg.onehand?' checked':''}><span><b>${t('Mode une main')}</b><small>${t('Barre d\'actions en bas de l\'écran (chercher, sélection, planning, outils) et bouton Fermer en bas des fenêtres.')}</small></span></label>
  <label class="chk cfr"><input type="checkbox" id="cf_v"${app.cfg.vibr!==false?' checked':''}><span><b>${t('Vibrations légères')}</b><small>${t('À la validation d\'une vente et à la sélection. Fonctionne sur Android ; l\'iPhone ne les permet pas.')}</small></span></label>
  <label class="chk cfr"><input type="checkbox" id="cf_s"${app.cfg.stats!==false?' checked':''}><span><b>${t('Mesures d\'usage anonymes')}</b><small>${t('Aide à améliorer Max : seuls des compteurs (écrans et outils ouverts, jours d\'utilisation) sont envoyés. Jamais ton stock, tes ventes, tes prix ni tes acheteurs. Décoche pour refuser.')}</small></span></label></div>`);
  $('cf_o').onchange=()=>{app.setCfg({onehand:$('cf_o').checked},true)};$('cf_v').onchange=()=>{app.setCfg({vibr:$('cf_v').checked},true);if($('cf_v').checked)buzz(30)};$('cf_s').onchange=()=>{app.setCfg({stats:$('cf_s').checked},true);if(!$('cf_s').checked)app.usageReset()}};draw()}
