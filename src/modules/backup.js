import { app } from '../state.js';
import { $, days, esc, fd, today } from './core.js';
import { tx } from './storage.js';
import { syncCfg } from './settings-core.js';

/* ---------- sauvegarde automatique hebdomadaire ---------- */
const stripEx=p=>{const q=Object.assign({},p);delete q.ex;return q};
async function snapshot(){const data=JSON.stringify({pieces:app.P.map(stripEx),depenses:app.DEP,settings:syncCfg(),at:new Date().toISOString()});
 await app.metaSet('backup:'+today(),data);
 const keys=((await tx('meta','readonly',s=>s.getAllKeys()))||[]).filter(k=>String(k).startsWith('backup:')).sort();
 for(const k of keys.slice(0,-6))await tx('meta','readwrite',s=>{s.delete(k)});
 if(app.cloud&&app.user&&app.online){try{await app.T(app.sb.storage.from('photos').upload(app.user.id+'/backups/sauvegarde-'+today()+'.json',new Blob([data],{type:'application/json'}),{upsert:true,contentType:'application/json'}),60000);
  const r=await app.sb.storage.from('photos').list(app.user.id+'/backups',{limit:100});if(r.data){const names=r.data.map(x=>x.name).filter(n=>n.startsWith('sauvegarde-')).sort();if(names.length>8)await app.sb.storage.from('photos').remove(names.slice(0,-8).map(n=>app.user.id+'/backups/'+n))}}catch(e){}}
 app.setCfg({lastAuto:today()},true)}
export async function autoBackupCheck(){if(!app.cfg.auto||!app.loaded||!app.P.length)return;if(!app.cfg.lastAuto||days(app.cfg.lastAuto,today())>=7){try{await snapshot();$('bk').hidden=false;if(app.view==='set')renderBk()}catch(e){}}}
export async function renderBk(){const c=$('bkc');if(!c||c.contains(document.activeElement)&&document.activeElement.type!=='checkbox')return;
 const keys=((await tx('meta','readonly',s=>s.getAllKeys()))||[]).filter(k=>String(k).startsWith('backup:')).sort().reverse();
 c.innerHTML=`<h3>${t('Sauvegarde automatique')}</h3><label class="chk"><input type="checkbox" id="b_auto"${app.cfg.auto?' checked':''}><span>${t('Sauvegarder automatiquement chaque semaine')}</span></label>
 <p class="sub" style="margin-top:8px">${t('Une copie est gardée sur cet appareil (6 dernières) et, si tu es connecté, dans ton espace en ligne (8 dernières). Un rappel te propose aussi de télécharger le fichier : un navigateur ne peut pas l\'enregistrer tout seul sur ton téléphone. Les photos ne sont pas dans ces copies, utilise « Sauvegarde complète » pour les garder.')}</p>
 ${keys.length?'<span class="l">'+t('Copies sur cet appareil')+'</span>'+keys.map(k=>`<div class="bk-r"><span>${fd(k.slice(7))}</span><button type="button" class="btn sm sec" data-bdl="${esc(k)}">${t('Télécharger')}</button><button type="button" class="btn sm sec" data-brs="${esc(k)}">${t('Restaurer')}</button></div>`).join(''):''}
 <div class="acts"><button type="button" class="btn sec" id="b_now">${t('Sauvegarder maintenant')}</button></div><div class="hint" id="b_msg"></div>`}
$('bkc').addEventListener('change',e=>{if(e.target.id==='b_auto'){app.setCfg({auto:e.target.checked});if(app.cfg.auto)autoBackupCheck();app.toast(t(app.cfg.auto?'Sauvegarde hebdomadaire activée':'Sauvegarde hebdomadaire désactivée'))}});
$('bkc').addEventListener('click',async e=>{
 if(e.target.closest('#b_now')){if(!app.P.length)return app.toast(t('Aucune pièce à sauvegarder'));await snapshot();app.toast(t('Copie enregistrée'));renderBk();return}
 const d=e.target.closest('[data-bdl]');if(d){const r=await app.metaGet(d.dataset.bdl);if(r)app.saveFile('sauvegarde_'+d.dataset.bdl.slice(7)+'.json',r,'application/json');return}
 const s=e.target.closest('[data-brs]');if(s){if(s.dataset.sure!=='1'){s.dataset.sure='1';s.textContent=t('Confirmer ?');setTimeout(()=>{if(s.isConnected){s.dataset.sure='';s.textContent=t('Restaurer')}},4000);return}
  const r=await app.metaGet(s.dataset.brs);if(r){await app.importText(r);$('b_msg').textContent=$('is').textContent}}});
$('bk_go').onclick=()=>{$('bk').hidden=true;app.exportJSON()};$('bk_x').onclick=()=>{$('bk').hidden=true};
