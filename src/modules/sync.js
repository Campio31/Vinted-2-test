import { app } from '../state.js';
import { report } from '../monitoring.js';
import { $, LSg, LSs, esc } from './core.js';
import { tx } from './storage.js';
import { phBlob, phURL } from './photos.js';
import { go } from './nav.js';
import { applyCfg, syncCfg } from './settings-core.js';
import { autoBackupCheck } from './backup.js';

app.refreshStatus = refreshStatus;
app.queue = queue;
app.queueMany = queueMany;
app.renderSync = renderSync;

/* ---------- synchronisation entre appareils (Supabase) ---------- */
/* Chaque modification est écrite sur l'appareil puis ajoutée à une file d'attente (outbox) envoyée au serveur dès que la connexion le permet.
   Les modifications des autres appareils arrivent en direct (realtime) et au retour de l'appli au premier plan. */
export const CFG=window.STOCK_CONFIG||{};
export const cloud=!!(CFG.supabaseUrl&&CFG.supabaseKey&&window.supabase);
app.cloud = cloud;
app.sb = null;
app.user = null;
app.online = navigator.onLine;
let flushing = false;
let pulling = false;
let pending = 0;
let pendingSince = 0;
let lastSync = null;
let syncErr = '';
let channel = null;
let kickT = null;
let rT = null;
let starting = false;
/* « Se souvenir de moi » : session gardée dans le navigateur, sinon seulement jusqu'à la fermeture */
const authStore={getItem:k=>{try{const a=localStorage.getItem(k);return a!==null?a:sessionStorage.getItem(k)}catch(e){return null}},
 setItem:(k,v)=>{try{if(LSg('remember',true)){localStorage.setItem(k,v);sessionStorage.removeItem(k)}else{sessionStorage.setItem(k,v);localStorage.removeItem(k)}}catch(e){}},
 removeItem:k=>{try{localStorage.removeItem(k);sessionStorage.removeItem(k)}catch(e){}}};
if(cloud)app.sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStore}});
export const metaGet=async k=>{const r=await tx('meta','readonly',s=>s.get(k));return r&&r.v};
app.metaGet = metaGet;
export const metaSet=(k,v)=>tx('meta','readwrite',s=>{s.put({k,v})});
app.metaSet = metaSet;
const sortKeys=o=>Array.isArray(o)?o.map(sortKeys):o&&typeof o==='object'?Object.keys(o).sort().reduce((a,k)=>(a[k]=sortKeys(o[k]),a),{}):o;
export const same=(a,b)=>JSON.stringify(sortKeys(a))===JSON.stringify(sortKeys(b));
const scheduleRender=()=>{clearTimeout(rT);rT=setTimeout(app.renderAll,150)};
app.scheduleRender = scheduleRender;
export function errMsg(e){const m=String(e&&(e.message||e.error_description)||e||'erreur');
 if(/failed to fetch|networkerror|load failed/i.test(m))return t('Pas de connexion au serveur.');
 if(/jwt|expired|not authenticated/i.test(m))return t('Session expirée : reconnecte-toi.');
 if(e&&(e.code==='42P01'||/schema cache|does not exist/i.test(m)))return t('Tables manquantes : exécute le script supabase-setup.sql.');
 if(/invalid login/i.test(m))return t('E-mail ou mot de passe incorrect.');
 if(/already registered/i.test(m))return t('Un compte existe déjà avec cet e-mail : connecte-toi.');
 if(/email not confirmed/i.test(m))return t('Confirme d\'abord ton e-mail (lien reçu par mail).');
 if(/signups not allowed|signup.*disabled/i.test(m))return t('La création de compte est désactivée.');
 return m}
export function refreshStatus(){const el=$('sync');if(!el)return;let c='',tx_;
 if(app.localState==='err'){c='err';tx_=t('Non enregistré')}
 else if(!cloud)tx_=t(app.IDB?'Sur cet appareil':'Mémoire temporaire');
 else if(!app.user){c='pend';tx_=t('Non connecté')}
 else if(syncErr){c='err';tx_=t('Erreur de synchronisation')}
 else if(!app.online){c='pend';tx_=t('Hors ligne')+(pending?' · '+t('{n} en attente',{n:pending}):'')}
 else if(flushing||pulling||pending||app.localState==='pend'){c='pend';tx_=t('Synchronisation…')+(pending?' ('+pending+')':'')}
 else tx_=t('Synchronisé');
 /* la pastille du haut n'apparaît que s'il y a un problème (enregistrement impossible, erreur de synchronisation) ; l'état complet est dans Réglages */
 el.className=c;el.querySelector('span').textContent=tx_;el.hidden=c!=='err';updateDot();if(app.view==='set')renderSync()}
/* petit point à côté de Réglages : hors ligne, ou des modifications qui attendent d'être envoyées depuis plus de 2 minutes */
export function dotState({cloud:c,user,online,pending:p,since,now}){if(!c||!user)return null;if(!online)return{k:'offline',n:p};if(p&&since&&now-since>120000)return{k:'waiting',n:p};return null}
app.dotState=dotState;
function updateDot(){const d=$('offdot');if(!d)return;const s=dotState({cloud:app.cloud,user:app.user,online:app.online,pending,since:pendingSince,now:Date.now()});d.hidden=!s;if(!s)return;const txt=s.k==='offline'?t('Hors ligne')+(s.n?' · '+t('{n} en attente',{n:s.n}):''):t(s.n>1?'{n} modifications en attente':'{n} modification en attente',{n:s.n});d.title=txt;d.setAttribute('aria-label',txt)}
$('offdot').onclick=()=>go('set');
setInterval(()=>refreshStatus(),30000);
const T=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(t('Délai dépassé : le serveur ne répond pas.'))),ms||30000))]);
app.T = T;
$('sync').onclick=()=>go('set');
export const countPending=async()=>{pending=(await tx('outbox','readonly',s=>s.count()))||0;if(!pending)pendingSince=0;else if(!pendingSince)pendingSince=Date.now();refreshStatus()};
const kickFlush=()=>{clearTimeout(kickT);kickT=setTimeout(()=>{flush()},400)};
export async function queue(kind,id){if(!cloud||!app.IDB)return;await tx('outbox','readwrite',s=>{s.put({k:(kind==='photo'?'f:':'p:')+id,kind,id,ts:Date.now()+Math.random()})});await countPending();kickFlush()}
export async function queueMany(ids,photoIds){if(!cloud||!app.IDB)return;await tx('outbox','readwrite',s=>{const t=Date.now();ids.forEach(id=>s.put({k:'p:'+id,kind:'put',id,ts:t+Math.random()}));(photoIds||[]).forEach(id=>s.put({k:'f:'+id,kind:'photo',id,ts:t+Math.random()}))});await countPending();kickFlush()}
const clearOb=ents=>tx('outbox','readwrite',s=>{ents.forEach(e=>{const r=s.get(e.k);r.onsuccess=()=>{if(r.result&&r.result.ts===e.ts)s.delete(e.k)}})});
async function flush(){if(!cloud||!app.user||flushing||!app.online||app.importing)return;flushing=true;syncErr='';refreshStatus();
 try{for(;;){const ob=(await tx('outbox','readonly',s=>s.getAll()))||[];if(!ob.length)break;
   for(const e of ob.filter(x=>x.kind==='photo').slice(0,5)){const b=await phBlob(e.id);if(b){const r=await T(app.sb.storage.from('photos').upload(app.user.id+'/'+e.id+'.jpg',b,{upsert:true,contentType:b.type||'image/jpeg'}),60000);if(r.error)throw r.error}await clearOb([e])}
   const chunk=ob.filter(x=>x.kind!=='photo').slice(0,100);
   if(chunk.length){const rows=chunk.map(e=>{if(e.id==='__settings')return{user_id:app.user.id,id:'__settings',data:syncCfg(),deleted:false};const p=e.kind==='put'?(app.isDep(e.id)?app.DEP:app.P).find(x=>x.id===e.id):null;return p?{user_id:app.user.id,id:e.id,data:p,deleted:false}:{user_id:app.user.id,id:e.id,data:{},deleted:true}});
    const r=await T(app.sb.from('pieces').upsert(rows,{onConflict:'user_id,id'}));if(r.error)throw r.error;await clearOb(chunk)}
   await countPending()}
  lastSync=new Date()}
 catch(e){syncErr=errMsg(e);report(e,{ou:'synchronisation'})}
 finally{flushing=false;await countPending()}}
async function applyRows(rows){const ob=new Set((await tx('outbox','readonly',s=>s.getAllKeys()))||[]);const put=[],del=[];
 for(const r of rows){if(r&&r.id==='__settings'){if(!r.deleted)applyCfg(r.data);continue}if(!r||!r.id||ob.has('p:'+r.id))continue;if(app.isDep(r.id)){app.depApply(r,del,put);continue}const i=app.P.findIndex(x=>x.id===r.id);
  if(r.deleted){if(i>=0){app.P.splice(i,1);del.push(r.id)}}
  else{const d=Object.assign({},r.data,{id:r.id});if(i>=0){if(same(app.P[i],d))continue;app.P[i]=d}else app.P.push(d);put.push(d)}}
 if(put.length||del.length){await tx('pieces','readwrite',s=>{put.forEach(d=>s.put(d));del.forEach(id=>s.delete(id))});scheduleRender()}}
async function pull(){if(!cloud||!app.user||pulling||!app.online)return;pulling=true;refreshStatus();
 try{const since=(await metaGet('lastPull'))||'1970-01-01T00:00:00Z';let from=0,last=since;
  for(;;){const r=await T(app.sb.from('pieces').select('id,data,deleted,updated_at').gt('updated_at',since).order('updated_at',{ascending:true}).range(from,from+999));if(r.error)throw r.error;const d=r.data||[];if(!d.length)break;await applyRows(d);last=d[d.length-1].updated_at;if(d.length<1000)break;from+=1000}
  if(last!==since)await metaSet('lastPull',last);lastSync=new Date();syncErr=''}
 catch(e){syncErr=errMsg(e);report(e,{ou:'synchronisation'})}
 finally{pulling=false;refreshStatus()}}
async function syncNow(){await pull();await flush()}
async function wipeLocal(){app.P=[];app.DEP=[];for(const s of ['pieces','photos','outbox','meta'])await tx(s,'readwrite',st=>{st.clear()});phURL.clear()}
export async function startSync(u){if(app.user&&app.user.id===u.id)return;app.user=u;if($('au_reset').hidden)$('auth').hidden=true;
 const prev=await metaGet('userId');
 if(prev&&prev!==u.id){await wipeLocal()}
 if(prev!==u.id){await metaSet('userId',u.id);
  /* première connexion : les données déjà présentes sur l'appareil sont envoyées au serveur */
  const pk=(await tx('photos','readonly',s=>s.getAllKeys()))||[];await queueMany([...app.P.map(p=>p.id),...app.DEP.map(d=>d.id),'__settings'],pk)}
 app.renderAll();app.addForm.draw();
 await pull();await flush();autoBackupCheck();
 if(channel)app.sb.removeChannel(channel);
 channel=app.sb.channel('pieces-'+u.id).on('postgres_changes',{event:'*',schema:'public',table:'pieces',filter:'user_id=eq.'+u.id},pl=>{const r=pl.new;if(r&&r.id)applyRows([r])}).subscribe();
 refreshStatus()}
export function stopSync(){app.user=null;if(channel&&app.sb){app.sb.removeChannel(channel);channel=null}syncErr='';refreshStatus();showAuth()}
export function showAuth(){if(!cloud||app.user)return;$('auth').hidden=false}
function auMsg(t,bad){const m=$('au_msg');m.textContent=t||'';m.style.color=bad?'var(--red)':'var(--ink)'}
async function authDo(mode){const email=$('au_mail').value.trim(),pw=$('au_pw').value;auMsg('');
 if(!email||pw.length<6)return auMsg(t('Saisis ton e-mail et un mot de passe d\'au moins 6 caractères.'),true);
 LSs('remember',$('au_rm').checked);LSs('lastEmail',email);
 $('au_in').disabled=$('au_up').disabled=true;
 try{if(mode==='in'){const r=await app.sb.auth.signInWithPassword({email,password:pw});if(r.error)throw r.error}
  else{const r=await app.sb.auth.signUp({email,password:pw});if(r.error)throw r.error;if(!r.data.session)auMsg(t('Compte créé. Ouvre le mail de confirmation, clique sur le lien, puis reviens te connecter.'))}}
 catch(e){auMsg(errMsg(e),true)}
 finally{$('au_in').disabled=$('au_up').disabled=false}}
$('au_in').onclick=()=>authDo('in');$('au_up').onclick=()=>authDo('up');
$('au_mail').value=LSg('lastEmail','');$('au_rm').checked=LSg('remember',true);
$('au_eye').onclick=()=>{const p=$('au_pw'),sh=p.type==='password';p.type=sh?'text':'password';$('au_eye').textContent=t(sh?'Masquer':'Afficher')};
$('au_fg').onclick=async()=>{const email=$('au_mail').value.trim();if(!email)return auMsg(t('Saisis d\'abord ton e-mail ci-dessus.'),true);
 try{const r=await app.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(r.error)throw r.error;auMsg(t('E-mail envoyé. Ouvre le lien reçu pour choisir un nouveau mot de passe.'))}catch(e){auMsg(errMsg(e),true)}};
export function showReset(){$('auth').hidden=false;$('au_reset').hidden=false;document.querySelector('#auth>.card').hidden=true}
$('au_save').onclick=async()=>{const pw=$('au_np').value,m=$('au_msg2');if(pw.length<6){m.textContent=t('6 caractères minimum.');m.style.color='var(--red)';return}
 try{const r=await app.sb.auth.updateUser({password:pw});if(r.error)throw r.error;m.textContent=t('Mot de passe modifié.');m.style.color='var(--ink)';$('au_reset').hidden=true;document.querySelector('#auth>.card').hidden=false;if(app.user)$('auth').hidden=true}catch(e){m.textContent=errMsg(e);m.style.color='var(--red)'}};
$('au_pw').addEventListener('keydown',e=>{if(e.key==='Enter')authDo('in')});
function renderSync(){const c=$('sy');
 if(!cloud){c.innerHTML='<h3>'+t('Synchronisation')+'</h3><p class="sub">'+t('Pas de compte sur cet appareil : tes données restent ici. La synchronisation entre appareils n\'est pas disponible dans cette version.')+'</p>';return}
 const tm=lastSync?lastSync.toLocaleTimeString(app.LOC,{hour:'2-digit',minute:'2-digit'}):'';
 c.innerHTML=`<h3>${t('Synchronisation')}</h3><p class="sub">${app.user?t('Connecté : {e}',{e:esc(app.user.email||'')}):t('Non connecté')}${tm?' · '+t('dernière synchro à {h}',{h:tm}):''}${pending?' · '+t(pending>1?'{n} modifications en attente':'{n} modification en attente',{n:pending}):''}${app.online?'':' · '+t('hors ligne')}</p>${syncErr?`<div class="warn">${esc(syncErr)}</div>`:''}<div class="acts two"><button class="btn" id="sy_now" type="button"${app.user?'':' disabled'}>${t('Synchroniser')}</button><button class="btn sec" id="sy_out" type="button"${app.user?'':' disabled'}>${t('Se déconnecter')}</button></div>`;
 $('sy_now').onclick=()=>{syncNow()};$('sy_out').onclick=async()=>{await app.sb.auth.signOut()}}
window.addEventListener('online',()=>{app.online=true;refreshStatus();syncNow()});
window.addEventListener('offline',()=>{app.online=false;refreshStatus()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&app.user)syncNow()});
setInterval(()=>{if(app.user&&!document.hidden)syncNow()},60000);
