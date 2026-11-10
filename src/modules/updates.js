import { app } from '../state.js';
import { $ } from './core.js';

app.initUpdates = initUpdates;

/* ---------- mises à jour de l'application ---------- */
function initUpdates(){
 let reg=null,waiting=null,updating=false;
 const show=sw=>{waiting=sw;$('upd').hidden=false};
 $('upd_go').onclick=()=>{if(!waiting)return;updating=true;$('upd_go').disabled=true;waiting.postMessage('SKIP_WAITING')};
 $('upd_x').onclick=()=>{$('upd').hidden=true};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload()});
 navigator.serviceWorker.register('sw.js').then(r=>{reg=r;
  if(r.waiting&&navigator.serviceWorker.controller)show(r.waiting);
  r.addEventListener('updatefound',()=>{const n=r.installing;if(n)n.addEventListener('statechange',()=>{if(n.state==='installed'&&navigator.serviceWorker.controller)show(n)})});
  setInterval(()=>r.update().catch(()=>{}),30*60*1000)}).catch(()=>{});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&reg)reg.update().catch(()=>{})});
 window.__showUpdate=show}
