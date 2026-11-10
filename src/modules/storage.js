import { app } from '../state.js';
import { report } from '../monitoring.js';
import { $, clean, esc } from './core.js';

app.toast = toast;

/* ---------- stockage sur l'appareil (IndexedDB) ---------- */
export const idbOpen=()=>new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('indexedDB indisponible'));const r=indexedDB.open('stock-friperie',2);r.onupgradeneeded=()=>{const d=r.result;[['pieces','id'],['photos','id'],['outbox','k'],['meta','k']].forEach(([n,k])=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:k})})};r.onblocked=()=>{$('sync').hidden=false;$('sync').className='err';$('sync').querySelector('span').textContent=t('Ferme les autres onglets ou fenêtres de l\'appli')};r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>d.close();res(d)};r.onerror=()=>rej(r.error)});
export const tx=(store,mode,fn)=>new Promise((res,rej)=>{if(!app.IDB)return res();let out;const t=app.IDB.transaction(store,mode);try{out=fn(t.objectStore(store))}catch(e){return rej(e)}t.oncomplete=()=>res(out&&'result' in out?out.result:undefined);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)});
app.localState = 'ok';
export const setSync=s=>{app.localState=s;app.refreshStatus()};
let chain=Promise.resolve();
export function persist(fn){setSync('pend');chain=chain.then(fn).then(()=>setSync('ok'),e=>{setSync('err');report(e,{ou:'enregistrement'});app.toast(t('Enregistrement impossible')+(e&&e.message?' : '+e.message:''))});return chain}


let tt;
function toast(msg,undo,dur){const tb=$('toast');tb.hidden=false;tb.innerHTML='<span>'+esc(msg)+'</span>'+(undo?'<button type="button" id="tu">'+t('Annuler')+'</button>':'');if(undo)$('tu').onclick=()=>{tb.hidden=true;undo()};clearTimeout(tt);tt=setTimeout(()=>tb.hidden=true,dur||(undo?6000:3200))}
