import { app } from '../state.js';
import { $, LSg, LSs, avail, esc, eur, num, title, today } from './core.js';
import { closeSheet } from './piece-sheet.js';
import { defFrais, fN } from './settings-core.js';
import { CANAUX_V, priceFor } from './sell-card.js';
import { sheetHead, showSheet } from './tools-index.js';
import { bulkMod, bulkUndo, buyerLine, r2 } from './buyers.js';

/* ---------- vente groupée : un paiement, un colis, plusieurs pièces ---------- */
let GS=null;
function gsRows(){const L=GS.ids.map(id=>app.P.find(p=>p.id===id)).filter(Boolean),tot=num(GS.prix),fr=num(GS.frais)||0;
 const wf={conseil:p=>priceFor(p)||p.achat||0,achat:p=>p.achat||0,egal:()=>1}[GS.mode];let w=L.map(wf),W=w.reduce((a,b)=>a+b,0);if(!W){w=L.map(()=>1);W=L.length}
 let u=0,uf=0;return L.map((p,i)=>{const last=i===L.length-1,a=isNaN(tot)?0:last?r2(tot-u):r2(tot*w[i]/W),f=last?r2(fr-uf):r2(fr*w[i]/W);u+=a;uf+=f;return{p,pv:a,frais:f}})}
function gsAlloc(){const R=gsRows(),tot=num(GS.prix),b=GS.pseudo.trim()?buyerLine(GS.pseudo):'';
 return`${R.map(r=>{const g=r.pv-(r.p.achat||0)-r.frais;return`<div class="gsr"><span>${esc(title(r.p))}<small>${esc([r.p.taille,r.p.code].filter(Boolean).join(' · '))}</small></span><b>${eur(r.pv)}</b><i class="${g>=0?'g':'b'}">${g>=0?'+':''}${eur(g)}</i></div>`}).join('')}
 <div class="gsr tot"><span>${t('Total')}</span><b>${isNaN(tot)?'—':eur(tot)}</b><i class="${R.reduce((a,r)=>a+r.pv-(r.p.achat||0)-r.frais,0)>=0?'g':'b'}">${eur(R.reduce((a,r)=>a+r.pv-(r.p.achat||0)-r.frais,0))}</i></div>`}
export function openGroupSale(ids){const L=ids.map(id=>app.P.find(p=>p.id===id)).filter(p=>p&&avail(p));if(L.length<2)return app.toast(t('Choisis au moins 2 pièces en stock'));
 const canal=LSg('lastCanal','Vinted'),sum=r2(L.reduce((a,p)=>a+(priceFor(p)||0),0));
 GS={ids:L.map(p=>p.id),prix:sum?fN(sum):'',canal,frais:fN(defFrais(sum,canal)),ft:false,pseudo:'',date:today(),mode:'conseil'};
 const draw=()=>{showSheet(sheetHead(t('Vente groupée'))+`<div class="card"><p class="sub" style="margin:0 0 12px">${tn(L.length,'pièce','pièces')} · ${t('un seul paiement, un seul colis')}</p>
  <div class="row2 fld"><div><label class="l" for="gs_p">${t('Prix total payé')}</label><div class="price"><input type="text" inputmode="decimal" id="gs_p" value="${esc(GS.prix)}"><span>€</span></div></div><div><label class="l" for="gs_f">${t('Frais du colis')}</label><div class="price"><input type="text" inputmode="decimal" id="gs_f" value="${esc(GS.frais)}"><span>€</span></div></div></div>
  <div class="chips">${CANAUX_V.map(x=>`<button type="button" class="chip sm${GS.canal===x?' on':''}" data-gc="${x}">${tv(x)}</button>`).join('')}</div>
  <div class="fld" style="margin-top:12px"><div><label class="l" for="gs_ps">${t('@pseudo de l\'acheteur (facultatif)')}</label><input type="text" id="gs_ps" value="${esc(GS.pseudo)}" placeholder="@${t('pseudo')}" autocapitalize="none" autocomplete="off"></div></div><div id="gs_ps_w" class="bwr"></div><div class="fld" style="margin-top:12px"><label class="l" for="gs_d">${t('Date de vente')}</label><input type="date" id="gs_d" value="${GS.date}"></div></div>
  <div class="card"><span class="l">${t('Répartition du prix et des frais')}</span><div class="chips" style="margin:8px 0 12px">${[['conseil','Selon le prix conseillé'],['achat','Selon le prix d\'achat'],['egal','Parts égales']].map(([k,l])=>`<button type="button" class="chip sm${GS.mode===k?' on':''}" data-gm="${k}">${t(l)}</button>`).join('')}</div><div id="gs_al">${gsAlloc()}</div>
  <div class="hint">${t('Chaque pièce garde sa part du prix et des frais : les marges par pièce restent justes.')}</div></div>
  <div class="acts"><button type="button" class="btn mint" id="gs_ok">${t('Confirmer la vente')}</button><button type="button" class="btn sec" id="gs_no">${t('Annuler')}</button></div>`);
  const rd=()=>{GS.prix=$('gs_p').value;GS.frais=$('gs_f').value;GS.pseudo=$('gs_ps').value;GS.date=$('gs_d').value||today()},up=()=>{$('gs_al').innerHTML=gsAlloc()};
  $('gs_ps_w').innerHTML=GS.pseudo?buyerLine(GS.pseudo):'';
  $('gs_p').oninput=()=>{rd();if(!GS.ft){GS.frais=fN(defFrais(num(GS.prix)||0,GS.canal));$('gs_f').value=GS.frais}up()};$('gs_f').oninput=()=>{GS.ft=true;rd();up()};$('gs_ps').addEventListener('input',rd);$('gs_d').onchange=rd;
  $('shc').onclick=e=>{const c=e.target.closest('[data-gc]');if(c){rd();GS.canal=c.dataset.gc;if(!GS.ft)GS.frais=fN(defFrais(num(GS.prix)||0,GS.canal));return draw()}const m=e.target.closest('[data-gm]');if(m){rd();GS.mode=m.dataset.gm;return draw()}};
  $('gs_no').onclick=()=>closeSheet();
  $('gs_ok').onclick=()=>{rd();const tot=num(GS.prix);if(isNaN(tot)||tot<0)return app.toast(t('Indique le prix total'));
   const R=gsRows(),lot='L'+Date.now().toString(36),vt=Date.now(),ps=GS.pseudo.trim().replace(/^@+/,''),canal=GS.canal||'Vinted',first=R[0].p.id;LSs('lastCanal',canal);
   const out=bulkMod(R.map(r=>r.p.id),q=>{const r=R.find(x=>x.p.id===q.id);const n=Object.assign(q,{statut:'Vendu',pv:r.pv,frais:r.frais,canal,dv:GS.date,vt,lot,lotn:R.length});if(ps)n.acheteur=ps;if(q.id===first)n.fo=1;return n});
   app.suppliesUse(1);closeSheet();app.selSet(false);const ben=R.reduce((a,r)=>a+r.pv-(r.p.achat||0)-r.frais,0);
   app.toast(t('Lot vendu · bénéfice {b}',{b:eur(ben)}),()=>{bulkUndo(out);app.suppliesUse(-1)},7000)}};draw()}
