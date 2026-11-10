import { app } from '../state.js';
import { LSg, LSs } from './core.js';

app.setCfg = setCfg;

/* ---------- réglages (synchronisés entre appareils, sauf les clés propres à l'appareil) ---------- */
export const CFG0={goal:0,goalCA:0,goalY:0,goalYCA:0,goalMode:'net',lang:'',emb:0.42,port:0,comV:0,comT:0,pf1:'',pf2:'',roi:100,minM:3,auto:false,lastAuto:'',remember:true,plafond:203100,plafondTva:85000,finJours:21,tauxSoc:12.3,periode:'M',fiscDeclared:{},alias:{},cash:null,cashDate:'',ballotBudget:0,depotH:'18:00',liveAt:'',notifOn:false,defis:[],_ts:{}};
export const DEVICE_KEYS=['lastAuto','remember','lang'];
app.cfg = Object.assign({},CFG0,LSg('cfg',{}));
export const syncCfg=()=>{const o={};Object.keys(app.cfg).forEach(k=>{if(!DEVICE_KEYS.includes(k))o[k]=app.cfg[k]});return o};
/* Chaque réglage garde la date de sa dernière modification (_ts) : une copie plus ancienne venue du serveur ne remplace jamais un réglage modifié ici plus récemment. */
function setCfg(patch,local){const ts=Object.assign({},app.cfg._ts),now=Date.now();Object.keys(patch).forEach(k=>{if(k!=='_ts')ts[k]=now});app.cfg=Object.assign({},app.cfg,patch,{_ts:ts});LSs('cfg',app.cfg);if(!local&&app.cloud)app.queue('put','__settings')}
export function applyCfg(d){if(!d||typeof d!=='object')return;const o={},rts=d._ts&&typeof d._ts==='object'?d._ts:{},lts=app.cfg._ts||{},ts=Object.assign({},lts);
 Object.keys(CFG0).forEach(k=>{if(k==='_ts'||DEVICE_KEYS.includes(k)||d[k]===undefined)return;const r=+rts[k]||0,l=+lts[k]||0;if(r<l)return;o[k]=d[k];if(r)ts[k]=r});
 app.cfg=Object.assign({},app.cfg,o,{_ts:ts});LSs('cfg',app.cfg);app.scheduleRender()}
export const fN=v=>String(Math.round(v*100)/100).replace('.',app.DS);
app.fN = fN;
/* frais préremplis : emballage + envoi + commission. Avec des comptes de vente (comptes.js), la commission est celle du compte (cpt, ou celui proposé pour cette plateforme) quand il en a une. */
export const defFrais=(prix,canal,cpt)=>{const cc=app.cptCom?app.cptCom(cpt,canal):null,pct=cc!=null?cc:canal==='TikTok Live'?app.cfg.comT:canal==='Vinted'?app.cfg.comV:0;return Math.round(((app.cfg.emb||0)+(app.cfg.port||0)+prix*(pct||0)/100)*100)/100};
app.defFrais = defFrais;
