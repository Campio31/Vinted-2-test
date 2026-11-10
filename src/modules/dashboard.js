import { app } from '../state.js';
import { $, LSg, LSs, addDays, age, avail, days, dj, esc, eur, eurR, ok, pad, profit, sold, title, today } from './core.js';
import { hydrate } from './photos.js';
import { go } from './nav.js';
import { catSvg } from './stock-view.js';
import { activeChips, activeCount, facet, filterLabel, openFilters } from './filters.js';

app.renderDash = renderDash;

/* ---------- bilan ---------- */
/** Période et ventes du dernier dessin du Bilan, pour les indicateurs des onglets (bilan-tabs.js). */
export const bilCtx={inP:[],S:null,from:'',lbl:''};
export function stats(list){const s=list.filter(sold);const ca=s.reduce((a,x)=>a+(x.pv||0),0),cost=s.reduce((a,x)=>a+(x.achat||0),0),fr=s.reduce((a,x)=>a+(x.frais||0),0),ben=ca-cost-fr;
 const dl=s.filter(x=>ok(x.dv)&&(ok(x.pub)||ok(x.entree))).map(x=>Math.max(0,days(ok(x.pub)?x.pub:x.entree,x.dv)));
 return{s,n:s.length,ca,cost,fr,ben,marge:ca?ben/ca:0,panier:s.length?ca/s.length:0,delai:dl.length?dl.reduce((a,b)=>a+b,0)/dl.length:0}}
export function group(list,key){const o={};list.forEach(x=>{const k=(x[key]||'Non renseigné');const g=o[k]=o[k]||{k,n:0,ca:0,ben:0};g.n++;g.ca+=x.pv||0;g.ben+=profit(x)});return Object.values(o)}
/** Barres horizontales ; avec `medals`, les trois premières lignes (déjà classées) passent en or, argent et bronze. */
const MEDAL=['gold','silver','bronze'];
export function hbars(rows,fmt,medals){if(!rows.length)return'<div class="hint">'+t('Pas encore de données.')+'</div>';const mx=Math.max(...rows.map(r=>Math.abs(r.v)),1);return rows.map((r,i)=>{const md=medals&&i<3&&r.v>0?MEDAL[i]:'';return`<div class="hb${md?' md-'+md:''}"><span class="n">${md?`<em class="mdl" aria-hidden="true">${i+1}</em>`:''}${esc(tv(r.k))}</span><div class="tr"><i class="${r.v<0?'neg':''}" style="width:${Math.max(3,Math.abs(r.v)/mx*100)}%"></i></div><span class="v">${fmt(r.v)}</span>${r.sub?`<small>${esc(r.sub)}</small>`:''}</div>`}).join('')}
/* filtres du Bilan : période (30 jours, 90 jours, Tout au premier plan, le reste dans « Filtres ») et critères sur les ventes */
const BADV=['pf','cat','marque','prov','genre'];
const badv=Object.assign({pf:'',cat:'',marque:'',prov:'',genre:''},LSg('bilAdv',{}));
const bilSave=()=>LSs('bilAdv',Object.assign({},badv));
const PERL={7:'7 derniers jours',30:'30 derniers jours',90:'90 derniers jours',mo:'Ce mois-ci',lmo:'Mois dernier',yr:'Cette année',0:'Depuis le début'};
/** Période du Bilan : { from, to, lbl } (app.period : 30, 90, 0 = tout, ou '7', 'mo', 'lmo', 'yr'). */
export function bilRange(){const p=app.period,t0=today();
 if(p==='mo')return{from:t0.slice(0,7)+'-01',to:'',lbl:t('ce mois-ci')};
 if(p==='lmo'){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);const m=d.getFullYear()+'-'+pad(d.getMonth()+1,2);return{from:m+'-01',to:m+'-31',lbl:t('le mois dernier')}}
 if(p==='yr')return{from:t0.slice(0,4)+'-01-01',to:'',lbl:t('cette année')};
 const n=+p||0;return{from:n?addDays(t0,-n):'',to:'',lbl:n?t('sur les {n} derniers jours',{n}):t('depuis le début')}}
const advOk=x=>(!badv.pf||(x.canal||'Vinted')===badv.pf)&&(!badv.cat||x.cat===badv.cat)&&(!badv.marque||x.marque===badv.marque)&&(!badv.prov||x.prov===badv.prov)&&(!badv.genre||x.genre===badv.genre);
/** Vente retenue par les filtres du Bilan (plateforme, catégorie, marque, provenance, genre, compte), sans la période. */
export const bilOk=x=>advOk(x)&&(!app.cptFilt||(app.compteOf(x)||{}).id===app.cptFilt);
const perCustom=()=>!(app.period===30||app.period===90||!app.period);
function openBilanFilters(){
 const st={...badv,per:String(app.period||0),cf:app.cptFilt||''};
 const base=()=>app.P.filter(sold);
 openFilters({title:t('Filtres du bilan'),state:st,
  groups:()=>{const L=base(),CP=app.hasComptes()?app.comptes():[];return[
   {k:'per',l:t('Période'),o:Object.entries(PERL).map(([k,l])=>[k,t(l)])},
   ...(CP.length>1?[{k:'cf',l:t('Compte de vente'),o:CP.map(c=>[c.id,c.n,L.filter(x=>(app.compteOf(x)||{}).id===c.id).length])}]:[]),
   {k:'pf',l:t('Plateforme'),o:facet(L,x=>x.canal||'Vinted').map(([v,n])=>[v,tv(v),n])},
   {k:'cat',l:t('Catégorie'),o:facet(L,x=>x.cat).map(([v,n])=>[v,tv(v),n])},
   {k:'genre',l:t('Genre'),o:facet(L,x=>x.genre).map(([v,n])=>[v,tv(v),n])},
   {k:'marque',l:t('Marque'),o:facet(L,x=>x.marque).map(([v,n])=>[v,v,n])},
   {k:'prov',l:t('Provenance'),o:facet(L,x=>x.prov).map(([v,n])=>[v,tv(v),n])}].filter(g=>g.o.length)},
  changed:()=>{BADV.forEach(k=>{badv[k]=st[k]||''});bilSave();app.cptFilt=st.cf||'';const v=st.per||'0';app.period=/^\d+$/.test(v)&&v!=='7'?+v:v;renderDash()},
  count:()=>{const r=bilRange();return base().filter(x=>(!r.from||(x.dv||'')>=r.from)&&(!r.to||(x.dv||'')<=r.to)&&advOk(x)&&(!st.cf||(app.compteOf(x)||{}).id===st.cf)).length},
  clear:()=>{BADV.forEach(k=>{st[k]=''});st.cf='';st.per='30'}})}
function renderDash(){
 const CP=app.hasComptes()?app.comptes():[];if(app.cptFilt&&!CP.some(c=>c.id===app.cptFilt))app.cptFilt='';
 const nAdv=activeCount(badv,BADV)+(app.cptFilt?1:0)+(perCustom()?1:0);
 const act=activeChips(Object.assign({},badv,{cf:app.cptFilt||'',per:perCustom()?String(app.period):''}),['per','cf',...BADV],{per:v=>t(PERL[v]),cf:v=>(CP.find(c=>c.id===v)||{}).n||v,pf:v=>tv(v),cat:v=>tv(v),genre:v=>tv(v),prov:v=>tv(v)});
 $('per').innerHTML=[[30,'30 jours'],[90,'90 jours'],[0,'Tout']].map(([k,l])=>`<button type="button" class="chip${app.period===k?' on':''}" data-p="${k}">${t(l)}</button>`).join('')+`<button type="button" class="chip fbtn${nAdv?' on':''}" data-badv="1">${filterLabel(nAdv)}</button>`+act; if(!app.P.length){$('dsh').innerHTML=`<div class="card empty">${app.loaded?t('Le bilan apparaît dès que tu as des pièces.')+'<br><button class="btn" id="exb2" type="button">'+t('Charger des exemples')+'</button>':t('Chargement…')}</div>`;if($('exb2'))$('exb2').onclick=app.loadExamples;return}
 const {from,to,lbl}=bilRange();
 const inP=app.P.filter(x=>sold(x)&&(!from||(x.dv||'')>=from)&&(!to||(x.dv||'')<=to)&&advOk(x)&&(!app.cptFilt||(app.compteOf(x)||{}).id===app.cptFilt)),S=stats(inP),st=app.P.filter(avail);Object.assign(bilCtx,{inP,S,from,lbl});
 const rets=[];app.P.forEach(x=>(x.retours||[]).forEach(r=>{if(ok(r.d)&&(!from||r.d>=from)&&(!to||r.d<=to))rets.push(r)}));const retSum=rets.reduce((a,r)=>a+(r.p||0),0);
 const stCost=st.reduce((a,x)=>a+(x.achat||0),0),old=st.filter(x=>ok(x.pub)&&days(x.pub,today())>=30).sort((a,b)=>days(b.pub,today())-days(a.pub,today()));
 const ecoul=app.P.length?app.P.filter(sold).length/app.P.length:0,avgAge=st.length?st.reduce((a,x)=>a+age(x),0)/st.length:0;
 const pl=group(inP,'canal').sort((a,b)=>b.ben-a.ben),ct=group(inP,'cat').sort((a,b)=>b.ben-a.ben),br=group(inP.filter(x=>x.marque),'marque').sort((a,b)=>b.ben-a.ben).slice(0,6),sr=group(inP.filter(x=>x.prov),'prov').sort((a,b)=>b.ben-a.ben);
 const months=[];for(let i=5;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);months.push(d.getFullYear()+'-'+pad(d.getMonth()+1,2))}
 const ms=months.map(m=>({m,...stats(app.P.filter(x=>sold(x)&&(x.dv||'').startsWith(m)))})),mxm=Math.max(...ms.map(x=>x.ca),1);
 const mn=m=>new Date(m+'-15T12:00:00').toLocaleDateString(app.LOC,{month:'short'}).replace('.','');
 $('dsh').innerHTML=app.goalHTML()+`${app.tresoCardHTML()}${app.gamCardHTML()}${app.calCardHTML()}${app.defiCardHTML()}
 <div class="hero"><div class="t">${t('Bénéfice net {l}',{l:lbl})}</div><div class="big">${eur(S.ben)}</div><div class="s">${tn(S.n,'vente','ventes')} · ${t('{c} encaissés',{c:eur(S.ca)})} · ${t('marge {m} %',{m:(S.marge*100).toFixed(0)})}</div></div>
 <div class="kpis"><div class="kpi"><b>${eurR(S.panier)}</b><span>${t('panier moyen')}</span></div><div class="kpi"><b>${S.n?dj(S.delai):'—'}</b><span>${t('délai avant la vente')}</span></div><div class="kpi"><b>${(ecoul*100).toFixed(0)} %</b><span>${t('pièces vendues')}</span></div></div>
 ${rets.length?`<div class="kpis two"><div class="kpi"><b>${rets.length}</b><span>${t(rets.length>1?'retours':'retour')} ${lbl}</span></div><div class="kpi"><b>${eurR(retSum)}</b><span>${t('remboursés')}${S.ca?t(' ({p} % du CA)',{p:(retSum/S.ca*100).toFixed(0)}):''}</span></div></div>`:''}
 ${app.calHTML()}${app.depCardHTML(from,lbl)}<div class="card"><h3>${t('Stock actuel')}</h3><p class="sub">${tn(st.length,'pièce','pièces')} ${t('à vendre')}</p>
  <div class="kpis two" style="margin:0"><div class="kpi"><b>${eurR(stCost)}</b><span>${t('argent immobilisé')}</span></div><div class="kpi"><b>${st.length?dj(avgAge):'—'}</b><span>${t('ancienneté moyenne')}</span></div></div>
  ${app.pubBlock(st)}${old.length?`<div style="margin-top:14px"><span class="l">${t('En ligne depuis 30 jours et plus, à relancer ou baisser · {n}',{n:old.length})}</span>${old.slice(0,5).map(x=>`<button type="button" class="li" data-id="${esc(x.id)}" style="margin-bottom:6px"><div class="th">${catSvg(x)}</div><div class="m"><b>${esc(title(x))}</b><small>${esc([x.taille,tv(x.cat)].filter(Boolean).join(' · '))}</small></div><div class="p"><span class="tag x">${dj(days(x.pub,today()))}</span>${(a=>a.ok?`<small>${t('conseillé {p}',{p:eur(a.reco)})}</small>`:'')(app.advice(x))}</div></button>`).join('')}</div>`:'<div class="hint" style="margin-top:12px">'+t('Aucune pièce en ligne ne stagne depuis plus de 30 jours.')+'</div>'}</div>
 <div class="card"><h3>${t('Six derniers mois')}</h3><p class="sub">${t('Chiffre d\'affaires et bénéfice net par mois de vente')}</p><div class="mo">${ms.map(x=>`<div><b>${x.n?eurR(x.ben):''}</b><div class="pair"><i class="c" style="height:${x.ca/mxm*100}%;${x.ca?'':'display:none'}"></i><i class="p" style="height:${Math.max(0,x.ben)/mxm*100}%;${x.ben>0?'':'display:none'}"></i></div>${mn(x.m)}</div>`).join('')}</div><div class="lgd"><span>${t('Chiffre d\'affaires')}</span><span class="p">${t('Bénéfice net')}</span></div></div>
 <div class="card"><h3>${t('Par plateforme')}</h3><p class="sub">${t('Bénéfice net {l}',{l:lbl})}</p>${hbars(pl.map(g=>({k:g.k,v:g.ben,sub:tn(g.n,'vente','ventes')+' · '+eur(g.ca)})),eurR)}</div>
 ${CP.length>1?`<div class="card"><h3>${t('Par compte')}</h3><p class="sub">${t('Bénéfice net {l}',{l:lbl})}</p>${hbars(CP.map(c=>{const L=app.P.filter(x=>sold(x)&&(!from||(x.dv||'')>=from)&&(app.compteOf(x)||{}).id===c.id),S2=stats(L);return{k:c.n,v:S2.ben,sub:tn(S2.n,'vente','ventes')+' · '+eur(S2.ca)+(c.fiscal===false?' · '+t('hors déclaration'):'')}}),eurR)}</div>`:''}
 <div class="card"><h3>${t('Par catégorie')}</h3><p class="sub">${t('Bénéfice net {l}',{l:lbl})}</p>${hbars(ct.map(g=>({k:g.k,v:g.ben,sub:tn(g.n,'vente','ventes')})),eurR,true)}</div>
 <div class="card"><h3>${t('Meilleures marques')}</h3><p class="sub">${t('Bénéfice net {l}',{l:lbl})}</p>${hbars(br.map(g=>({k:g.k,v:g.ben,sub:tn(g.n,'vente','ventes')+' · '+t('{p} par pièce',{p:eurR(g.ben/g.n)})})),eurR,true)}</div>
 ${app.ballotsHTML()}${app.retoursHTML()}${sr.length?`<div class="card"><h3>${t('Provenance')}</h3><p class="sub">${t('Bénéfice net {l}, selon l\'endroit d\'achat',{l:lbl})}</p>${hbars(sr.map(g=>({k:g.k,v:g.ben,sub:tn(g.n,'vente','ventes')})),eurR)}</div>`:''}`;hydrate()}
$('per').onclick=e=>{if(e.target.closest('[data-badv]'))return openBilanFilters();const fc=e.target.closest('[data-fclr]');if(fc){const k=fc.dataset.fclr;if(k==='*'){BADV.forEach(x=>{badv[x]=''});app.cptFilt='';if(perCustom())app.period=30}else if(k==='cf')app.cptFilt='';else if(k==='per')app.period=30;else badv[k]='';bilSave();app.renderDash();return}const b=e.target.closest('[data-p]');if(b){app.period=+b.dataset.p;app.renderDash()}};
$('dsh').onclick=e=>{const c=e.target.closest('[data-cal]');if(c){const[y,m]=app.calM.split('-').map(Number),n=new Date(y,m-1+Number(c.dataset.cal),1);app.calM=n.getFullYear()+'-'+pad(n.getMonth()+1,2);app.calD='';app.renderDash();return}const dy=e.target.closest('[data-day]');if(dy){app.calD=app.calD===dy.dataset.day?'':dy.dataset.day;app.renderDash();return}if(e.target.closest('[data-ball]')){app.ballAll=!app.ballAll;app.renderDash();return}if(e.target.closest('[data-motifs]')){app.openMotifs();return}const tp=e.target.closest('[data-topub]');if(tp){app.filt='Apub';app.lim=60;go('list');return}const sc=e.target.closest('[data-sec]');if(sc){sc.closest('.card').classList.toggle('shut');app.saveSec();return}const al=e.target.closest('[data-allsec]');if(al){document.querySelectorAll('#dsh .card.cs').forEach(c=>c.classList.toggle('shut',al.dataset.allsec==='1'));app.saveSec();return}const b=e.target.closest('.li');if(b)app.openSheet(b.dataset.id)};
