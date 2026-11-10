import { app } from '../state.js';
import { $, LSg, LSs, age, avail, days, esc, eur, isnum, num, ok, profit, title, today } from './core.js';
import { phImg } from './photos.js';
import { catSvg } from './stock-view.js';
import { advice, nrm } from './advice.js';
import { defFrais, fN } from './settings-core.js';
import { renta, rentaHTML } from './profitability.js';

app.sellClick = sellClick;

/* ---------- vente depuis une carte (stock, vente rapide) ---------- */
app.qSel = null;
let qF = {};
export const CANAUX_V=['Vinted','TikTok Live','Autre'];
export function cand(qraw){const q=nrm(qraw);let L=app.P.filter(avail);
 if(q){const sc=p=>{const c=nrm(p.code);if(c===q)return 0;if(c.startsWith(q))return 1;if(c.includes(q))return 2;if(nrm(p.marque).startsWith(q))return 3;return[p.marque,p.cat,p.sub,p.taille,p.id,p.modele,p.ballot,p.bac].some(x=>x&&nrm(x).includes(q))?4:9};
  L=L.map(p=>[sc(p),p]).filter(x=>x[0]<9).sort((a,b)=>a[0]-b[0]||(b[1].entree||'').localeCompare(a[1].entree||'')).map(x=>x[1])}
 else L=[...L].sort((a,b)=>(b.entree||'').localeCompare(a.entree||'')||(b.cree||0)-(a.cree||0));
 return L}
export const ageDelai=p=>ok(p.pub)||ok(p.entree)?Math.max(0,days(ok(p.pub)?p.pub:p.entree,today())):null;
app.ageDelai = ageDelai;
export const priceFor=p=>{const adv=advice(p);return isnum(p.pvise)&&p.pvise>0?p.pvise:adv.ok?adv.reco:(adv.fallback||0)};
app.priceFor = priceFor;
function sellCalc(p){const x=num(qF.prix),f=num(qF.frais)||0;if(isNaN(x))return'<div class="pv">'+t('Bénéfice net : —')+'</div>';return`<div class="pv">${rentaHTML(renta(p.achat||0,x,f,ageDelai(p),true))}</div>`}
export function sellForm(p){return`<div class="qform"><div class="row2"><div><label class="l" for="qp">${t('Prix final')}</label><div class="price"><input type="text" inputmode="decimal" id="qp" value="${esc(qF.prix)}" placeholder="0${app.DS}00"><span>€</span></div></div><div><label class="l" for="qf">${t('Frais')}</label><div class="price"><input type="text" inputmode="decimal" id="qf" value="${esc(qF.frais)}"><span>€</span></div></div></div>
 <div class="hint">${t('Frais préremplis d\'après tes réglages (emballage, envoi, commission).')}</div>
 <div class="chips" style="margin-top:12px">${CANAUX_V.map(x=>`<button type="button" class="chip sm${qF.canal===x?' on':''}" data-qcn="${x}">${tv(x)}</button>`).join('')}</div>
 ${1?`<div style="margin-top:12px"><label class="l" for="qb">${t('@pseudo de l\'acheteur (facultatif)')}</label><input type="text" id="qb" value="${esc(qF.pseudo)}" placeholder="@${t('pseudo')}" autocapitalize="none" autocomplete="off"></div>`:''}
 <div id="qpv">${sellCalc(p)}</div><div class="acts"><button type="button" class="btn mint" id="qok">${t('Confirmer la vente')}</button></div></div>`}

export function sellOpen(id){const p=app.P.find(x=>x.id===id);if(!p)return;const canal=LSg('lastCanal','Vinted'),pr=priceFor(p);app.qSel=id;qF={prix:pr?fN(pr):'',canal,frais:'',ft:false,pseudo:''};qF.frais=fN(defFrais(pr||0,canal))}
function sellRead(){const a=$('qp');if(a){qF.prix=a.value;qF.frais=$('qf').value;const b=$('qb');if(b)qF.pseudo=b.value}}
function sellClick(e,rerender){
 const v=e.target.closest('[data-qv]');if(v){sellOpen(v.dataset.qv);rerender();const i=$('qp');if(i){i.focus();i.select()}return true}
 if(e.target.closest('[data-qx]')){app.qSel=null;rerender();return true}
 const c=e.target.closest('[data-qcn]');if(c){sellRead();qF.canal=c.dataset.qcn;if(!qF.ft){const x=num(qF.prix);qF.frais=fN(defFrais(isNaN(x)?0:x,qF.canal))}rerender();return true}
 if(e.target.closest('#qok')){sellConfirm(rerender);return true}
 return false}
function sellInput(e){const t=e.target;if(t.id!=='qp'&&t.id!=='qf'&&t.id!=='qb')return;sellRead();
 if(t.id==='qf')qF.ft=true;
 if(t.id==='qp'&&!qF.ft){const x=num(qF.prix);qF.frais=fN(defFrais(isNaN(x)?0:x,qF.canal));$('qf').value=qF.frais}
 const p=app.P.find(x=>x.id===app.qSel);if(p&&$('qpv'))$('qpv').innerHTML=sellCalc(p)}
function sellConfirm(rerender){const p=app.P.find(x=>x.id===app.qSel);if(!p)return;sellRead();const x=num(qF.prix);
 if(isNaN(x)||x<0){$('qp').closest('.price').style.outline='2px solid var(--red)';app.toast(t('Indique le prix final'));return}
 const fr=num(qF.frais)||0,canal=qF.canal||'Vinted';if(!app.guardSale(p,x,fr,today()))return;LSs('lastCanal',canal);
 const q=Object.assign({},p,{statut:'Vendu',pv:x,canal,dv:today(),frais:fr,vt:Date.now()}),ps=(qF.pseudo||'').trim().replace(/^@+/,'');if(ps)q.acheteur=ps;
 app.save(q);app.qSel=null;rerender();app.toast(t('Vendu · bénéfice {b}',{b:eur(profit(q))})+(p.bac?t(' · bac {b}',{b:p.bac}):''),()=>{app.save(p);rerender()})}
$('lst').addEventListener('input',sellInput);
$('lst').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target.id==='qp'||e.target.id==='qf'||e.target.id==='qb')){e.preventDefault();sellConfirm(app.renderList)}});
