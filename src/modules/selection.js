import { app } from '../state.js';
import { $, avail, esc, eur, lc, num, title, today } from './core.js';
import { closeSheet } from './piece-sheet.js';
import { nice } from './advice.js';
import { copyText } from './listing.js';
import { priceFor } from './sell-card.js';
import { TI, sheetHead, showSheet } from './tools-index.js';
import { printLabels } from './qr.js';
import { searchScore, searchToks } from './search.js';
import { matchFilt, unpub } from './publication.js';
import { bulkMod, bulkUndo, buzz } from './buyers.js';
import { openGroupSale } from './group-sale.js';

app.selSet = selSet;

/* ---------- sélection multiple et actions groupées ---------- */
app.selMode = false;export const SEL=new Set();
document.body.insertAdjacentHTML('beforeend',`<div id="selbar" hidden><span id="sel_n"></span><button type="button" data-sa="all">${t('Tout')}</button><button type="button" class="pri" data-sa="act">${t('Actions')}</button><button type="button" data-sa="x" aria-label="${t('Fermer')}">✕</button></div>`);
function curList(){const q=$('q').value.trim().toLowerCase(),toks=searchToks(q);return app.P.filter(p=>{if(!matchFilt(p))return false;if(!toks.length)return true;return searchScore(p,toks)>=0})}
function selCards(){document.querySelectorAll('#lst .tl,#lst .qrow,#lst .li').forEach(c=>{const d=c.matches('[data-id]')?c:c.querySelector('[data-id]');c.classList.toggle('selc',!!(d&&app.selMode&&SEL.has(d.dataset.id)))})}
function selBar(){const b=$('selbar');b.hidden=!app.selMode;document.body.classList.toggle('selmode',app.selMode);if(app.selMode)$('sel_n').textContent=SEL.size?tn(SEL.size,'sélectionnée','sélectionnées'):t('Touche des pièces')}
export function selSet(on){app.selMode=on;if(!on)SEL.clear();if(app.view==='list')app.renderList();else selBar()}
const renderList24=app.renderList;app.renderList=function(){renderList24();const f=$('flt'),vt=f&&(f.querySelector('.fbtn')||f.querySelector('.vt')),h=`<button type="button" class="chip sm${app.selMode?' on':''}" data-selmode="1">${t('Sélection')}</button>`;if(vt)vt.insertAdjacentHTML('beforebegin',h);else if(f)f.insertAdjacentHTML('beforeend',h);$('lst').classList.toggle('selmode',app.selMode);selCards();selBar()};
document.addEventListener('click',e=>{if(e.target.closest('[data-selmode]'))selSet(!app.selMode)});
(function(){const box=$('lst');let tm=null,sx=0,sy=0;
 box.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||app.selMode||e.target.closest('input,select,textarea,.qform'))return;const c=e.target.closest('.tl,.qrow,.li');if(!c||c.classList.contains('open'))return;const d=c.matches('[data-id]')?c:c.querySelector('[data-id]');if(!d)return;sx=e.clientX;sy=e.clientY;tm=setTimeout(()=>{tm=null;window._lp=Date.now();app.selMode=true;SEL.add(d.dataset.id);buzz(25);app.renderList()},520)});
 const stop=()=>{if(tm){clearTimeout(tm);tm=null}};box.addEventListener('pointerup',stop);box.addEventListener('pointercancel',stop);box.addEventListener('pointermove',e=>{if(tm&&(Math.abs(e.clientX-sx)>9||Math.abs(e.clientY-sy)>9))stop()});
 box.addEventListener('contextmenu',e=>{if(e.target.closest('.tl,.qrow,.li')&&matchMedia('(pointer:coarse)').matches)e.preventDefault()});
 box.addEventListener('click',e=>{if(window._lp&&Date.now()-window._lp<700){e.stopImmediatePropagation();e.preventDefault();window._lp=0}},true);
 box.addEventListener('click',e=>{if(!app.selMode)return;const c=e.target.closest('.tl,.qrow,.li');if(!c)return;const d=c.matches('[data-id]')?c:c.querySelector('[data-id]');if(!d)return;e.preventDefault();e.stopImmediatePropagation();const id=d.dataset.id;if(SEL.has(id))SEL.delete(id);else SEL.add(id);buzz(8);c.classList.toggle('selc',SEL.has(id));selBar()},true)})();
$('selbar').onclick=e=>{const b=e.target.closest('[data-sa]');if(!b)return;const a=b.dataset.sa;if(a==='x')return selSet(false);
 if(a==='all'){const L=curList();if(SEL.size>=L.length)SEL.clear();else L.forEach(p=>SEL.add(p.id));selCards();selBar();if(SEL.size)app.toast(tn(SEL.size,'pièce sélectionnée','pièces sélectionnées'));return}
 if(a==='act')openSelActions()};
const selPieces=()=>[...SEL].map(id=>app.P.find(p=>p.id===id)).filter(Boolean);
function openSelActions(){const L=selPieces();if(!L.length)return app.toast(t('Choisis d\'abord des pièces'));const av=L.filter(avail).length,np=L.filter(unpub).length;
 const A=[['price',t('Baisser le prix'),t('{n} pièces en stock',{n:av}),'<path d="M12 4v14M7 13l5 5 5-5"/>'],['pub',t('Marquer publiées'),t('{n} pas encore en ligne',{n:np}),'<path d="M5 12l4.5 4.5L19 7"/>'],['ballot',t('Changer de ballot'),t('Rattache ou retire le ballot'),'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>'],['bac',t('Changer de bac'),t('Pour les ranger au même endroit'),'<path d="M4 8h16v12H4zM3 4h18v4H3z"/>'],...(app.hasComptes()?[['cpt',t('Changer de compte'),t('Range la sélection dans un compte de vente'),'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>']]:[]),['lab',t('Imprimer les étiquettes'),t('Étiquettes QR de la sélection'),'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM19 17v3h-3"/>'],['lot',t('Créer un lot'),t('Vendre ensemble ou rédiger l\'annonce'),'<path d="M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8"/>']];
 showSheet(sheetHead(tn(L.length,'pièce sélectionnée','pièces sélectionnées'))+`<div class="tools">${A.map(a=>`<button type="button" class="tool" data-sx="${a[0]}"><span class="tic">${TI(a[3])}</span><span class="tx"><b>${a[1]}</b><small>${a[2]}</small></span></button>`).join('')}</div>`);
 $('shc').onclick=e=>{const b=e.target.closest('[data-sx]');if(!b)return;({price:selPrice,pub:selPub,ballot:()=>selField('ballot'),bac:()=>selField('bac'),cpt:selCompte,lab:selLabels,lot:selLot})[b.dataset.sx]()}}
function selPub(){const L=selPieces().filter(unpub);if(!L.length){app.toast(t('Toutes les pièces choisies sont déjà en ligne'));return}
 const out=bulkMod(L.map(p=>p.id),q=>Object.assign(q,{pub:today()}));openSelActions();app.toast(t('{n} pièces marquées publiées',{n:out.length}),()=>bulkUndo(out))}
function selPrice(){const L=selPieces().filter(avail),skip=L.filter(p=>!priceFor(p)).length;let pct=10;
 const draw=()=>{const ex=L.find(p=>priceFor(p));showSheet(sheetHead(t('Baisser le prix'))+`<div class="card"><p class="sub" style="margin:0 0 12px">${t('Le prix visé de chaque pièce en stock baisse du même pourcentage.')}</p><div class="chips">${[5,10,15,20,30].map(v=>`<button type="button" class="chip sm${pct===v?' on':''}" data-pc="${v}">− ${v} %</button>`).join('')}</div>
  <div class="fld" style="margin-top:12px"><label class="l" for="sp_v">${t('Autre pourcentage')}</label><input type="text" inputmode="decimal" id="sp_v" value="${pct}"></div>
  ${ex?`<div class="pv">${esc(title(ex))} : ${eur(priceFor(ex))} → <b>${eur(newPrice(ex,pct))}</b></div>`:''}${skip?`<div class="hint">${t('{n} pièces sans prix connu seront ignorées.',{n:skip})}</div>`:''}</div>
  <div class="acts"><button type="button" class="btn mint" id="sp_ok"${L.length-skip?'':' disabled'}>${t('Baisser {n} pièces',{n:L.length-skip})}</button><button type="button" class="btn sec" id="sp_no">${t('Retour')}</button></div>`);
  $('sp_no').onclick=openSelActions;$('sp_v').oninput=()=>{const v=num($('sp_v').value);if(!isNaN(v)&&v>0&&v<100){pct=v;const ex2=L.find(p=>priceFor(p));const pv=document.querySelector('#shc .pv');if(pv&&ex2)pv.innerHTML=esc(title(ex2))+' : '+eur(priceFor(ex2))+' → <b>'+eur(newPrice(ex2,pct))+'</b>'}};
  $('shc').onclick=e=>{const c=e.target.closest('[data-pc]');if(c){pct=+c.dataset.pc;draw()}};
  $('sp_ok').onclick=()=>{const v=num($('sp_v').value);if(!isNaN(v)&&v>0&&v<100)pct=v;const out=bulkMod(L.filter(p=>priceFor(p)).map(p=>p.id),q=>Object.assign(q,{pvise:newPrice(q,pct)}));selSet(false);closeSheet();app.toast(t('{n} prix baissés de {p} %',{n:out.length,p:pct}),()=>bulkUndo(out))}};draw()}
const newPrice=(p,pct)=>Math.max(.5,nice(priceFor(p)*(1-pct/100)));
function selField(k){const L=selPieces(),lab=k==='ballot'?t('Ballot'):t('Bac'),vals=[...new Set(app.P.map(p=>p[k]).filter(Boolean))].sort();
 showSheet(sheetHead(t('Changer de {x}',{x:lc(lab)}))+`<div class="card"><div class="fld"><label class="l" for="sf_v">${lab}</label><input type="text" id="sf_v" list="sf_l" autocomplete="off" placeholder="${t('Vide pour retirer')}"><datalist id="sf_l">${vals.map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div><div class="hint">${t('Appliqué aux {n} pièces sélectionnées.',{n:L.length})}</div></div><div class="acts"><button type="button" class="btn mint" id="sf_ok">${t('Appliquer')}</button><button type="button" class="btn sec" id="sf_no">${t('Retour')}</button></div>`);
 $('sf_no').onclick=openSelActions;$('sf_ok').onclick=()=>{const v=$('sf_v').value.trim();const out=bulkMod(L.map(p=>p.id),q=>{if(v)q[k]=v;else delete q[k];return q});selSet(false);closeSheet();app.toast(t('{n} pièces modifiées',{n:out.length}),()=>bulkUndo(out))}}
/* range les pièces choisies dans un compte de vente (champ stk), ou les en retire */
function selCompte(){const L=selPieces(),CP=app.comptes();
 showSheet(sheetHead(t('Changer de compte'))+`<div class="card"><div class="chips">${CP.map(c=>`<button type="button" class="chip" data-sc="${esc(c.id)}">${esc(c.n)}</button>`).join('')}<button type="button" class="chip" data-sc="-">${t('Aucun compte')}</button></div><div class="hint">${t('Appliqué aux {n} pièces sélectionnées.',{n:L.length})}</div></div><div class="acts"><button type="button" class="btn sec" id="sc_no">${t('Retour')}</button></div>`);
 $('sc_no').onclick=openSelActions;
 $('shc').onclick=e=>{const b=e.target.closest('[data-sc]');if(!b)return;const id=b.dataset.sc,out=bulkMod(L.map(p=>p.id),q=>{if(id==='-')delete q.stk;else q.stk=id;return q});selSet(false);closeSheet();app.toast(t('{n} pièces modifiées',{n:out.length}),()=>bulkUndo(out))}}
function selLabels(){const L=selPieces();closeSheet();printLabels(L)}
function lotAd(L){const br=[...new Set(L.map(p=>p.marque).filter(Boolean))],ti=(t('Lot de {n}',{n:L.length})+' '+(br.slice(0,3).join(', ')||t('vêtements'))).slice(0,60),tot=L.reduce((a,p)=>a+(priceFor(p)||0),0),lotP=tot?nice(tot*.85):0;
 const desc=t('Lot de {n} pièces vendu ensemble, un seul envoi.',{n:L.length})+'\n\n'+L.map(p=>'• '+title(p)+(p.taille?' '+p.taille:'')+(p.etat?' · '+tv(p.etat):'')).join('\n')+(lotP?'\n\n'+t('Prix du lot : {p} au lieu de {q} séparément.',{p:eur(lotP),q:eur(tot)}):'')+'\n\n'+t('Envoi soigné. N\'hésite pas à poser tes questions.');return{ti,desc,lotP}}
function selLot(){const L=selPieces(),av=L.filter(avail);
 showSheet(sheetHead(t('Créer un lot'))+`<div class="card"><p class="sub" style="margin:0">${tn(av.length,'pièce en stock','pièces en stock')} ${t('dans la sélection')}.</p></div><div class="tools"><button type="button" class="tool" data-lt="sell"><span class="tic">${TI('<path d="M5 12l4.5 4.5L19 7"/>')}</span><span class="tx"><b>${t('Vendre ensemble')}</b><small>${t('Un paiement, un colis, prix et frais répartis')}</small></span></button><button type="button" class="tool" data-lt="ad"><span class="tic">${TI('<path d="M4 5h16v11H9l-5 4z"/>')}</span><span class="tx"><b>${t('Rédiger l\'annonce du lot')}</b><small>${t('Titre et description à copier dans Vinted')}</small></span></button></div><div class="acts"><button type="button" class="btn sec" id="lt_no">${t('Retour')}</button></div>`);
 $('lt_no').onclick=openSelActions;$('shc').onclick=e=>{const b=e.target.closest('[data-lt]');if(!b)return;if(b.dataset.lt==='sell')return openGroupSale(av.map(p=>p.id));
  const a=lotAd(av.length?av:L);showSheet(sheetHead(t('Annonce du lot'))+`<div class="card"><div class="fld"><label class="l" for="la_t">${t('Titre')}</label><input type="text" id="la_t" maxlength="60" value="${esc(a.ti)}"></div><div class="fld"><label class="l" for="la_d">${t('Description')}</label><textarea id="la_d" rows="12" style="font-size:15px">${esc(a.desc)}</textarea></div></div><div class="acts two"><button type="button" class="btn" id="la_ct">${t('Copier le titre')}</button><button type="button" class="btn" id="la_cd">${t('Copier la description')}</button></div><div class="acts"><button type="button" class="btn sec" id="la_no">${t('Retour')}</button></div>`);
  $('la_ct').onclick=()=>copyText($('la_t').value,t('Titre'));$('la_cd').onclick=()=>copyText($('la_d').value,t('Description'));$('la_no').onclick=selLot}}
