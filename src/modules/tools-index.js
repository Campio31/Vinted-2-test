import { app } from '../state.js';
import { $ } from './core.js';
import { go } from './nav.js';

app.openTool = openTool;

/* ---------- outils : QR et bacs, commande vocale… (treso et rapport s'ouvrent depuis le Bilan) ---------- */
export const sheetHead=h=>`<div class="sh"><h2>${h}</h2><button type="button" class="x" data-x="1" aria-label="${t('Fermer')}">×</button></div>`;
export function showSheet(html){$('shc').onclick=null;$('shc').onchange=null;$('sheet').hidden=false;$('shc').innerHTML=html;$('sheet').firstElementChild.scrollTop=0}
export const TI=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
export const TOOLS=[
 {k:'qr',t:'Scanner QR et étiquettes',d:'Scanne une pièce, imprime des étiquettes, range dans un bac',i:TI('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM19 17v3h-3"/>')},
 {k:'trophees',t:'Défis, cartes et trophées',d:'Défis de la semaine et du mois, cartes à collectionner, trophées à paliers et classement',i:TI('<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/>')},
 {k:'fisc',t:'Ligne fiscale',d:'Plafond micro-entrepreneur, alerte et déclaration URSSAF',i:TI('<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>')},
 {k:'fiches',t:'Compléter et nettoyer les fiches',d:'Fiches incomplètes et doublons au même endroit',i:TI('<path d="M5 12l4.5 4.5L19 7M6 20h12"/>')},
 {k:'journee',t:'Ma journée',d:'Tes tâches du jour, à faire ou à reporter',i:TI('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>')},
 {k:'setup',t:'Configurer mes indicateurs',d:'Objectifs, frais fixes, fournitures, trésorerie',i:TI('<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4"/>')},
 {k:'wrapped',t:'Wrapped',d:'Ton récap du mois ou de l\'année, à partager en story',i:TI('<path d="M12 3l2.5 5.5 6 .7-4.5 4 1.3 6L12 16.3 6.7 19.2 8 13.2 3.5 9.2l6-.7z"/>')},
 {k:'rappels',t:'Rappels et notifications',d:'Colis à déposer, live prévu, temps forts',i:TI('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>')}];
/* L'onglet Outils (view v-tools). Le mode simple (simple-mode.js) fournit app.toolsView : outils à montrer, plus l'en-tête et le pied de la liste */
/* pastille de notification : colis à préparer (elle n'est plus dans l'onglet Vente) */
const nbadge=k=>{const n=k==='colis'&&app.colisCount?app.colisCount():0;return n?`<em class="tbd" aria-label="${n}">${n}</em>`:''};
export function renderTools(){const v=app.toolsView?app.toolsView():{list:TOOLS,head:'',foot:''},E=(app.essentials?app.essentials():v.list.slice(0,6).map(x=>x.k)),main=E.map(k=>v.list.find(x=>x.k===k)).filter(Boolean),rest=v.list.filter(x=>!E.includes(x.k));
 $('tv').innerHTML=v.head+`<div class="tools tiles">${main.map(x=>`<button type="button" class="tool" data-tool="${x.k}"><span class="tic">${x.i}${nbadge(x.k)}</span><span class="tx"><b>${t(x.t)}</b><small>${t(x.d)}</small></span></button>`).join('')}</div>`+(rest.length?`<h3 class="tl2h">${t('Tous les outils')}</h3><div class="tools2">${rest.map(x=>`<button type="button" class="tool2" data-tool="${x.k}"><span class="tic">${x.i}${nbadge(x.k)}</span><b>${t(x.t)}</b></button>`).join('')}</div>`:'')+v.foot}
app.renderTools=renderTools;
export function openTools(){go('tools')}
function openTool(k){({fiches:app.openFiches,journee:app.openJournee,setup:app.openSetup,qr:app.openQrTool,scan:app.openScanner,trophees:app.openTrophees,fisc:app.openFisc,complete:app.openComplete,merge:app.openMerge,help:app.openHelp,wrapped:app.openWrapped,calcom:app.openCalcom,rappels:app.openRappels,defis:app.openDefis,importo:app.openImportTool,news:app.openNews,aide:app.openAide,idee:app.openIdee,depenses:app.openDepenses,treso:app.openTreso,rapport:app.openReport,trash:app.openTrash})[k]()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b){e.preventDefault();app.openTool(b.dataset.tool)}});
$('tl').onclick=()=>go('set');
$('rptb').onclick=()=>app.openReport();
