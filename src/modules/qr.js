import { app } from '../state.js';
import { $, LSg, LSs, avail, esc, title, today } from './core.js';
import { abc, freq } from './form.js';
import { closeSheet } from './piece-sheet.js';
import { sheetHead, showSheet } from './tools-index.js';

app.openQrTool = openQrTool;
app.openScanner = openScanner;

/* ===== 7. Scanner QR, étiquettes et bacs : un seul outil, deux onglets ===== */
const qrSvg=(t,cell)=>{const q=qrcode(0,'M');q.addData(t);q.make();return q.createSvgTag(cell||3,0)};
const naturalBacs=()=>abc(freq('bac'));

function openQrTool(tab){
 let cur=tab==='labels'||tab==='scan'?tab:LSg('qrTab','scan');
 showSheet(sheetHead(t('Scanner QR et étiquettes'))+`<div class="chips" id="qr_tabs" style="margin-bottom:12px"><button type="button" class="chip" data-qt="scan">${t('Scanner')}</button><button type="button" class="chip" data-qt="labels">${t('Étiquettes et bacs')}</button></div><div id="qr_body"></div>`);
 const draw=()=>{$('qr_tabs').querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.qt===cur));LSs('qrTab',cur);cur==='scan'?drawScan():drawLabels()};
 $('shc').onclick=e=>{const b=e.target.closest('[data-qt]');if(b){cur=b.dataset.qt;draw()}};
 draw()}

/* --- onglet Scanner : caméra, ou code saisi à la main --- */
function drawScan(){
 $('qr_body').innerHTML=`<div class="card"><p class="sub" style="margin-bottom:12px">${t('Scanne le QR d\'une étiquette : la fiche s\'ouvre et le bac est indiqué.')}</p>
  <div class="acts"><button type="button" class="btn" id="qr_cam">${t('Ouvrir la caméra')}</button></div>
  <label class="l" for="qr_code" style="margin-top:16px">${t('Ou saisis le code de la pièce')}</label>
  <div class="pwrow"><input type="text" id="qr_code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ShSpoSt0A-001"><button type="button" class="btn sm" id="qr_find">${t('Chercher')}</button></div>
  <div class="hint" id="qr_msg" role="status"></div></div>`;
 $('qr_cam').onclick=()=>openScanner();
 const find=()=>{const v=$('qr_code').value.trim();if(!v)return;const p=findByQr(v);if(p)return app.openSheet(p.id);$('qr_msg').textContent=t('Aucune pièce avec ce code')};
 $('qr_find').onclick=find;$('qr_code').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();find()}}}

/* --- onglet Étiquettes et bacs --- */
function drawLabels(){
 let mode=LSg('qrMode','new'),sel=new Set();
 const list=()=>{const st=app.P.filter(avail);return mode==='new'?st.filter(p=>p.entree===today()):mode==='nobac'?st.filter(p=>!p.bac):mode==='all'?st:st.filter(p=>p.bac===mode)};
 const count=()=>{const L=list();$('qr_n').textContent=tn(L.length,'pièce','pièces')+(L.length>80?' '+t('(80 affichées)'):'')+' · '+tn(sel.size,'sélectionnée','sélectionnées')};
 const draw=()=>{const L=list();sel=new Set([...sel].filter(id=>L.some(p=>p.id===id)));
  $('qr_list').innerHTML=L.slice(0,80).map(p=>`<label class="qrr"><input type="checkbox" data-sel="${esc(p.id)}"${sel.has(p.id)?' checked':''}><span><b>${esc(p.code||p.id)}</b> ${esc(title(p))}${p.taille?' · '+esc(p.taille):''}</span><em>${esc(p.bac||'—')}</em></label>`).join('')||'<div class="hint">'+t('Aucune pièce dans ce filtre.')+'</div>';
  count();
  $('qr_flt').querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.m===mode))};
 const bacs=naturalBacs();
 $('qr_body').innerHTML=`<div class="card"><p class="sub" style="margin-bottom:10px">${t('Choisis des pièces, range-les dans un bac, imprime leurs étiquettes. Scanner le QR ouvre la fiche et indique le bac.')}</p>
  <div class="chips" id="qr_flt"><button type="button" class="chip sm" data-m="new">${t('Ajoutées aujourd\'hui')}</button><button type="button" class="chip sm" data-m="nobac">${t('Sans bac')}</button><button type="button" class="chip sm" data-m="all">${t('Tout le stock')}</button>${bacs.map(b=>`<button type="button" class="chip sm" data-m="${esc(b)}">${esc(b)}</button>`).join('')}</div>
  <div class="hint" id="qr_n" style="margin:8px 0"></div><div class="qrl" id="qr_list"></div>
  <div class="acts two" style="margin-top:8px"><button type="button" class="btn sec sm" id="qr_all">${t('Tout sélectionner')}</button><button type="button" class="btn sec sm" id="qr_none">${t('Rien')}</button></div>
  <label class="l" for="qr_b" style="margin-top:14px">${t('Ranger la sélection dans le bac')}</label><div class="pwrow"><input type="text" id="qr_b" list="qr_bl" placeholder="B3" autocapitalize="characters" autocomplete="off"><button type="button" class="btn sm" id="qr_set">${t('Ranger')}</button></div><datalist id="qr_bl">${bacs.map(b=>`<option value="${esc(b)}">`).join('')}</datalist>
  <div class="acts"><button type="button" class="btn" id="qr_print">${t('Imprimer les étiquettes')}</button></div></div>`;
 $('qr_flt').onclick=e=>{const c=e.target.closest('[data-m]');if(c){mode=c.dataset.m;LSs('qrMode',mode);draw()}};
 $('qr_list').onchange=e=>{const i=e.target.dataset.sel;if(!i)return;e.target.checked?sel.add(i):sel.delete(i);count()};
 $('qr_all').onclick=()=>{list().slice(0,80).forEach(p=>sel.add(p.id));draw()};$('qr_none').onclick=()=>{sel.clear();draw()};
 $('qr_set').onclick=()=>{const b=$('qr_b').value.trim().toUpperCase();if(!b)return app.toast(t('Indique le bac'));if(!sel.size)return app.toast(t('Sélectionne des pièces'));
  const olds=[...sel].map(id=>app.P.find(p=>p.id===id)).filter(Boolean);olds.forEach(p=>app.save(Object.assign({},p,{bac:b})));app.toast(t('{n} dans le bac {b}',{n:tn(olds.length,'pièce','pièces'),b}),()=>olds.forEach(p=>app.save(p)));draw()};
 $('qr_print').onclick=()=>{const L=[...sel].map(id=>app.P.find(p=>p.id===id)).filter(Boolean);if(!L.length)return app.toast(t('Sélectionne des pièces'));printLabels(L)};
 draw()}
export function printLabels(L){let box=$('plabels');if(!box){box=document.createElement('div');box.id='plabels';document.body.appendChild(box)}
 box.innerHTML=L.map(p=>`<div class="plb"><div class="pq">${qrSvg('stock:'+p.id,3)}</div><div class="pt2"><b>${esc(p.bac||'')}</b><span class="pc2">${esc(p.code||p.id)}</span><span>${esc(title(p))}</span><span>${esc([p.taille,p.grade&&t('grade {g}',{g:p.grade})].filter(Boolean).join(' · '))}</span></div></div>`).join('');
 document.body.classList.add('printing');const done=()=>{document.body.classList.remove('printing');window.removeEventListener('afterprint',done)};window.addEventListener('afterprint',done);setTimeout(()=>window.print(),150)}
let scanStream=null,scanRaf=0;
function stopScan(){cancelAnimationFrame(scanRaf);if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}$('scan').hidden=true}
async function openScanner(){
 closeSheet();
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return app.toast(t('La caméra n\'est pas disponible ici (il faut une adresse https)'));
 try{scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false})}catch(e){return app.toast(t('Accès à la caméra refusé'))}
 const v=$('scan_v');v.srcObject=scanStream;await v.play().catch(()=>{});$('scan').hidden=false;$('scan_s').textContent=t('Place le QR dans le cadre');
 const det=window.BarcodeDetector?new BarcodeDetector({formats:['qr_code']}):null,cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
 const tick=async()=>{if(!scanStream)return;if(v.readyState>=2){let txt=null;
   try{if(det){const r=await det.detect(v);if(r.length)txt=r[0].rawValue}else if(window.jsQR){cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);const im=cx.getImageData(0,0,cv.width,cv.height),r=jsQR(im.data,cv.width,cv.height);if(r)txt=r.data}}catch(e){}
   if(txt){const found=findByQr(txt);if(found){stopScan();app.openSheet(found.id);return}$('scan_s').textContent=t('QR lu, mais aucune pièce correspondante : {q}',{q:txt.slice(0,30)})}}
  scanRaf=requestAnimationFrame(tick)};tick()}
const findByQr=t=>{const m=/^stock:(.+)$/.exec(String(t).trim());return app.P.find(p=>p.id===(m?m[1]:t))||app.P.find(p=>p.code===String(t).trim())};
$('scan_x').onclick=stopScan;
