import { app } from '../state.js';
import { $, esc } from './core.js';
import { closeSheet } from './piece-sheet.js';
import { sheetHead, showSheet } from './tools-index.js';

/* ---------- boutique : nom, couleur, logo sur les exports ---------- */
const shop=()=>app.cfg.shop||{};
const shopCol=()=>{const c=shop().col;return/^#[0-9a-f]{6}$/i.test(c||'')?c:''};
let brandImg=null;function brandLoad(){const s=shop();if(s.logo){const i=new Image();i.src=s.logo;brandImg=i}else brandImg=null}brandLoad();
const logoMark24=app.logoMark;app.logoMark=function(c,x,y,s){if(brandImg&&brandImg.complete&&brandImg.naturalWidth){c.save();c.beginPath();if(c.roundRect)c.roundRect(x,y,s,s,s*.21);else c.rect(x,y,s,s);c.fillStyle='#ffffff';c.fill();c.clip();const k=Math.min(s/brandImg.width,s/brandImg.height);c.drawImage(brandImg,x+(s-brandImg.width*k)/2,y+(s-brandImg.height*k)/2,brandImg.width*k,brandImg.height*k);c.restore()}else logoMark24(c,x,y,s)};
(function(){const CP=CanvasRenderingContext2D.prototype;['fillStyle','strokeStyle'].forEach(k=>{const d=Object.getOwnPropertyDescriptor(CP,k);if(!d||!d.set)return;Object.defineProperty(CP,k,{get:d.get,set(v){if(typeof v==='string'&&v.toLowerCase()==='#ff4a1c'){const c=shopCol();if(c)v=c}d.set.call(this,v)},configurable:true})});
 const ft=CP.fillText;CP.fillText=function(s,...a){const n=shop().nom;if(n&&typeof s==='string'){if(s==='max')s=n;else if(s.length<40&&/\bMax\b/.test(s))s=s.replace(/\bMax\b/,n)}return ft.call(this,s,...a)}})();
function brandize(h){const s=shop(),col=shopCol();if(!s.nom&&!s.logo&&!col)return h;
 if(s.logo)h=h.replace(/<svg viewBox="0 0 104 104" width="34" height="34">[\s\S]*?<\/svg>/,`<img src="${s.logo}" alt="" style="width:34px;height:34px;object-fit:contain;border-radius:7px">`);
 if(s.nom)h=h.replace('<b>max</b>','<b>'+esc(s.nom)+'</b>');
 if(col&&h.indexOf('data-brand')<0)h='<style data-brand>.rp h4{color:'+col+'}.rph{border-bottom-color:'+col+'}.rt tr.tt td,.rl2 tr.tt td{border-bottom-color:'+col+'}</style>'+h;return h}
const printHTML24=app.printHTML;app.printHTML=function(h){return printHTML24(brandize(h))};
const reportHTML24=app.reportHTML;app.reportHTML=function(m){return brandize(reportHTML24(m))};
async function logoFromFile(f){const url=URL.createObjectURL(f);try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});let mx=256,out='';for(let n=0;n<3;n++){const k=Math.min(1,mx/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));c.getContext('2d').drawImage(img,0,0,c.width,c.height);out=c.toDataURL('image/png');if(out.length<110000)return out;out=c.toDataURL('image/jpeg',.85);if(out.length<110000)return out;mx=Math.round(mx*.7)}return out}finally{URL.revokeObjectURL(url)}}
export function openBoutique(){let s=Object.assign({nom:'',col:'',logo:''},shop());
 const draw=()=>{const c=/^#[0-9a-f]{6}$/i.test(s.col)?s.col:'#FF4A1C';showSheet(sheetHead(t('Ma boutique'))+`<div class="card"><p class="sub" style="margin:0 0 12px">${t('Ton nom, ta couleur et ton logo remplacent ceux de Max sur les PDF, les visuels réseaux et le Wrapped.')}</p>
  <div class="brp"><div class="brl">${s.logo?`<img src="${s.logo}" alt="">`:`<span>${t('Logo')}</span>`}</div><div><b style="font-size:20px">${esc(s.nom||'Max')}</b><i style="display:block;height:6px;width:70px;border-radius:3px;background:${c};margin-top:6px"></i></div></div>
  <div class="fld"><label class="l" for="bt_n">${t('Nom de la boutique')}</label><input type="text" id="bt_n" maxlength="18" value="${esc(s.nom)}" placeholder="Max" autocomplete="off"></div>
  <div class="row2 fld"><div><label class="l" for="bt_c">${t('Couleur')}</label><input type="color" id="bt_c" value="${c}" style="height:50px;padding:4px"></div><div><label class="l" for="bt_f">${t('Logo')}</label><input type="file" id="bt_f" accept="image/*"></div></div>
  <div class="hint">${t('Un logo carré sur fond clair ou transparent donne le meilleur résultat. 18 caractères maximum pour le nom.')}</div></div>
  <div class="acts"><button type="button" class="btn mint" id="bt_ok">${t('Enregistrer')}</button><div class="acts two" style="margin:0"><button type="button" class="btn sec" id="bt_rm">${t('Retirer le logo')}</button><button type="button" class="btn sec" id="bt_rs">${t('Revenir à Max')}</button></div></div>`);
  $('bt_n').oninput=()=>{s.nom=$('bt_n').value;document.querySelector('.brp b').textContent=s.nom||'Max'};$('bt_c').oninput=()=>{s.col=$('bt_c').value;document.querySelector('.brp i').style.background=s.col};
  $('bt_f').onchange=async()=>{const f=$('bt_f').files[0];if(!f)return;try{s.logo=await logoFromFile(f);s.nom=$('bt_n').value;draw()}catch(e){app.toast(t('Image illisible'))}};
  $('bt_rm').onclick=()=>{s.logo='';s.nom=$('bt_n').value;draw()};$('bt_rs').onclick=()=>{app.setCfg({shop:null});brandLoad();app.toast(t('Retour à Max'));openBoutique()};
  $('bt_ok').onclick=()=>{s.nom=$('bt_n').value.trim();const o={};if(s.nom)o.nom=s.nom;if(s.col)o.col=s.col;if(s.logo)o.logo=s.logo;app.setCfg({shop:Object.keys(o).length?o:null});brandLoad();app.toast(t('Boutique enregistrée'));closeSheet()}};draw()}
