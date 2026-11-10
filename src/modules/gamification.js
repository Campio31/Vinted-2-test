import { app } from '../state.js';
import { LSg, LSs, addDays, days, esc, eur, eurR, ok, sold, today } from './core.js';
import { goalCalc, goalKinds } from './goals.js';
import { sheetHead, showSheet } from './tools-index.js';

app.scheduleBadges = scheduleBadges;
app.openTrophees = openTrophees;

/* ---------- rendu et démarrage ---------- */
/* ---------- gamification, ligne fiscale, nettoyage des valeurs, fiches à compléter, contrôles, raccourcis ---------- */
export const MOIS=new Proxy([],{get:(a,i)=>/^\d+$/.test(i)?new Date(2000,+i,15).toLocaleDateString(app.LOC,{month:'long'}):a[i]});
export const WDAYS=()=>[1,2,3,4,5,6,0].map(d=>new Date(2024,0,7+d).toLocaleDateString(app.LOC,{weekday:'narrow'}));
export const FLAME='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c3 2 5 4 5 7a7 7 0 0 1-14 0c0-4 3-5 3-8 1 1 2 1 4-6z"/></svg>';

/* ===== 1. Gamification ===== */
function pubDays(){const s=new Set();app.P.forEach(p=>{if(ok(p.pub))s.add(p.pub)});return s}
/* Série de publication, avec un jour de repos par semaine (du lundi au dimanche) : un seul jour sans publier dans la même semaine ne casse pas la série.
   Deux jours sans publier d'affilée, ou un deuxième jour de repos dans la semaine, la cassent. Les jours de repos ne comptent pas dans le nombre de jours. */
const monday=d=>addDays(d,-((new Date(d+'T12:00:00').getDay()+6)%7));
function streakRuns(s){let n=0,rests=new Set(),prev=null,best=0;
 [...s].sort().forEach(d=>{if(prev===null)n=1;else{const g=days(prev,d)-1;let live=g===0;if(g===1){const w=monday(addDays(prev,1));if(!rests.has(w)){rests.add(w);live=true}}if(live)n++;else{n=1;rests=new Set()}}best=Math.max(best,n);prev=d});
 return{n,best,rests,last:prev}}
export function streakInfo(){const s=pubDays(),r=streakRuns(s),t0=today();let n=0,pending=false;
 if(r.last){const miss=r.last===t0?0:days(r.last,t0)-1;
  if(miss===0)n=r.n;else if(miss===1&&!r.rests.has(monday(addDays(r.last,1)))){n=r.n;pending=true}}
 const wk=monday(t0),used=n>0&&(r.rests.has(wk)||(pending&&monday(addDays(r.last,1))===wk));
 return{n,best:r.best,today:s.has(t0),pending,restLeft:n>0&&!used}}
function monthCA(){const o={};app.P.forEach(p=>{if(sold(p)&&ok(p.dv)){const m=p.dv.slice(0,7);o[m]=(o[m]||0)+(p.pv||0)}});return o}
function ballotStats(){const g={};app.P.forEach(p=>{if(p.ballot)(g[p.ballot]=g[p.ballot]||[]).push(p)});const out=[];
 Object.entries(g).forEach(([name,l])=>{const cost=l.reduce((a,x)=>a+(x.achat||0),0),start=l.map(x=>x.entree).filter(ok).sort()[0];if(cost<=0||!start)return;
  const ev=l.filter(x=>sold(x)&&ok(x.dv)).map(x=>[x.dv,(x.pv||0)-(x.frais||0)]).sort((a,b)=>a[0].localeCompare(b[0]));let c=0,dd=null;for(const e of ev){c+=e[1];if(c>=cost){dd=days(start,e[0]);break}}
  out.push({name,cost,n:l.length,sold:ev.length,days:dd})});return out}
export function badgeList(){const B=[],S=app.P.filter(sold),n=S.length,ca=S.reduce((a,x)=>a+(x.pv||0),0),st=streakInfo(),mc=monthCA(),cur=today().slice(0,7),prevBest=Math.max(0,...Object.entries(mc).filter(([m])=>m!==cur).map(e=>e[1])),bs=ballotStats();
 [10,25,50,100,250,500,1000].forEach(k=>B.push({id:'v'+k,g:'Ventes',t:t('{k} ventes',{k}),d:t('Vends {k} pièces',{k}),ok:n>=k,prog:Math.min(k,n)+' / '+k}));
 [1000,5000,10000,25000].forEach(k=>B.push({id:'ca'+k,g:'Chiffre d\'affaires',t:t('{k} encaissés',{k:eurR(k)}),d:t('Cumule {k} de ventes',{k:eurR(k)}),ok:ca>=k,prog:eurR(Math.min(k,ca))+' / '+eurR(k)}));
 [3,7,14,30,60].forEach(k=>B.push({id:'s'+k,g:'Série',t:t('Série de {k} jours',{k}),d:t('Publie {k} jours de suite, avec un jour de repos par semaine permis',{k}),ok:st.best>=k,prog:Math.min(k,st.best)+' / '+t('{k} jours',{k})}));
 [7,14,30].forEach(k=>{const b=bs.filter(x=>x.days!==null&&x.days<=k).sort((a,b)=>a.days-b.days)[0];B.push({id:'b'+k,g:'Ballots',t:t('Ballot rentabilisé en {k} jours',{k}),d:b?t('{a} : couvert en {b} j',{a:b.name,b:b.days}):t('Rentabilise un ballot en {k} jours ou moins',{k}),ok:!!b,prog:bs.length?tn(bs.length,'ballot suivi','ballots suivis'):t('Renseigne le champ ballot')})});
 B.push({id:'rec',g:'Records',t:t('Record de CA mensuel'),d:mc[cur]>0&&prevBest>0?(mc[cur]>=prevBest?t('Ce mois : {a}, ton meilleur',{a:eurR(mc[cur])}):t('Record : {a}, ce mois {b}',{a:eurR(prevBest),b:eurR(mc[cur]||0)})):t('Bats ton meilleur mois'),ok:mc[cur]>0&&prevBest>0&&mc[cur]>=prevBest,prog:prevBest?eurR(mc[cur]||0)+' / '+eurR(prevBest):t('aucun mois de référence')});
 const gk=goalKinds().find(k=>goalCalc(k,'m')),g=gk&&goalCalc(gk,'m');B.push({id:'obj',g:'Objectif',t:t('Objectif du mois atteint'),d:t('Atteins ton objectif mensuel'),ok:!!g&&g.cur>=g.g,prog:g?Math.round(g.pct*100)+' %':t('objectif non défini')});
 return B}
function checkBadges(){if(app.importing||!app.loaded||!app.P.length)return;const ids=badgeList().filter(b=>b.ok).map(b=>b.id),seen=LSg('badgeSeen',null);if(seen===null){LSs('badgeSeen',ids);return}
 const nw=ids.filter(i=>!seen.includes(i));if(nw.length){LSs('badgeSeen',[...new Set([...seen,...ids])]);const b=badgeList().find(x=>x.id===nw[0]);app.toast(nw.length>2?t('{n} badges débloqués : ouvre les trophées',{n:nw.length}):t('Badge débloqué : {b}',{b:b.t})+(nw.length>1?' (+1)':''),null,5000)}}
let badgeT=null;export function scheduleBadges(){clearTimeout(badgeT)}/* les badges sont remplacés par les trophées à paliers (trophees.js) */
function openTrophees(){const st=streakInfo(),mc=monthCA(),ms=Object.entries(mc).sort((a,b)=>b[1]-a[1])[0],B=badgeList(),done=B.filter(b=>b.ok).length;
 showSheet(sheetHead(t('Trophées'))+`<div class="gcard" style="margin-bottom:10px"><div class="gh2"><span>${t('Série de publication')}</span><span>${t('record {n} j',{n:st.best})}</span></div><div class="gbig cd" style="display:flex;align-items:center;gap:12px"><span class="flm${st.n?' on':''}">${FLAME}</span>${st.n}<small> ${t(st.n>1?'jours':'jour')}</small></div><div class="gl2">${t(st.today?'Tu as déjà publié aujourd\'hui.':st.n?'Publie aujourd\'hui pour garder ta série.':'Publie une pièce aujourd\'hui pour lancer une série.')} ${t('La date de publication se renseigne dans la fiche, ou en glissant une carte vers la gauche.')}</div></div>
  ${ms?`<div class="card" style="padding:12px 14px"><span class="l">${t('Record de CA mensuel')}</span><b class="cd" style="font-size:30px">${eur(ms[1])}</b> <span class="sub">${MOIS[+ms[0].slice(5)-1]} ${ms[0].slice(0,4)}</span></div>`:''}
  <p class="sub">${t('{a} sur {b}',{a:tn(done,'badge','badges'),b:B.length})}</p><div class="badges">${B.map(b=>`<div class="bdg${b.ok?' ok':''}"><i>${b.ok?'<svg viewBox="0 0 24 24"><path d="m5 12 4.500 4.500L19 7"/></svg>':'<svg viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></svg>'}</i><b>${esc(b.t)}</b><span>${esc(b.ok?b.d:b.prog)}</span></div>`).join('')}</div>`)}
