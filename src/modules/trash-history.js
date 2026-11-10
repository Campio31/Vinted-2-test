import { app } from '../state.js';
import { $, clean, esc, eur, fd, isnum, nextId, title } from './core.js';
import { persist, tx } from './storage.js';
import { metaGet, metaSet, queue } from './sync.js';
import { sheetHead, showSheet } from './tools-index.js';

app.save = save;
app.remove = remove;
app.openTrash = openTrash;
app.histHTML = histHTML;

/* --- corbeille de 30 jours et historique par pièce --- */
const HLAB={cat:'catégorie',sub:'type',marque:'marque',modele:'modèle',taille:'taille',genre:'genre',grade:'grade',etat:'état',achat:'prix d\'achat',bac:'bac',ballot:'ballot',prov:'provenance',collab:'collab',madein:'made in',note:'note'};
export function diffEv(o,p){if(!o)return['Ajoutée au stock'];const ev=[];
 if(o.statut!==p.statut){if(p.statut==='Vendu')ev.push('Vendue '+eur(p.pv)+' sur '+(p.canal||'Vinted'));else if(o.statut==='Vendu'&&p.statut==='Disponible')ev.push('Remise en stock');else if(p.statut==='Pas Disponible')ev.push('Marquée indisponible');else if(p.statut==='Disponible')ev.push('Remise en stock')}
 else if(p.statut==='Vendu'&&(o.pv!==p.pv||o.dv!==p.dv||o.canal!==p.canal||o.frais!==p.frais))ev.push('Vente modifiée');
 if(!o.pub&&p.pub)ev.push('Publiée');else if(o.pub&&p.pub&&o.pub!==p.pub)ev.push('Date de publication modifiée');
 if(p.pvise!==o.pvise&&isnum(p.pvise))ev.push('Prix visé : '+eur(p.pvise));
 if((p.retours||[]).length>(o.retours||[]).length){const r=p.retours[p.retours.length-1];ev.push('Retour enregistré'+(r&&r.m?' ('+r.m.toLowerCase()+')':''))}
 const ch=Object.keys(HLAB).filter(k=>JSON.stringify(o[k])!==JSON.stringify(p[k])).map(k=>HLAB[k]);if(ch.length)ev.push('Modifiée : '+ch.join(', '));
 return ev}
function save(p){p=clean(p);const i=app.P.findIndex(x=>x.id===p.id),old=i<0?null:app.P[i],ev=diffEv(old,p);
 if(ev.length)p=Object.assign({},p,{h:[...(p.h||[]),...ev.map(e=>({t:Date.now(),e}))].slice(-40)});
 if(i<0)app.P.unshift(p);else app.P[i]=p;app.renderAll();
 persist(async()=>{await tx('pieces','readwrite',s=>s.put(p));await queue('put',p.id);if(p.photo&&(!old||old.photo!==p.photo))await queue('photo',p.photo)});return p}
async function trashAdd(p){const now=Date.now(),t=((await metaGet('trash'))||[]).filter(x=>now-x.t<30*864e5);t.push({p,t:now});await metaSet('trash',t.slice(-300))}
function remove(id){const old=app.P.find(x=>x.id===id);app.P=app.P.filter(x=>x.id!==id);app.renderAll();return persist(async()=>{if(old&&!old.ex)await trashAdd(old);await tx('pieces','readwrite',s=>s.delete(id));await queue('del',id)})}
async function openTrash(){const now=Date.now(),T=((await metaGet('trash'))||[]).filter(x=>now-x.t<30*864e5).sort((a,b)=>b.t-a.t);
 showSheet(sheetHead(t('Corbeille'))+`<p class="sub">${t('Les pièces supprimées restent 30 jours sur cet appareil avant d\'être effacées pour de bon.')}</p>${T.length?T.map(x=>`<div class="card" style="padding:12px 14px"><b>${esc(title(x.p))}</b><div class="hint" style="margin:2px 0 8px">${esc([x.p.code,x.p.taille].filter(Boolean).join(' · '))} · ${t('supprimée le {d}, {n} j restants',{d:fd(new Date(x.t).toISOString().slice(0,10)),n:30-Math.floor((now-x.t)/864e5)})}</div><button type="button" class="btn sm sec" data-rs="${x.t}">${t('Restaurer')}</button></div>`).join('')+'<div class="acts"><button type="button" class="btn sec" id="tr_all">'+t('Vider la corbeille')+'</button></div>':'<div class="empty">'+t('La corbeille est vide.')+'</div>'}`);
 $('shc').onclick=async e=>{const b=e.target.closest('[data-rs]');if(b){const it=T.find(x=>String(x.t)===b.dataset.rs);if(!it)return;let p=it.p;if(app.P.some(x=>x.id===p.id))p=Object.assign({},p,{id:nextId()});app.save(p);await metaSet('trash',T.filter(x=>x!==it));app.toast(t('Pièce restaurée'));openTrash();return}
  if(e.target.closest('#tr_all')){const a=$('tr_all');if(a.dataset.sure!=='1'){a.dataset.sure='1';a.textContent=t('Confirmer : vider définitivement');return}await metaSet('trash',[]);openTrash()}}}
function histHTML(p){const h=(p.h||[]).slice().reverse();if(!h.length)return'';
 return`<details class="card hist"><summary>${t('Historique')} · ${h.length}</summary>${h.slice(0,15).map(x=>{const d=new Date(x.t);return`<div class="hr2"><span>${fd(d.toISOString().slice(0,10))}</span><b>${esc(trEv(x.e))}</b></div>`}).join('')}</details>`}
/* l'historique est enregistré en français ; on le traduit à l'affichage */
function trEv(e){let m;
 if(m=/^Vendue (.+) sur (.+)$/.exec(e))return t('Vendue {p} sur {c}',{p:m[1],c:tv(m[2])});
 if(m=/^Prix visé : (.+)$/.exec(e))return t('Prix visé : {p}',{p:m[1]});
 if(m=/^Retour enregistré \((.+)\)$/.exec(e))return t('Retour enregistré')+' ('+t(m[1])+')';
 if(m=/^Modifiée : (.+)$/.exec(e))return t('Modifiée : {l}',{l:m[1].split(', ').map(x=>t(x)).join(', ')});
 return t(e)}
