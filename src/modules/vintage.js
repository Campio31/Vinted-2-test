import { app } from '../state.js';
import { $, esc } from './core.js';
import { nrm } from './advice.js';
import { copyText } from './listing.js';
import { sheetHead, showSheet } from './tools-index.js';
import { eraBar, illusFor, illusHTML } from './vintage-art.js';

app.openVintage = openVintage;

/* ===== v24 c : vintage, bilan personnalisable, confort, boutique ===== */
const vintageFor=m=>{if(!m||!window.VINTAGE)return null;const k=nrm(m);return VINTAGE.marques.find(b=>nrm(b.n)===k||b.a.includes(k))||null};
app.vintageFor = vintageFor;
export function openVintage(name,pid){const V=window.VINTAGE;if(!V)return app.toast(t('Repères indisponibles'));const piece=pid&&app.P.find(x=>x.id===pid);
 if(!name){let q='';const draw=()=>{const k=nrm(q),L=V.marques.filter(b=>!k||nrm(b.n).includes(k)||b.a.some(a=>a.includes(k)));$('vv_l').innerHTML=L.map(b=>`<button type="button" class="li" data-vb="${esc(b.n)}"><div class="m"><b>${esc(b.n)}</b><small>${b.r.map(r=>esc(r.t)).join(' · ')}</small></div></button>`).join('')||`<div class="empty" style="padding:14px 8px">${t('Marque pas encore dans la liste. Les repères généraux ci-dessous valent pour toutes.')}</div>`};
  showSheet(sheetHead(t('Datation vintage'))+`<p class="sub" style="margin:0 0 10px">${t('Étiquettes, logos et pays de fabrication par marque, pour dater une pièce et justifier ton prix.')}</p><input type="search" id="vv_q" placeholder="${t('Chercher une marque')}" autocomplete="off"><div id="vv_l" style="margin-top:12px"></div><div class="acts"><button type="button" class="btn sec" data-vb="*">${t('Repères généraux')}</button></div>`);draw();$('vv_q').oninput=()=>{q=$('vv_q').value;draw()};
  $('shc').onclick=e=>{const b=e.target.closest('[data-vb]');if(b)openVintage(b.dataset.vb)};return}
 const br=name==='*'?null:V.marques.find(b=>b.n===name),secs=(br?br.r:[]).map(r=>({t:r.t,l:r.l,id:'b'})),gen=V.general,picked=new Set();let dec='';
 const text=()=>{const L=[...document.querySelectorAll('#shc [data-vl]:checked')].map(x=>x.value.replace(/[.\s]+$/,'')),m=br?br.n:(piece&&piece.marque)||'';return t('Pièce vintage')+(m?' '+m:'')+(dec?', '+dec:'')+'.'+(L.length?' '+t('Indices de datation')+' : '+L.join(' ; ')+'.':'')};
 /* chaque rubrique : un schéma (où regarder) quand il y en a un, et pour chaque indice la règle des décennies concernées */
 const block=(s,open,brand)=>{const k=illusFor(brand,s.t);return`<details class="card hist"${open?' open':''}><summary>${esc(s.t)}</summary>${k?illusHTML(k):''}${s.l.map(l=>`<label class="chk vl"><input type="checkbox" data-vl value="${esc(l)}"><span class="vtx">${esc(l)}${eraBar(l)}</span></label>`).join('')}</details>`};
 showSheet(sheetHead(br?esc(br.n):t('Repères généraux'))+`<div class="cl cl-o" style="margin-bottom:12px"><i></i><div><b>${t('Des indices, pas des preuves')}</b><span>${t('Recoupe plusieurs repères avant d\'écrire une date. Une étiquette peut être recousue et un modèle réédité.')}</span></div></div>
  <p class="hint" style="margin:0 0 10px">${t('La règle 60 à 20 sous chaque indice montre les décennies concernées : une case colorée = la période probable.')}</p>
  ${secs.map(s=>block(s,true,br?br.n:'')).join('')}${br?`<h3 style="margin:16px 0 8px">${t('Repères généraux')}</h3>`:''}${gen.map(s=>block(s,!br,'')).join('')}
  <div class="card"><h3 style="margin:0 0 8px">${t('Phrase pour ton annonce')}</h3><div class="chips" id="vv_d" style="margin-bottom:10px">${['années 60','années 70','années 80','années 90','années 2000'].map(d=>`<button type="button" class="chip sm" data-vd="${d}">${t(d)}</button>`).join('')}</div><textarea id="vv_t" rows="4" style="font-size:15px"></textarea><div class="hint">${t('Coche les indices que tu as vérifiés sur ta pièce, choisis la période, puis copie.')}</div>
  <div class="acts ${piece?'two':''}"><button type="button" class="btn" id="vv_c">${t('Copier')}</button>${piece?`<button type="button" class="btn sec" id="vv_n">${t('Ajouter à la note de la pièce')}</button>`:''}</div></div>
  <div class="acts"><button type="button" class="btn sec" id="vv_b">${t('Retour')}</button></div>`);
 const up=()=>{$('vv_t').value=text()};up();
 $('shc').onchange=e=>{if(e.target.matches('[data-vl]'))up()};
 $('shc').onclick=e=>{const d=e.target.closest('[data-vd]');if(d){const was=d.classList.contains('on');$('vv_d').querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));dec=was?'':d.dataset.vd;if(!was)d.classList.add('on');up()}};
 $('vv_c').onclick=()=>copyText($('vv_t').value,t('Texte'));
 if($('vv_n'))$('vv_n').onclick=()=>{const p=app.P.find(x=>x.id===pid);if(!p)return;app.save(Object.assign({},p,{note:((p.note?p.note+'\n':'')+$('vv_t').value).slice(0,600)}));app.toast(t('Ajouté à la note'));app.openSheet(pid)};
 $('vv_b').onclick=()=>piece?app.openSheet(pid):openVintage()}
