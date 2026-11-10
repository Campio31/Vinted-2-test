import { app } from '../state.js';
import { $, LSg, LSs, esc, fd, pad, today } from './core.js';
import { colisList } from './live.js';
import { CFG, cloud, errMsg } from './sync.js';
import { sheetHead, showSheet } from './tools-index.js';
import { unpub } from './publication.js';
import { ldate } from './proofs.js';
import { commEvents, evInfo } from './commercial-calendar.js';

app.rappelsList = rappelsList;
app.rappelsCardHTML = rappelsCardHTML;
app.openRappels = openRappels;
app.kickExtra = kickExtra;

/* --- 2. rappels du jour et notifications --- */
export const hh=s=>{const v=String(s||'18:00');return app.LANG==='fr'?v.replace(':','h'):v};
function rappelsList(){const R=[],now=new Date(),nc=colisList().length;
 if(nc)R.push({k:'colis',tone:'o',txt:t('{n} colis à déposer avant {h}',{n:nc,h:hh(app.cfg.depotH)}),tool:'quick'});
 if(app.cfg.liveAt){const dt=new Date(app.cfg.liveAt);if(!isNaN(dt)&&dt-now>-3600e3&&dt-now<36*3600e3)R.push({k:'live',tone:'g',txt:t(ldate(dt)===today()?'Live ce soir à {h}':'Live le {d} à {h}',{d:fd(ldate(dt)),h:hh(pad(dt.getHours(),2)+':'+pad(dt.getMinutes(),2))}),tool:'quick'})}
 const ev=commEvents().find(e=>{const i=evInfo(e);return i.prep&&i.dd<=e.lead});if(ev){const i=evInfo(ev);R.push({k:'ev:'+ev.key,tone:'o',txt:t(i.dd>1?'{e} dans {n} jours : prépare tes promos et tes lots':'{e} dans {n} jour : prépare tes promos et tes lots',{e:t(ev.name),n:i.dd}),tool:'calcom'})}
 const u=app.P.filter(unpub).length,pt=app.P.filter(p=>p.pub===today()).length;if(u&&pt<5)R.push({k:'pub',tone:'o',txt:t(5-pt>1?'Publie {n} pièces aujourd\'hui ({u} pas encore en ligne)':'Publie {n} pièce aujourd\'hui ({u} pas encore en ligne)',{n:5-pt,u}),topub:1});
 return R}
function rappelsCardHTML(){const R=app.rappelsList();if(!R.length)return'';return`<div class="card" data-nc="1"><h3 style="margin:0 0 8px">${t('Rappels du jour')}</h3>${R.map(r=>`<button type="button" class="rap rap-${r.tone}" ${r.topub?'data-topub="1"':'data-tool="'+r.tool+'"'}><i></i><span>${esc(r.txt)}</span></button>`).join('')}</div>`}
async function notify(titre,body,tag){if(!('Notification' in window)||Notification.permission!=='granted')return;try{const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg&&reg.showNotification)reg.showNotification(titre,{body,tag,icon:'icons/icon-192.png',badge:'icons/icon-192.png'});else new Notification(titre,{body,tag,icon:'icons/icon-192.png'})}catch(e){}}
export function checkNotifs(){if(pushIsOn())return;if(!app.cfg.notifOn||!('Notification' in window)||Notification.permission!=='granted'||!app.P.length)return;const d=LSg('notifSent',{});if(d.day!==today()){d.day=today();d.k=[]}
 app.rappelsList().forEach(r=>{if(d.k.includes(r.k))return;d.k.push(r.k);notify('Max',r.txt,r.k)});LSs('notifSent',d)}
function openRappels(){const perm='Notification' in window?Notification.permission:'indispo',R=app.rappelsList(),pushOn=pushIsOn();
 showSheet(sheetHead(t('Rappels'))+`<div class="card">${R.length?R.map(r=>`<div class="cl cl-${r.tone}" style="margin-bottom:6px"><i></i><div><b>${esc(r.txt)}</b></div></div>`).join(''):'<div class="hint">'+t('Rien à signaler pour le moment.')+'</div>'}</div>
  <div class="card"><h3>${t('Réglages')}</h3><div class="row2 fld"><div><label class="l" for="rp_h">${t('Dépôt des colis avant')}</label><input type="time" id="rp_h" value="${esc(app.cfg.depotH||'18:00')}"></div><div><label class="l" for="rp_l">${t('Prochain live')}</label><input type="datetime-local" id="rp_l" value="${esc(app.cfg.liveAt||'')}"></div></div>
  <div class="acts"><button type="button" class="btn${app.cfg.notifOn&&perm==='granted'?' sec':' mint'}" id="rp_n">${app.cfg.notifOn&&perm==='granted'?t('Notifications activées (désactiver)'):t('Activer les notifications')}</button></div>
  ${pushOK()?`<div class="acts"><button type="button" class="btn${pushOn?' sec':' mint'}" id="rp_p">${pushOn?t('Rappels appli fermée activés (désactiver)'):t('Recevoir les rappels appli fermée')}</button>${pushOn?'<button type="button" class="btn sec" id="rp_t">'+t('Envoyer un test')+'</button>':''}</div>`:''}
  <div class="hint">${perm==='denied'?t('Les notifications sont bloquées dans les réglages de ton navigateur.'):perm==='indispo'?t('Ton navigateur ne gère pas les notifications. Sur iPhone, installe d\'abord l\'appli sur l\'écran d\'accueil.'):t('Elles s\'affichent quand l\'appli est ouverte ou récemment utilisée en arrière-plan.')+' '+(pushOK()?t('Avec « rappels appli fermée », ton téléphone est prévenu même quand l\'appli est fermée (test possible ci-dessus).'):t('Les rappels appli fermée ne sont pas encore configurés (voir PUSH-ET-CLASSEMENT.md).'))}</div></div>`);
 $('shc').onchange=e=>{if(e.target.id==='rp_h'){app.setCfg({depotH:e.target.value||'18:00'});app.toast(t('Enregistré'));app.renderAll()}if(e.target.id==='rp_l'){app.setCfg({liveAt:e.target.value});app.toast(t('Live enregistré'));app.renderAll()}};
 $('shc').onclick=async e=>{
  if(e.target.closest('#rp_p')){try{if(pushOn){await pushDisable();app.toast(t('Rappels appli fermée désactivés'))}else{await pushEnable();app.toast(t('Rappels appli fermée activés'))}}catch(er){app.toast(errMsg(er))}return openRappels()}
  if(e.target.closest('#rp_t')){try{await pushTest();app.toast(t('Test lancé : notification dans moins d\'une minute'))}catch(er){app.toast(errMsg(er))}return}
  if(!e.target.closest('#rp_n'))return;if(app.cfg.notifOn){app.setCfg({notifOn:false});openRappels();return}
  if(!('Notification' in window))return app.toast(t('Notifications non disponibles sur ce navigateur'));let p=Notification.permission;if(p==='default')p=await Notification.requestPermission();if(p==='granted'){app.setCfg({notifOn:true});notify('Max',t('Les rappels sont activés'),'test');checkNotifs()}else app.toast(t('Autorisation refusée'));openRappels()}}

/* --- 2b. notifications push (appli fermée) : abonnement + rappels déposés dans la file du serveur --- */
const PUSH_KEY=CFG.vapidPublicKey||'';
const pushOK=()=>!!(cloud&&PUSH_KEY&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);
const pushIsOn=()=>pushOK()&&LSg('pushOn',false)&&Notification.permission==='granted';
const b64u=s=>{const b=atob((s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,c=>c.charCodeAt(0))};
async function pushSave(sub){const j=sub.toJSON();const{error}=await app.sb.from('push_subscriptions').upsert({user_id:app.user.id,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth},{onConflict:'user_id,endpoint'});if(error)throw error}
async function pushEnable(){if(!app.user)throw new Error(t('Connecte-toi d\'abord (onglet Réglages).'));
 let p=Notification.permission;if(p==='default')p=await Notification.requestPermission();if(p!=='granted')throw new Error(t('Autorisation refusée'));
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(PUSH_KEY)});
 await pushSave(sub);LSs('pushOn',true);LSs('pushLast','');await pushSync(true)}
async function pushDisable(){LSs('pushOn',false);try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await app.sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}}catch(e){}}
/* Rappels des 2 prochains jours, calculés avec les mêmes règles que rappelsList() mais datés (le serveur n'a pas accès à la logique de l'appli) */
function pushItems(){const out=[],now=new Date(),nc=colisList().length,hm=String(app.cfg.depotH||'18:00').split(':').map(Number);
 const at=(o,h,m)=>{const d=new Date();d.setDate(d.getDate()+o);d.setHours(h,m||0,0,0);return d},add=(tag,d,body)=>{if(d>now)out.push({tag,send_at:d.toISOString(),title:'Max',body})};
 if(nc)for(let o=0;o<2;o++){const d=at(o,Math.max(0,(hm[0]||18)-2),hm[1]||0);add('colis:'+ldate(d),d,t('{n} colis à déposer avant {h}',{n:nc,h:hh(app.cfg.depotH)}))}
 if(app.cfg.liveAt){const dt=new Date(app.cfg.liveAt);if(!isNaN(dt))add('live:'+app.cfg.liveAt,new Date(dt-2*3600e3),t(dt.getHours()>=17?'Live ce soir à {h}':'Live aujourd\'hui à {h}',{h:hh(pad(dt.getHours(),2)+':'+pad(dt.getMinutes(),2))}))}
 const ev=commEvents().find(e=>{const i=evInfo(e);return i.prep&&i.dd<=e.lead});
 if(ev){const dd0=evInfo(ev).dd;for(let o=0;o<2;o++){const dd=dd0-o;if(dd<0)continue;const d=at(o,9,0);add('ev:'+ev.key+':'+ldate(d),d,dd>0?t(dd>1?'{e} dans {n} jours : prépare tes promos et tes lots':'{e} dans {n} jour : prépare tes promos et tes lots',{e:t(ev.name),n:dd}):t('{e} : c\'est aujourd\'hui !',{e:t(ev.name)}))}}
 (app.pushExtra||[]).forEach(f=>f(at,add));
 return out}
async function pushSync(force){if(!pushIsOn()||!app.user||app.importing||!app.loaded)return;
 const items=pushItems(),k=app.user.id+JSON.stringify(items);if(!force&&LSg('pushLast','')===k)return;
 const{error}=await app.sb.rpc('set_push_schedule',{items});if(error)throw error;LSs('pushLast',k);
 if(!sessionStorage.getItem('pushChk')){sessionStorage.setItem('pushChk','1');const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await pushSave(sub)}}
async function pushTest(){if(!app.user)throw new Error(t('Connecte-toi d\'abord.'));const{error}=await app.sb.from('push_queue').insert({user_id:app.user.id,tag:'test:'+Date.now(),send_at:new Date().toISOString(),title:'Max',body:t('Test réussi : tu recevras tes rappels même appli fermée.')});if(error)throw error}
let xT=null;function kickExtra(){clearTimeout(xT);xT=setTimeout(()=>{if(pushIsOn())pushSync().catch(()=>{});if(typeof app.amisPublish==='function')app.amisPublish().catch(()=>{});if(typeof app.rangPublish==='function')app.rangPublish().catch(()=>{})},4000)}
