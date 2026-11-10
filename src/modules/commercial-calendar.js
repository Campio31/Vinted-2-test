import { app } from '../state.js';
import { $, LSg, LSs, addDays, avail, days, esc, fd, ok, pad, today } from './core.js';
import { sheetHead, showSheet } from './tools-index.js';

app.calCardHTML = calCardHTML;
app.openCalcom = openCalcom;
app.commEventsAll = () => commEvents(true);

/* --- 4. calendrier commercial --- */
function easterOf(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return y+'-'+pad(mo,2)+'-'+pad(da,2)}
function nthDow(y,m,dow,n){if(n>0){const d=new Date(y,m-1,1),off=(dow-d.getDay()+7)%7;return y+'-'+pad(m,2)+'-'+pad(1+off+7*(n-1),2)}const l=new Date(y,m,0),off=(l.getDay()-dow+7)%7;return y+'-'+pad(m,2)+'-'+pad(l.getDate()-off,2)}
export function commEvents(all){const out=[],t=today(),Y=new Date().getFullYear();(all?[Y-1,Y,Y+1]:[Y,Y+1]).forEach(y=>{
 const bf=addDays(nthDow(y,11,4,4),1);
 [['Soldes d\'hiver',nthDow(y,1,3,2),21,'Prépare tes baisses de prix et tes lots sur les pièces qui stagnent.',['Pantalon','Veste','Sweat']],
  ['Saint-Valentin',y+'-02-14',14,'Mets en avant pulls, chemises et robes, et propose des lots à deux.',['Sweat','Chemise','RobeJupe']],
  ['Pâques',easterOf(y),14,'Tenues de printemps : polos, shorts et chemises légères.',['Polo','Short','Chemise']],
  ['Fête des mères',nthDow(y,5,0,-1),14,'Robes, jupes et pièces douces, avec une belle présentation.',['RobeJupe','Chemise']],
  ['Fête des pères',nthDow(y,6,0,3),14,'Polos, chemises et maillots, en lots cadeau.',['Polo','Chemise','Maillot']],
  ['Soldes d\'été',nthDow(y,6,3,-1),21,'Écoule les pièces d\'hiver et prépare les shorts et t-shirts.',['Short','Tshirt','Maillot']],
  ['Rentrée',y+'-09-01',28,'Pantalons, sweats et chemises : publie-les à l\'avance.',['Pantalon','Sweat','Chemise']],
  ['Halloween',y+'-10-31',14,'Sweats noirs et oranges, pièces originales.',['Sweat','Veste']],
  ['Singles\' Day',y+'-11-11',10,'Une promo courte sur tes lots.',[]],
  ['Black Friday',bf,21,'Prépare ta promo (par exemple -15 % dès 2 pièces) et tes lots à l\'avance.',['Sweat','Veste','Pantalon']],
  ['Cyber Monday',addDays(bf,3),7,'Relance les pièces qui n\'ont pas bougé pendant le Black Friday.',[]],
  ['Noël',y+'-12-25',28,'Sweats, vestes et pulls : mets-les en ligne dès début décembre.',['Sweat','Veste','Pantalon']]
 ].forEach(([name,date,lead,tip,cats])=>{if(all||date>=t)out.push({name,date,lead,tip,cats,start:addDays(date,-lead),key:name+' '+y})})});
 return out.sort((a,b)=>a.date.localeCompare(b.date))}
export function evInfo(ev){const t=today(),dd=days(t,ev.date),st=app.P.filter(avail),rel=ev.cats.length?st.filter(p=>ev.cats.includes(p.cat)):st,up=rel.filter(p=>!ok(p.pub)).length;return{dd,prep:t>=ev.start,rel:rel.length,up,startIn:days(t,ev.start)}}
function calCardHTML(){const ev=commEvents().find(e=>days(today(),e.date)<=90);if(!ev)return'';const i=evInfo(ev);
 return`<button type="button" class="card minic" data-tool="calcom"><span class="l">${t('prochain temps fort')}</span><b>${esc(t(ev.name))} <small>${t(i.dd>1?'dans {n} jours':'dans {n} jour',{n:i.dd})}</small></b><span class="mini-s">${i.prep?t('À préparer maintenant : promos et lots'):t('Préparation à partir du {d}',{d:fd(ev.start)})}</span></button>`}
function openCalcom(){const L=commEvents().slice(0,8);
 showSheet(sheetHead(t('Calendrier commercial'))+`<p class="sub">${t('Les moments où les acheteurs dépensent le plus. Prépare tes promos et tes lots avant.')}</p>${L.map(ev=>{const i=evInfo(ev),ck=LSg('calck:'+ev.key,[0,0,0]);
  return`<div class="card" style="padding:14px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-size:17px">${esc(t(ev.name))}</b><span class="tag${i.prep?' x':''}">${i.dd===0?t('aujourd\'hui'):t('dans {n} j',{n:i.dd})}</span></div><div class="hint" style="margin:2px 0 8px">${fd(ev.date)} · ${i.prep?t('à préparer maintenant'):t('préparation dès le {d}',{d:fd(ev.start)})}</div><p style="margin:0 0 8px;font-size:14px">${esc(t(ev.tip))}</p>
  <div class="hint" style="margin:0 0 8px">${t(i.rel>1?'{n} pièces concernées en stock':'{n} pièce concernée en stock',{n:i.rel})}${i.up?', '+t(i.up>1?'dont {n} pas encore publiées':'dont {n} pas encore publiée',{n:i.up}):''}.</div>
  ${['Fixer la promo','Préparer 3 lots','Publier les pièces concernées'].map((l,k)=>`<label class="qrr"><input type="checkbox" data-ck="${esc(ev.key)}" data-k="${k}"${ck[k]?' checked':''}><span>${t(l)}</span></label>`).join('')}</div>`}).join('')}`);
 $('shc').onchange=e=>{const c=e.target.closest('[data-ck]');if(!c)return;const k='calck:'+c.dataset.ck,a=LSg(k,[0,0,0]);a[+c.dataset.k]=c.checked?1:0;LSs(k,a)}}
