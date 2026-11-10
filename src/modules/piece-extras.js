import { app } from '../state.js';
import { $, avail, esc, title } from './core.js';
import { go } from './nav.js';
import { closeSheet } from './piece-sheet.js';
import { buyerLine, openBuyer, pseudoKey, similarHTML } from './buyers.js';
import { openVariant } from './variants.js';
import { SEL } from './selection.js';

/* ---------- ajouts à la fiche d'une pièce ---------- */
function ficheExtra(p){const vin=app.vintageFor(p.marque),pals=p.lot?app.P.filter(x=>x.lot===p.lot&&x.id!==p.id):[];
 return`<div class="card fx"><h3 style="margin:0 0 8px">${t('Pièces similaires déjà vendues')}</h3>${similarHTML(p)}
  ${pals.length?`<div class="sim" style="margin-top:10px"><b>${t('Vendue dans un lot de {n} pièces',{n:p.lotn||pals.length+1})}</b><span>${pals.map(x=>esc(title(x))).join(' · ')}</span></div>`:''}
  ${p.acheteur?`<div class="sim" style="margin-top:10px"><b>@${esc(p.acheteur)}</b><span>${buyerLine(p.acheteur)||''}</span><button type="button" class="lnkb" data-fx="buy" style="padding:0">${t('Voir la fiche acheteur')}</button></div>`:''}
  <div class="acts${avail(p)?' two':''}" style="margin-top:12px"><button type="button" class="btn sec sm" data-fx="var">${t('Variante : autre taille ou couleur')}</button>${avail(p)?`<button type="button" class="btn sec sm" data-fx="lot">${t('Vendre avec d\'autres pièces')}</button>`:''}</div>
  ${vin?`<div class="acts" style="margin-top:8px"><button type="button" class="btn sec sm" data-fx="vin">${t('Repères vintage : {m}',{m:vin.n})}</button></div>`:''}</div>`}
function fxClick(p,a){if(a==='var')return openVariant(p.id);if(a==='buy')return openBuyer(pseudoKey(p.acheteur),()=>app.openSheet(p.id));if(a==='vin')return app.openVintage(app.vintageFor(p.marque).n,p.id);
 if(a==='lot'){SEL.clear();SEL.add(p.id);app.selMode=true;closeSheet();go('list');app.renderList();app.toast(t('Touche les autres pièces, puis Actions'),null,4500)}}
const openSheet24=app.openSheet;app.openSheet=function(id,m){openSheet24(id,m);if((m||'view')!=='view')return;const p=app.P.find(x=>x.id===id),shc=$('shc');if(!p||$('sheet').hidden||!shc)return;const a=shc.querySelector('.acts');if(!a)return;a.insertAdjacentHTML('beforebegin',ficheExtra(p));shc.querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>fxClick(p,b.dataset.fx))};
