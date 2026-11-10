import { app } from '../state.js';
import { $, LSg, LSs, age, avail, days, esc, eur, isnum, ok, sold } from './core.js';

app.advice = advice;
app.renderAdvice = renderAdvice;

/* ---------- prix conseillé (calculé à partir de tes ventes) ---------- */
export const med=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const qtl=(a,q)=>{const s=[...a].sort((x,y)=>x-y);if(!s.length)return 0;const i=(s.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo)};
export const nice=v=>v<10?Math.round(v*2)/2:Math.round(v);
export const nrm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
app.nrm = nrm;
export const delai=p=>ok(p.dv)&&(ok(p.pub)||ok(p.entree))?Math.max(0,days(ok(p.pub)?p.pub:p.entree,p.dv)):null;
export const targetDays=()=>{const d=LSg('targetDays',14);return[7,14,30].includes(d)?d:14};
function comps(p){
 if(!p.cat)return{label:'',items:[]};
 const S=app.P.filter(x=>sold(x)&&x.id!==p.id&&isnum(x.pv)&&x.pv>0),mq=nrm(p.marque);
 const sm=x=>mq&&nrm(x.marque)===mq,sc=x=>x.cat===p.cat,st=x=>p.sub&&x.sub===p.sub;
 /* du plus précis au plus large. La marque seule vient en dernier : une marque vendue dans une autre catégorie dit peu sur celle-ci. */
 const lv=[['même marque, catégorie et type',x=>sm(x)&&sc(x)&&st(x),3],['même marque et catégorie',x=>sm(x)&&sc(x),3],['même catégorie et type (toutes marques)',x=>sc(x)&&st(x),4],['même catégorie (toutes marques)',sc,5],['même marque (toutes catégories)',sm,4]];
 for(let i=0;i<lv.length;i++){const[label,f,min]=lv[i];let g=S.filter(f);if(g.length>=min){const sg=p.grade?g.filter(x=>x.grade===p.grade):[];let l=t(label);if(sg.length>=3){g=sg;l+=t(', grade {g}',{g:p.grade})}return{label:l,short:t(label.replace(/^même /,'')),items:g,exact:i<2}}}
 return{label:'',items:[]}}
export function advice(p,td){td=td||targetDays();const c=comps(p),it=c.items;
 if(it.length<3){const f=isnum(p.achat)&&p.achat>0?nice(p.achat*2.5):0;return{ok:false,n:it.length,fallback:f,td}}
 const sorted=[...it].sort((a,b)=>a.pv-b.pv),n=sorted.length,a=Math.ceil(n/3),b=Math.ceil(2*n/3);
 const mk=(name,g)=>{const d=g.map(delai).filter(v=>v!==null);return{name,n:g.length,price:g.length?med(g.map(x=>x.pv)):0,delai:d.length?med(d):null}};
 const tiers=[mk('Vente rapide',sorted.slice(0,a)),mk('Équilibré',sorted.slice(a,b)),mk('Ambitieux',sorted.slice(b))].filter(t=>t.n>0);
 let idx=-1;tiers.forEach((t,i)=>{if(t.delai!==null&&t.delai<=td)idx=i});
 let note='';
 if(idx<0){const withD=tiers.map((t,i)=>[t,i]).filter(x=>x[0].delai!==null);idx=withD.length?withD.sort((x,y)=>x[0].delai-y[0].delai)[0][1]:Math.min(1,tiers.length-1);if(withD.length)note=t('Aucun palier ne se vend en {n} jours : on retient le plus rapide.',{n:td})}
 const ag=avail(p)?age(p):0;let reco=tiers[idx].price;
 const cut=ag>=105?0.2:ag>=75?0.15:ag>=45?0.1:0;
 if(cut){reco=reco*(1-cut);note=(note?note+' ':'')+t('En stock depuis {n} jours : prix baissé de {p} %.',{n:ag,p:Math.round(cut*100)})}
 reco=nice(reco);
 const ach=p.achat||0;if(reco<ach)note=(note?note+' ':'')+t('Ce prix est inférieur au prix d\'achat.');
 if(!c.exact&&p.marque)note=(note?note+' ':'')+t('Aucune vente de cette marque dans cette catégorie : estimation à partir de {l}.',{l:c.short});
 return{ok:true,n,label:c.label,exact:!!c.exact,tiers,reco,tier:tiers[idx].name,td,note,margin:reco-ach}}
function renderAdvice(p){const box=$('pc');if(!box)return;const a=advice(p);
 const chips=[7,14,30].map(d=>`<button type="button" class="chip sm${a.td===d?' on':''}" data-td="${d}">${t('{n} jours',{n:d})}</button>`).join('');
 let body;
 if(!a.ok)body=`<p class="sub" style="margin:0">${t('Pas assez de ventes comparables dans ta base ({n}, il en faut au moins 3).',{n:tn(a.n,'trouvée','trouvées')})}</p>${a.fallback?`<div class="pv">${t('Repère : {p} (2,5 × le prix d\'achat)',{p:eur(a.fallback)})}</div>`:''}`;
 else body=`<div class="pc-top"><div class="big">${eur(a.reco)}</div><span class="tag">${esc(t(a.tier))}</span></div>
  <div class="hint" style="margin-top:2px">${esc(t('{m} par rapport au prix d\'achat · basé sur {n} ventes ({l})',{m:(a.margin>=0?'+':'')+eur(a.margin),n:a.n,l:a.label}))}</div>
  <div class="pv">${app.rentaHTML(app.renta(p.achat||0,a.reco,app.defFrais(a.reco,'Vinted'),(a.tiers.find(x=>x.name===a.tier)||{}).delai))}</div>
  <div class="pc-t">${a.tiers.map(tr=>`<div class="pc-r${tr.name===a.tier?' on':''}"><span>${esc(t(tr.name))}</span><b>${eur(nice(tr.price))}</b><small>${tr.delai!==null?t('vendu en {n} j',{n:Math.round(tr.delai)}):t('délai inconnu')} · ${tn(tr.n,'vente','ventes')}</small></div>`).join('')}</div>
  ${a.note?`<div class="hint">${esc(a.note)}</div>`:''}`;
 box.innerHTML=`<h3>${t('Prix conseillé')}</h3><span class="l" style="margin-top:8px">${t('Je veux vendre en moins de')}</span><div class="chips" style="margin-bottom:12px">${chips}</div>${body}<div class="hint">${t('Estimation calculée à partir de tes ventes passées, à ajuster selon l\'état réel de la pièce.')}</div>`;
 box.onclick=e=>{const b=e.target.closest('[data-td]');if(b){LSs('targetDays',+b.dataset.td);renderAdvice(p)}}}
