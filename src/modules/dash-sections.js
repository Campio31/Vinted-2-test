import { app } from '../state.js';
import { LSg, LSs, eurR, ok, sold } from './core.js';
import { hbars, stats } from './dashboard.js';

app.saveSec = saveSec;
app.depCardHTML = depCardHTML;

/* --- bilan en sections repliables --- */
const CLOSED0=['Par catégorie','Meilleures marques','Provenance','Six derniers mois','Par plateforme','Analyse des retours','Analyse par ballot'];
function collapsify(){const sv=LSg('dsec',null),shut=sv===null?CLOSED0.slice():sv;
 document.querySelectorAll('#dsh>.card').forEach(c=>{const h=c.querySelector('h3');if(!h||c.matches('.coachc,.minic,.goal'))return;const key=I18N.unt(h.textContent.split('·')[0].replace(/\d+/g,'').trim());
  const hd=h.closest('.calh')||h;c.classList.add('cs');hd.classList.add('hd');h.dataset.sec=key;if(shut.includes(key))c.classList.add('shut')});
 const f=document.querySelector('#dsh>.card.cs');if(f&&!document.querySelector('#dsh [data-allsec]'))f.insertAdjacentHTML('beforebegin','<div class="dsa"><button type="button" class="chip sm" data-allsec="1">'+t('Tout replier')+'</button><button type="button" class="chip sm" data-allsec="0">'+t('Tout déplier')+'</button></div>')}
app.collapsify = collapsify;
function saveSec(){LSs('dsec',[...document.querySelectorAll('#dsh .card.cs.shut h3[data-sec]')].map(h=>h.dataset.sec))}
const renderDash0=app.renderDash;app.renderDash=function(){renderDash0();collapsify()};
function depCardHTML(from,lbl){if(!app.DEP.length)return`<div class="card"><h3>${t('Dépenses')}</h3><p class="sub">${t('Carburant, matériel photo, cintres, abonnements : note-les pour connaître ton vrai résultat.')}</p><button type="button" class="btn sm mint" data-tool="depenses">${t('Ajouter une dépense')}</button></div>`;
 const L=app.DEP.filter(d=>ok(d.date)&&(!from||d.date>=from)),tot=L.reduce((a,d)=>a+(d.montant||0),0),ben=stats(app.P.filter(x=>sold(x)&&(!from||(x.dv||'')>=from))).ben,bc={};L.forEach(d=>{const k=d.cat||'Autre';bc[k]=(bc[k]||0)+(d.montant||0)});
 return`<div class="card"><h3>${t('Dépenses et résultat')}</h3><p class="sub">${lbl}</p><div class="kpis"><div class="kpi"><b>${eurR(ben)}</b><span>${t('bénéfice sur les pièces')}</span></div><div class="kpi"><b>−${eurR(tot)}</b><span>${t('dépenses')}</span></div><div class="kpi${ben-tot>=0?'':' neg'}"><b>${eurR(ben-tot)}</b><span>${t('résultat réel')}</span></div></div>${hbars(Object.entries(bc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,v})),eurR)}<button type="button" class="btn sm sec" data-tool="depenses" style="margin-top:8px">${t('Voir les dépenses')}</button></div>`}
