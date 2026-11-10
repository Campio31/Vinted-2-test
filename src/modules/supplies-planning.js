import { app } from '../state.js';
import { $, LSg, LSs, avail, esc, eur, num, pad, sold, today } from './core.js';
import { colisList } from './live.js';
import { sheetHead, showSheet } from './tools-index.js';
import { unpub } from './publication.js';
import { ldate } from './proofs.js';
import { hh } from './reminders.js';
import { r2 } from './buyers.js';
import { openWizard } from './wizard.js';

app.suppliesUse = suppliesUse;

/* ===== v24 b2 : fournitures et planning ===== */
const fournList=()=>Array.isArray(app.cfg.fourn)?app.cfg.fourn:[];
export const fournLow=()=>fournList().filter(f=>(+f.seuil||0)>0&&(+f.q||0)<=(+f.seuil||0));
export const colisCost=()=>fournList().reduce((a,f)=>a+(+f.c||0)*(+f.u||0),0);
function suppliesUse(sign){const L=fournList();if(!L.some(f=>+f.u>0))return;const before=fournLow().map(f=>f.id),nl=L.map(f=>+f.u>0?Object.assign({},f,{q:Math.max(0,r2((+f.q||0)-sign*f.u)),s:Math.max(0,r2((+f.s||0)+sign*f.u))}):f);app.setCfg({fourn:nl});
 if(sign>0){const nw=fournLow().filter(f=>!before.includes(f.id));if(nw.length)setTimeout(()=>app.toast(t('Plus que {q} {n}',{q:nw[0].q,n:nw[0].n}),null,5500),1500)}}
const save24=app.save;app.save=function(p){const o=app.P.find(x=>x.id===p.id),r=save24(p);try{if(o&&!sold(o)&&sold(p)&&!p.lot)suppliesUse(1);else if(o&&sold(o)&&!sold(p)&&!o.lot)suppliesUse(-1)}catch(e){}return r};
export function openFourn(sel){let rs=false;const draw=()=>{const L=fournList(),cost=colisCost(),e=sel?L.find(f=>f.id===sel):null;
 showSheet(sheetHead(t('Fournitures'))+(rs&&e?`<div class="card"><p class="sub" style="margin:0 0 12px"><b>${esc(e.n)}</b> · ${t('{q} en stock',{q:e.q})}</p><div class="row2 fld"><div><label class="l" for="fo_rq">${t('Quantité ajoutée')}</label><input type="text" inputmode="decimal" id="fo_rq" value="100"></div><div><label class="l" for="fo_rp">${t('Prix total payé')}</label><div class="price"><input type="text" inputmode="decimal" id="fo_rp" placeholder="0"><span>€</span></div></div></div><div class="hint">${t('Le prix à l\'unité est recalculé en moyenne avec ton ancien stock.')}</div></div><div class="acts"><button type="button" class="btn mint" id="fo_rok">${t('Ajouter au stock')}</button><button type="button" class="btn sec" id="fo_no">${t('Retour')}</button></div>`:sel?`<div class="card"><div class="fld"><label class="l" for="fo_n">${t('Nom')}</label><input type="text" id="fo_n" value="${esc(e?e.n:'')}" placeholder="${t('Sachets, cartons, scotch, étiquettes')}"></div>
 <div class="row2 fld"><div><label class="l" for="fo_q">${t('En stock')}</label><input type="text" inputmode="decimal" id="fo_q" value="${e?e.q:''}"></div><div><label class="l" for="fo_s">${t('Alerte à partir de')}</label><input type="text" inputmode="decimal" id="fo_s" value="${e&&e.seuil?e.seuil:''}" placeholder="10"></div></div>
 <div class="row2 fld"><div><label class="l" for="fo_c">${t('Prix à l\'unité')}</label><div class="price"><input type="text" inputmode="decimal" id="fo_c" value="${e&&e.c?e.c:''}"><span>€</span></div></div><div><label class="l" for="fo_u">${t('Utilisé par colis')}</label><input type="text" inputmode="decimal" id="fo_u" value="${e&&e.u?e.u:''}" placeholder="1"></div></div>
 <div class="hint">${t('Si « utilisé par colis » est rempli, le stock baisse tout seul à chaque vente et le coût réel du colis est calculé.')}</div></div>
 <div class="acts"><button type="button" class="btn mint" id="fo_ok">${t('Enregistrer')}</button>${e?`<button type="button" class="btn red" id="fo_del">${t('Supprimer')}</button>`:''}<button type="button" class="btn sec" id="fo_no">${t('Retour')}</button></div>`:
 `<div class="acts" style="margin:0 0 10px"><button type="button" class="btn mint" id="fq_go">${t(L.length?'Refaire le questionnaire':'Répondre au questionnaire')}</button></div><div class="card"><div class="kpis two" style="margin:0"><div class="kpi"><b>${eur(cost)}</b><span>${t('coût réel d\'un colis')}</span></div><div class="kpi"><b>${eur(app.cfg.emb||0)}</b><span>${t('frais d\'emballage dans tes réglages')}</span></div></div>${cost>0&&Math.abs(cost-(app.cfg.emb||0))>.005?`<div class="acts"><button type="button" class="btn sm sec" id="fo_use">${t('Utiliser {c} comme frais d\'emballage',{c:eur(cost)})}</button></div>`:''}</div>
 ${fournLow().length?`<div class="cl cl-o" style="margin-bottom:12px"><i></i><div><b>${t('À racheter')}</b><span>${fournLow().map(f=>esc(f.n)+' ('+f.q+')').join(' · ')}</span></div></div>`:''}
 ${L.map(f=>`<div class="fxr"><button type="button" class="li" data-fe="${esc(f.id)}" style="margin:0;flex:1"><div class="m"><b>${esc(f.n)}</b><small>${f.c?eur(f.c)+' '+t('l\'unité'):''}${f.u?' · '+t('{u} par colis',{u:f.u}):''}${f.s?' · '+t('{x} utilisés',{x:f.s}):''}</small></div><div class="p ${fournLow().includes(f)?'b':''}">${f.q}<small>${t('en stock')}</small></div></button><button type="button" class="chip sm" data-fr="${esc(f.id)}">+ ${t('Racheté')}</button></div>`).join('')||`<div class="empty" style="padding:14px 8px">${t('Ajoute tes sachets, cartons, scotch et étiquettes.')}</div>`}
 <div class="acts"><button type="button" class="btn" id="fo_new">${t('Ajouter une fourniture')}</button></div>`));
 const go1=id=>{sel=id;draw()};
 $('shc').onclick=e=>{if(e.target.closest('#fq_go'))return openFournQ();const b=e.target.closest('[data-fe]');if(b)return go1(b.dataset.fe);const r=e.target.closest('[data-fr]');if(r){sel=r.dataset.fr;rs=true;return draw()}
  if(e.target.closest('#fo_rok')){const f=fournList().find(x=>x.id===sel),n=num($('fo_rq').value),tot=num($('fo_rp').value);if(!f||isNaN(n)||n<=0)return app.toast(t('Indique la quantité'));const nf=Object.assign({},f,{q:r2((+f.q||0)+n)});if(!isNaN(tot)&&tot>0)nf.c=r2((((+f.q||0)*(+f.c||0))+tot)/((+f.q||0)+n));app.setCfg({fourn:fournList().map(x=>x.id===sel?nf:x)});sel=null;rs=false;app.toast(t('Stock mis à jour'));return draw()}
  if(e.target.closest('#fo_new'))return go1('new');if(e.target.closest('#fo_no')){sel=null;rs=false;return draw()}
  if(e.target.closest('#fo_use')){app.setCfg({emb:r2(colisCost())});app.toast(t('Frais d\'emballage mis à jour'));return draw()}
  if(e.target.closest('#fo_del')){app.setCfg({fourn:fournList().filter(f=>f.id!==sel)});sel=null;return draw()}
  if(e.target.closest('#fo_ok')){const n=$('fo_n').value.trim();if(!n)return app.toast(t('Donne un nom'));const g=id=>{const v=num($('fo_'+id).value);return isNaN(v)?0:v},o={id:sel==='new'?'f'+Date.now().toString(36):sel,n,q:g('q'),seuil:g('s'),c:g('c'),u:g('u')},old=fournList().find(f=>f.id===o.id);if(old&&old.s)o.s=old.s;
   app.setCfg({fourn:old?fournList().map(f=>f.id===o.id?o:f):[...fournList(),o]});sel=null;draw()}};
 };draw()}

/* --- planning de la semaine --- */
const PLK={photo:'Photos',sourcing:'Sourcing',live:'Live',depot:'Dépôt colis',autre:'Autre'},JOURS=[1,2,3,4,5,6,0];
const jourNom=j=>new Date(2024,0,7+j).toLocaleDateString(app.LOC,{weekday:'long'});
const planList=()=>Array.isArray(app.cfg.plan)?app.cfg.plan:[];
function planDone(){const o=LSg('planDone',{}),d=today(),r={};r[d]=o[d]||{};return r}
function taskDone(k){return !!planDone()[today()][k]}
export function setTaskDone(k,v){const o=planDone();if(v)o[today()][k]=1;else delete o[today()][k];LSs('planDone',o)}
function planToday(){const dow=new Date().getDay(),T=[];
 planList().filter(s=>+s.j===dow).sort((a,b)=>(a.h||'').localeCompare(b.h||'')).forEach(s=>T.push({k:'s:'+s.id,h:s.h,txt:t(PLK[s.k]||'Autre')+(s.n?' · '+s.n:''),kind:s.k}));
 const nc=colisList().length;if(nc)T.push({k:'a:colis',txt:t('Déposer {n} colis avant {h}',{n:nc,h:hh(app.cfg.depotH)}),kind:'depot',auto:1});
 const sp=app.P.filter(p=>avail(p)&&!p.photo&&!p.ex).length;if(sp)T.push({k:'a:photo',txt:t('Photographier {n} pièces sans photo',{n:Math.min(sp,15)}),kind:'photo',auto:1});
 const u=app.P.filter(unpub).length,pt=app.P.filter(p=>p.pub===today()).length;if(u&&pt<5)T.push({k:'a:pub',txt:t('Publier {n} pièces',{n:5-pt}),kind:'autre',auto:1,tool:'pub'});
 if(app.cfg.liveAt){const dt=new Date(app.cfg.liveAt);if(!isNaN(dt)&&ldate(dt)===today())T.push({k:'a:live',h:pad(dt.getHours(),2)+':'+pad(dt.getMinutes(),2),txt:t('Live TikTok'),kind:'live',auto:1})}
 if(fournLow().length)T.push({k:'a:fourn',txt:t('Racheter : {x}',{x:fournLow().map(f=>f.n).join(', ')}),kind:'autre',auto:1,tool:'fourn'});
 return T}
function planCounts(){const T=planToday();return{n:T.length,d:T.filter(x=>taskDone(x.k)).length}}
export function planTodayHTML(){const T=planToday();return T.length?T.map(x=>`<label class="chk plt${taskDone(x.k)?' dn':''}"><input type="checkbox" data-pt="${esc(x.k)}"${taskDone(x.k)?' checked':''}><span>${x.h?'<b>'+hh(x.h)+'</b> ':''}${esc(x.txt)}</span></label>`).join(''):`<p class="sub" style="margin:0">${t('Rien de prévu aujourd\'hui. Ajoute des créneaux dans le planning de la semaine.')}</p>`}
/* le planning vit dans le calendrier des ventes du Bilan : points sur les jours qui ont des créneaux, détail du jour */
app.planHas=d=>d>=today()&&planList().some(s=>+s.j===new Date(d+'T12:00:00').getDay());
app.planDayHTML=d=>{if(d===today())return planTodayHTML();const dow=new Date(d+'T12:00:00').getDay(),S=planList().filter(s=>+s.j===dow).sort((a,b)=>(a.h||'').localeCompare(b.h||''));return S.length?S.map(s=>`<div class="kr"><span>${s.h?'<b>'+hh(s.h)+'</b> · ':''}${esc(t(PLK[s.k]||'Autre')+(s.n?' · '+s.n:''))}</span></div>`).join(''):`<p class="sub" style="margin:0 0 6px">${t('Rien de prévu ce jour-là.')}</p>`};
export function openPlanning(){let ed=null;const draw=()=>{const dn=planCounts();
 showSheet(sheetHead(t('Planning'))+`<div class="card"><h3 style="margin:0 0 4px">${t('Aujourd\'hui')}</h3><p class="sub" style="margin:0 0 10px">${dn.n?t('{d} sur {n} faites',{d:dn.d,n:dn.n}):''}</p><div id="pl_t">${planTodayHTML()}</div></div>
 <div class="card"><h3 style="margin:0 0 10px">${t('La semaine')}</h3>${JOURS.map(j=>{const S=planList().filter(s=>+s.j===j).sort((a,b)=>(a.h||'').localeCompare(b.h||''));return`<div class="pwd${j===new Date().getDay()?' now':''}"><b>${esc(jourNom(j))}</b><div>${S.map(s=>`<button type="button" class="pws" data-pe="${esc(s.id)}"><i class="k-${s.k}"></i>${s.h?hh(s.h)+' · ':''}${t(PLK[s.k]||'Autre')}${s.n?' · '+esc(s.n):''}</button>`).join('')}<button type="button" class="pwa" data-pa="${j}" aria-label="${t('Ajouter')}">+</button></div></div>`}).join('')}</div>`+(ed?`<div class="card"><h3 style="margin:0 0 10px">${ed.id?t('Modifier le créneau'):t('Nouveau créneau')} · ${esc(jourNom(+ed.j))}</h3><div class="chips" id="pl_k" style="margin-bottom:12px">${Object.keys(PLK).map(k=>`<button type="button" class="chip sm${ed.k===k?' on':''}" data-pk="${k}">${t(PLK[k])}</button>`).join('')}</div><div class="row2"><div><label class="l" for="pl_h">${t('Heure')}</label><input type="time" id="pl_h" value="${esc(ed.h||'')}"></div><div><label class="l" for="pl_n">${t('Précision')}</label><input type="text" id="pl_n" value="${esc(ed.n||'')}" placeholder="${t('Vide-grenier, ballot…')}"></div></div><div class="acts"><button type="button" class="btn mint" id="pl_ok">${t('Enregistrer')}</button>${ed.id?`<button type="button" class="btn red" id="pl_del">${t('Supprimer')}</button>`:''}<button type="button" class="btn sec" id="pl_no">${t('Annuler')}</button></div></div>`:''));
 $('shc').onchange=e=>{const c=e.target.closest('[data-pt]');if(c){setTaskDone(c.dataset.pt,c.checked);draw()}};
 $('shc').onclick=e=>{const a=e.target.closest('[data-pa]');if(a){ed={j:+a.dataset.pa,k:'photo',h:'',n:''};return draw()}const s=e.target.closest('[data-pe]');if(s){ed=Object.assign({},planList().find(x=>x.id===s.dataset.pe));return draw()}
  const k=e.target.closest('[data-pk]');if(k){ed.h=$('pl_h').value;ed.n=$('pl_n').value;ed.k=k.dataset.pk;return draw()}if(e.target.closest('#pl_no')){ed=null;return draw()}
  if(e.target.closest('#pl_del')){app.setCfg({plan:planList().filter(x=>x.id!==ed.id)});ed=null;return draw()}
  if(e.target.closest('#pl_ok')){const o=Object.assign({},ed,{h:$('pl_h').value,n:$('pl_n').value.trim()});if(!o.id)o.id='s'+Date.now().toString(36);app.setCfg({plan:ed.id?planList().map(x=>x.id===o.id?o:x):[...planList(),o]});ed=null;draw()}}};draw()}
const rappelsList24=app.rappelsList;app.rappelsList=function(){const R=rappelsList24();try{const f=fournLow();if(f.length)R.push({k:'fourn',tone:'o',txt:t('Plus que {q} {n}',{q:f[0].q,n:f[0].n}),tool:'fourn'});const pc=planCounts();if(pc.n)R.push({k:'plan',tone:pc.d>=pc.n?'g':'o',txt:t('Planning du jour : {d} sur {n} faites',{d:pc.d,n:pc.n}),tool:'planning'})}catch(e){}return R};
/* --- questionnaire des fournitures : choisis ce que tu utilises, puis règle le stock de chaque article (refaisable à tout moment) --- */
const FQ_ITEMS=[['sachets','Sachets d\'expédition'],['cartons','Cartons'],['scotch','Rouleaux de scotch'],['etiq','Étiquettes d\'envoi'],['papier','Papier de soie ou kraft'],['zip','Sachets zip'],['cintres','Cintres'],['cartes','Cartes de remerciement']];
export function openFournQ(){
 const cur=fournList(),a0=Object.assign({},app.cfg.fournQ||{});
 if(!a0.items)a0.items=FQ_ITEMS.filter(([k])=>cur.some(f=>f.id==='q-'+k)).map(([k])=>k);
 a0.det=a0.det||{};cur.forEach(f=>{if(String(f.id).startsWith('q-'))a0.det[f.id.slice(2)]={q:f.q,c:f.c,u:f.u,seuil:f.seuil}});
 openWizard({title:'Fournitures',intro:'Quelques questions sur ce que tu utilises pour tes colis. Max suit ensuite le stock, l\'alerte de rachat et le coût réel d\'un colis. Tu peux refaire le questionnaire à tout moment.',answers:a0,
  steps:[{k:'items',type:'multi',q:'Quelles fournitures utilises-tu ?',h:'Choisis tout ce que tu utilises pour emballer.',o:FQ_ITEMS,need:a=>(a.items||[]).length>0,needMsg:'Choisis au moins une fourniture'},
   {k:'det',type:'table',q:'Où en es-tu pour chacune ?',h:'Laisse vide ce que tu ne sais pas. « Utilisé par colis » fait baisser le stock tout seul à chaque vente.',items:a=>FQ_ITEMS.filter(([k])=>(a.items||[]).includes(k)).map(([k,l])=>({k,l})),cols:[{k:'q',l:'En stock'},{k:'c',l:'Prix à l\'unité',u:'€'},{k:'u',l:'Utilisé par colis'},{k:'seuil',l:'Alerte à partir de'}]}],
  onDone:a=>{const chosen=a.items||[],keep=cur.filter(f=>!String(f.id).startsWith('q-')||chosen.includes(String(f.id).slice(2))),out=keep.filter(f=>!String(f.id).startsWith('q-'));
   chosen.forEach(k=>{const l=FQ_ITEMS.find(x=>x[0]===k),d=(a.det||{})[k]||{},old=cur.find(f=>f.id==='q-'+k);out.push(Object.assign({},old||{},{id:'q-'+k,n:t(l[1]),q:+d.q||0,c:+d.c||0,u:+d.u||0,seuil:+d.seuil||0}))});
   app.setCfg({fourn:out,fournQ:a});app.toast(t('Fournitures mises à jour'));app.renderAll();openFourn()}})}