import { app } from '../state.js';
import { $, LSg, LSs, clean, esc, eur, eurR, fd, num, ok, pad, today } from './core.js';
import { persist, tx } from './storage.js';
import { hydrate, phImg } from './photos.js';
import { queue } from './sync.js';
import { sheetHead, showSheet } from './tools-index.js';
import { MOIS } from './gamification.js';
import { compressBlob } from './photo-compress.js';

app.depSave = depSave;
app.depRemove = id => depRemove(id);
app.openDepenses = openDepenses;

/* --- dépenses hors pièces --- */
const DEPCAT=['Carburant','Matériel photo','Cintres et emballage','Abonnement','Autre'];
function depSave(d){d=clean(d);const i=app.DEP.findIndex(x=>x.id===d.id);if(i<0)app.DEP.unshift(d);else app.DEP[i]=d;app.renderAll();
 persist(async()=>{await tx('pieces','readwrite',s=>s.put(d));await queue('put',d.id);if(d.photo)await queue('photo',d.photo)});return d}
function depRemove(id){app.DEP=app.DEP.filter(x=>x.id!==id);app.renderAll();persist(async()=>{await tx('pieces','readwrite',s=>s.delete(id));await queue('del',id)})}
let depM='',depE=null;
function openDepenses(){depM=depM||today().slice(0,7);depE=null;drawDep()}
function readDep(){if(!depE||!$('de_m'))return;depE.montant=$('de_m').value;depE.date=$('de_d').value;depE.note=$('de_n').value}
function drawDep(){const L=app.DEP.filter(d=>(d.date||'').startsWith(depM)).sort((a,b)=>b.date.localeCompare(a.date)),tot=L.reduce((a,d)=>a+(d.montant||0),0),[y,m]=depM.split('-').map(Number),cur=today().slice(0,7),bc={};
 L.forEach(d=>{const k=d.cat||'Autre';bc[k]=(bc[k]||0)+(d.montant||0)});
 const form=depE?`<div class="card" style="margin-top:12px"><h3 style="margin:0 0 10px">${depE.id?t('Modifier la dépense'):t('Nouvelle dépense')}</h3><div class="row2 fld"><div><label class="l" for="de_m">${t('Montant')}</label><div class="price"><input type="text" inputmode="decimal" id="de_m" value="${esc(String(depE.montant||'').replace('.',app.DS))}" placeholder="0${app.DS}00"><span>€</span></div></div><div><label class="l" for="de_d">${t('Date')}</label><input type="date" id="de_d" value="${esc(depE.date)}"></div></div>
  <span class="l">${t('Catégorie')}</span><div class="chips" id="de_c">${DEPCAT.map(c=>`<button type="button" class="chip sm${depE.cat===c?' on':''}" data-dc="${esc(c)}">${esc(tv(c))}</button>`).join('')}</div>
  <div class="fld"><label class="l" for="de_n">${t('Note')}</label><input type="text" id="de_n" value="${esc(depE.note||'')}" placeholder="${t('Plein, ampoules, cintres…')}" autocomplete="off"></div>
  <div class="fld"><span class="l">${t('Ticket')}</span>${depE.photo?`<div style="display:flex;gap:10px;align-items:center">${phImg(depE.photo,'dth')}<button type="button" class="btn sm sec" data-dx="1">${t('Retirer')}</button></div>`:`<label class="btn sec sm" style="cursor:pointer">${t('Photographier le ticket')}<input type="file" accept="image/*" capture="environment" id="de_ph" hidden></label>`}<div class="hint" id="de_ps"></div></div>
  <div class="acts"><button type="button" class="btn mint" id="de_ok">${t('Enregistrer')}</button><div class="acts two" style="margin:0"><button type="button" class="btn sec" id="de_no">${t('Annuler')}</button>${depE.id?'<button type="button" class="btn red" id="de_del">'+t('Supprimer')+'</button>':''}</div></div></div>`:'';
 showSheet(sheetHead(t('Dépenses'))+`<div class="calh"><button type="button" class="ib" data-dm="-1" aria-label="${t('Mois précédent')}">‹</button><div><h3 style="margin:0">${MOIS[m-1]} ${y}</h3><p class="sub" style="margin:0">${tn(L.length,'dépense','dépenses')} · ${eur(tot)}</p></div><button type="button" class="ib" data-dm="1" aria-label="${t('Mois suivant')}"${depM>=cur?' disabled':''}>›</button></div>
  ${Object.keys(bc).length?`<div class="cch" style="margin:0 0 10px">${Object.entries(bc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="chip sm">${esc(tv(k))} · ${eurR(v)}</span>`).join('')}</div>`:''}
  ${L.map(d=>`<button type="button" class="li" data-de="${esc(d.id)}" style="margin-bottom:6px"><div class="m"><b>${esc(tv(d.cat||'Autre'))}</b><small>${fd(d.date)}${d.note?' · '+esc(d.note):''}${d.photo?' · '+t('ticket'):''}</small></div><div class="p">${eur(d.montant)}</div></button>`).join('')||(depE?'':'<div class="hint">'+t('Aucune dépense ce mois-ci.')+'</div>')}
  ${form}${depE?'':'<div class="acts"><button type="button" class="btn mint" id="de_add">'+t('Ajouter une dépense')+'</button></div><div class="hint">'+t('Les dépenses servent au résultat réel et à la prévision de trésorerie. Elles ne sont pas déduites du plafond micro-entrepreneur, qui se calcule sur le chiffre d\'affaires.')+'</div>'}`);
 hydrate();
 const go2=()=>{readDep();drawDep()};
 $('shc').onclick=async e=>{const t=e.target;
  const dm=t.closest('[data-dm]');if(dm){const n=new Date(y,m-1+Number(dm.dataset.dm),1);depM=n.getFullYear()+'-'+pad(n.getMonth()+1,2);drawDep();return}
  if(t.closest('#de_add')){depE={date:(depM===cur?today():depM+'-01'),cat:LSg('lastDepCat','Carburant')};drawDep();return}
  const de=t.closest('[data-de]');if(de){depE=Object.assign({},app.DEP.find(x=>x.id===de.dataset.de));drawDep();return}
  const dc=t.closest('[data-dc]');if(dc){readDep();depE.cat=dc.dataset.dc;drawDep();return}
  if(t.closest('[data-dx]')){readDep();delete depE.photo;drawDep();return}
  if(t.closest('#de_no')){depE=null;drawDep();return}
  if(t.closest('#de_del')){const id=depE.id;depRemove(id);depE=null;window.t&&app.toast(window.t('Dépense supprimée'));drawDep();return}
  if(t.closest('#de_ok')){readDep();const v=num(depE.montant);if(isNaN(v)||v<=0)return app.toast(window.t('Indique le montant'));if(!ok(depE.date))return app.toast(window.t('Indique la date'));
   LSs('lastDepCat',depE.cat||'Autre');depSave({id:depE.id||'dep_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date:depE.date,montant:Math.round(v*100)/100,cat:depE.cat||'Autre',note:(depE.note||'').trim(),photo:depE.photo});depE=null;app.toast(window.t('Dépense enregistrée'));drawDep()}};
 $('shc').onchange=async e=>{const t=e.target;if(t.id!=='de_ph')return;const f=t.files&&t.files[0];t.value='';if(!f)return;readDep();$('de_ps').textContent=window.t('Enregistrement du ticket…');
  try{const b=await compressBlob(f,1400,.75),id='ph'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);await tx('photos','readwrite',s=>s.put({id,blob:b}));depE.photo=id;drawDep()}catch(er){$('de_ps').textContent=window.t('Photo non enregistrée.')}}}
