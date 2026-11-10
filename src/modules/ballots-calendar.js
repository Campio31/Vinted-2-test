import { app } from '../state.js';
import { $, addDays, avail, esc, eur, eurR, fd, isnum, ok, pad, sold, title, today } from './core.js';
import { hbars } from './dashboard.js';
import { sheetHead, showSheet } from './tools-index.js';
import { MOIS, WDAYS } from './gamification.js';

app.ballotsHTML = ballotsHTML;
app.calHTML = calHTML;
app.retoursHTML = retoursHTML;
app.openMotifs = openMotifs;

/* ===== v17 : ballots, calendrier des ventes, retours, recherche, photos ===== */
/* --- analyse par ballot : barre avec deux objectifs (prix du ballot, puis le double) --- */
app.ballAll = false;
export function ballotsData(){const g={};app.P.forEach(p=>{if(p.ballot)(g[p.ballot]=g[p.ballot]||[]).push(p)});
 return Object.entries(g).map(([name,l])=>{const cost=l.reduce((a,x)=>a+(x.achat||0),0),S=l.filter(sold),rec=S.reduce((a,x)=>a+(x.pv||0)-(x.frais||0),0),start=l.map(x=>x.entree).filter(ok).sort()[0]||'';
  return{name,n:l.length,sold:S.length,left:l.filter(avail).length,cost,rec,start}}).filter(b=>b.cost>0).sort((a,b)=>b.start.localeCompare(a.start))}
function ballotBar(b){const g2=b.cost*2,sc=Math.max(g2,b.rec)*1.04,lv=b.rec>=g2?'g':b.rec>=b.cost?'o':'r';
 return`<div class="b2t"><i class="b2f bl-${lv}" style="width:${Math.min(100,b.rec/sc*100).toFixed(1)}%"></i><u style="left:${(b.cost/sc*100).toFixed(1)}%"></u><u style="left:${(g2/sc*100).toFixed(1)}%"></u></div>`}
function ballotsHTML(){const L=ballotsData();if(!L.length)return'';const show=app.ballAll?L:L.slice(0,6);
 return`<div class="card"><h3>${t('Analyse par ballot')}</h3><p class="sub">${t('Encaissé (frais déduits) face au prix du ballot. Rouge sous le prix, jaune entre le prix et le double, vert au-delà du double.')}</p>
 ${show.map(b=>{const lv=b.rec>=b.cost*2?'g':b.rec>=b.cost?'o':'r',pct=Math.round(b.rec/b.cost*100);
  return`<div class="b2"><div class="b2h"><b>${esc(b.name)}</b><span class="bp bl-${lv}">${pct} %</span></div>${ballotBar(b)}<div class="b2l"><span>${t('{c} encaissés',{c:eurR(b.rec)})}</span><span>1 : ${eurR(b.cost)} · 2 : ${eurR(b.cost*2)}</span></div><div class="b2s">${t(b.sold>1?'{a} vendues sur {b}':'{a} vendue sur {b}',{a:b.sold,b:b.n})}${b.left?' · '+t('{n} en stock',{n:b.left}):''}${b.rec>=b.cost?'':' · '+t('reste {r} pour couvrir le prix',{r:eurR(b.cost-b.rec)})}</div></div>`}).join('')}
 ${L.length>6?`<button type="button" class="btn sec sm" data-ball="1" style="margin-top:6px">${app.ballAll?t('Réduire'):t('Voir les {n} ballots',{n:L.length})}</button>`:''}</div>`}

/* --- ventes du mois en calendrier --- */
app.calM = '';
app.calD = '';
function calHTML(){const cur=today().slice(0,7);if(!app.calM)app.calM=cur;const lim6=(()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+6);return d.getFullYear()+'-'+pad(d.getMonth()+1,2)})();const[y,m]=app.calM.split('-').map(Number),nd=new Date(y,m,0).getDate(),first=(new Date(y,m-1,1).getDay()+6)%7;
 const S=app.P.filter(p=>sold(p)&&ok(p.dv)&&p.dv.startsWith(app.calM)),byD={},byC={};
 S.forEach(p=>{(byD[p.dv]=byD[p.dv]||[]).push(p);const c=p.canal||'Autre',o=byC[c]=byC[c]||{n:0,ca:0};o.n++;o.ca+=p.pv||0});
 const sum=l=>l.reduce((a,x)=>a+(x.pv||0),0),tot=sum(S),mx=Math.max(1,...Object.values(byD).map(sum));
 const EV=app.commEventsAll?app.commEventsAll():[],evBy={},pre=new Set();EV.forEach(e=>{(evBy[e.date]=evBy[e.date]||[]).push(e);for(let k=e.start;k<e.date;k=addDays(k,1))pre.add(k)});
 let cells='';for(let i=0;i<first;i++)cells+='<i class="cd0"></i>';
 for(let d=1;d<=nd;d++){const k=app.calM+'-'+pad(d,2),l=byD[k],ca=l?sum(l):0;
  cells+=`<button type="button" class="cdc${l?' has':''}${evBy[k]?' ev':''}${pre.has(k)&&!evBy[k]?' pre':''}${app.planHas&&app.planHas(k)?' pl':''}${k===app.calD?' sel':''}${k===today()?' tod':''}" data-day="${k}"${l?` style="--h:${Math.round(18+ca/mx*60)}%"`:''}><span>${d}</span>${evBy[k]?'<em class="cde">★</em>':''}${l?`<b>${Math.round(ca)}</b><small>${l.length}</small>`:''}</button>`}
 let det='';if(app.calD&&app.calD.startsWith(app.calM)){const l=byDay(app.calD,byD),bc={};l.forEach(p=>{const c=p.canal||'Autre',o=bc[c]=bc[c]||{n:0,ca:0};o.n++;o.ca+=p.pv||0});
  det=`<div class="cdet"><span class="l">${fd(app.calD)}</span>${l.length?Object.entries(bc).sort((a,b)=>b[1].ca-a[1].ca).map(([c,o])=>`<div class="cdr"><span>${esc(tv(c))}</span><em>${tn(o.n,'vente','ventes')}</em><b>${eur(o.ca)}</b></div>`).join('')+`<div class="cdr tot"><span>${t('Total du jour')}</span><em></em><b>${eur(sum(l))}</b></div>`+l.map(p=>`<button type="button" class="li" data-id="${esc(p.id)}" style="margin:6px 0 0"><div class="m"><b>${esc(title(p))}</b><small>${esc(tv(p.canal||'Autre'))}${p.acheteur?' · @'+esc(p.acheteur):''}</small></div><div class="p">${eur(p.pv)}</div></button>`).join(''):'<div class="hint">'+t('Aucune vente ce jour-là.')+'</div>'}${dayExtras(app.calD,EV)}</div>`}
 return`<div class="card"><div class="calh"><button type="button" class="ib" data-cal="-1" aria-label="${t('Mois précédent')}">‹</button><div><h3 style="margin:0">${t('Ventes · {m} {y}',{m:MOIS[m-1],y})}</h3><p class="sub" style="margin:0">${tn(S.length,'vente','ventes')} · ${eur(tot)}</p></div><button type="button" class="ib" data-cal="1" aria-label="${t('Mois suivant')}"${app.calM>=lim6?' disabled':''}>›</button></div>
 <div class="calg">${WDAYS().map(x=>'<b>'+esc(x)+'</b>').join('')}${cells}</div><div class="hint cdl">★ ${t('temps fort')} · ${t('trait : préparation')} · ● ${t('planning')}</div>
 ${Object.keys(byC).length?`<div class="cch">${Object.entries(byC).sort((a,b)=>b[1].ca-a[1].ca).map(([c,o])=>`<span class="chip sm">${esc(tv(c))} · ${o.n} · ${eurR(o.ca)}</span>`).join('')}</div>`:'<div class="hint">'+t('Aucune vente ce mois-ci.')+'</div>'}${det}</div>`}
const byDay=(d,byD)=>byD[d]||[];
/* temps forts commerciaux et planning du jour sélectionné (ex-outils Calendrier commercial et Planning) */
function dayExtras(d,EV){let h='';
 EV.filter(e=>e.date===d).forEach(e=>{h+=`<div class="cdx"><b>★ ${esc(t(e.name))}</b><p>${esc(t(e.tip))}</p><button type="button" class="btn sm sec" data-tool="calcom">${t('Préparer')}</button></div>`});
 EV.filter(e=>d>=e.start&&d<e.date).forEach(e=>{h+=`<div class="cdx"><b>${t('Préparation : {n}',{n:t(e.name)})}</b><p class="hint" style="margin:0 0 8px">${t('Temps fort le {d}',{d:fd(e.date)})}</p><button type="button" class="btn sm sec" data-tool="calcom">${t('Préparer')}</button></div>`});
 h+=`<div class="cdx"><b>${t('Planning')}</b>${app.planDayHTML?app.planDayHTML(d):''}<button type="button" class="btn sm sec" data-tool="planning" style="margin-top:6px">${t('Modifier le planning')}</button></div>`;return h}

/* --- retours : motifs, marques et catégories --- */
const MOTIFS=['Taille','Défaut non signalé','Changement d\'avis','Autre'];
app.MOTIFS = MOTIFS;
function retoursHTML(){const R=[];app.P.forEach(p=>(p.retours||[]).forEach(r=>R.push({p,r})));if(!R.length)return'';
 const mo={};R.forEach(({r})=>{const k=r.m||'Non précisé';mo[k]=(mo[k]||0)+1});
 const base=(f)=>{const b={};app.P.forEach(p=>{const k=p[f];if(k&&(sold(p)||(p.retours||[]).length))b[k]=(b[k]||0)+1});return b};
 const by=(f)=>{const b=base(f),c={};R.forEach(({p})=>{const k=p[f];if(k)c[k]=(c[k]||0)+1});return Object.entries(c).map(([k,n])=>({k,v:n,sub:t('{a} sur {b}',{a:tn(n,'retour','retours'),b:tn(b[k],'vente','ventes')})+' · '+Math.round(n/b[k]*100)+' %'})).sort((a,b)=>b.v-a.v).slice(0,5)};
 const tot=R.reduce((a,x)=>a+(x.r.p||0),0),nv=app.P.filter(p=>sold(p)||(p.retours||[]).length).length,np=R.filter(x=>!x.r.m).length;
 return`<div class="card"><h3>${t('Analyse des retours')}</h3><p class="sub">${tn(R.length,'retour','retours')} ${t('depuis le début')} · ${t('{a} remboursés',{a:eurR(tot)})} · ${t('{p} % des ventes',{p:nv?Math.round(R.length/nv*100):0})}</p>
 <span class="l">${t('Motifs')}</span>${hbars(Object.entries(mo).sort((a,b)=>b[1]-a[1]).map(([k,n])=>({k,v:n,sub:Math.round(n/R.length*100)+' %'})),v=>String(v))}
 ${np?`<button type="button" class="btn sec sm" data-motifs="1" style="margin-top:8px">${t('Renseigner les motifs manquants ({n})',{n:np})}</button>`:''}
 <span class="l" style="margin-top:14px">${t('Marques qui reviennent le plus')}</span>${hbars(by('marque'),v=>String(v))}
 <span class="l" style="margin-top:14px">${t('Catégories qui reviennent le plus')}</span>${hbars(by('cat'),v=>String(v))}</div>`}

function openMotifs(){const R=[];app.P.forEach(p=>(p.retours||[]).forEach((r,i)=>{if(!r.m)R.push({p,i,r})}));
 if(!R.length){showSheet(sheetHead(t('Motifs de retour'))+'<div class="empty">'+t('Tous les retours ont un motif.')+'</div>');return}
 showSheet(sheetHead(t('Motifs de retour'))+`<p class="sub">${t('Choisis le motif de chaque retour.')} ${t(R.length>1?'{n} restants.':'{n} restant.',{n:R.length})}</p>${R.slice(0,30).map(({p,i,r})=>`<div class="card" style="padding:12px 14px"><b>${esc(title(p))}</b><div class="hint" style="margin:2px 0 8px">${fd(r.d)}${isnum(r.p)?' · '+eur(r.p):''}</div><div class="chips">${MOTIFS.map(x=>`<button type="button" class="chip sm" data-mp="${esc(p.id)}" data-mi="${i}" data-v="${esc(x)}">${esc(tv(x))}</button>`).join('')}</div></div>`).join('')}`);
 $('shc').onclick=e=>{const b=e.target.closest('[data-mp]');if(!b)return;const p=app.P.find(x=>x.id===b.dataset.mp);if(!p)return;const rs=(p.retours||[]).map((r,i)=>i===+b.dataset.mi?Object.assign({},r,{m:b.dataset.v}):r);app.save(Object.assign({},p,{retours:rs}));openMotifs()}}
