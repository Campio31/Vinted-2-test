import { app } from '../state.js';
import { $, esc, eur, fd, num, ok, pad, title } from './core.js';
import { tx } from './storage.js';
import { hydrate, phBlob, phImg } from './photos.js';
import { cloud, queue } from './sync.js';
import { sheetHead, showSheet } from './tools-index.js';
import { compressBlob } from './photo-compress.js';

app.printHTML = printHTML;
app.openProofs = openProofs;

/* ===== v20 : preuves, visuels rÃ©seaux, calendrier, rappels, wrapped, dÃ©fis, import, aide, performances ===== */
export const VER='v56';
export const ldate=d=>d.getFullYear()+'-'+pad(d.getMonth()+1,2)+'-'+pad(d.getDate(),2);
const fmtDT=t=>{const d=new Date(t);return fd(ldate(d))+' '+pad(d.getHours(),2)+':'+pad(d.getMinutes(),2)};
export const fmtSize=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',app.DS)+' '+t('Mo'):Math.max(1,Math.round(b/1024))+' '+t('Ko');
export const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
export async function photoBlob(id){let b=await phBlob(id);if(!b&&cloud&&app.user&&app.online){try{const r=await app.sb.storage.from('photos').download(app.user.id+'/'+id+'.jpg');if(r.data){b=r.data;await tx('photos','readwrite',s=>s.put({id,blob:b}))}}catch(e){}}return b}
export async function shareFiles(files,text){if(navigator.canShare&&navigator.canShare({files})){try{await navigator.share({files,text});return}catch(e){if(e&&e.name==='AbortError')return}}
 for(const f of files){const u=URL.createObjectURL(f),a=document.createElement('a');a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);await new Promise(r=>setTimeout(r,300))}}
async function printHTML(html){let el=$('rpt');if(!el){el=document.createElement('div');el.id='rpt';document.body.appendChild(el)}el.innerHTML=html;
 await Promise.all([...el.querySelectorAll('img')].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r})));
 document.body.classList.add('printing-r');const done=()=>{document.body.classList.remove('printing-r');window.removeEventListener('afterprint',done)};window.addEventListener('afterprint',done);setTimeout(()=>window.print(),80)}

/* --- 1. dossier de preuves par vente --- */
async function sha256(blob){try{const b=await blob.arrayBuffer(),d=await crypto.subtle.digest('SHA-256',b);return[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return''}}
const proofN=p=>p.pr&&p.pr.i&&p.pr.i.length?' ('+p.pr.i.length+')':'';
app.proofN = proofN;
function saleLine(p){return[title(p),p.code,p.acheteur?'@'+p.acheteur:'',p.canal||'Vinted',eur(p.pv),ok(p.dv)?fd(p.dv):''].filter(Boolean).join(' Â· ')}
async function addProof(id,file,kind){let p=app.P.find(x=>x.id===id);if(!p)return;let blob=file;
 if(kind==='p'){try{blob=await compressBlob(file,1600,.8)}catch(e){return app.toast(t('Photo illisible'))}}else if(file.size>60*1048576)return app.toast(t('VidÃ©o trop lourde ({s}) : filme 10 secondes au maximum',{s:fmtSize(file.size)}));
 const h=await sha256(blob),pid=(kind==='v'?'vd':'ph')+rid();await tx('photos','readwrite',s=>s.put({id:pid,blob}));
 p=app.P.find(x=>x.id===id);const pr=Object.assign({},p.pr||{});pr.i=[...(pr.i||[]),{id:pid,t:Date.now(),k:kind,s:blob.size,h}];app.save(Object.assign({},p,{pr}));if(kind==='p')await queue('photo',pid)}
function openProofs(id){const p=app.P.find(x=>x.id===id);if(!p)return;const pr=p.pr||{},it=pr.i||[];
 showSheet(sheetHead(t('Dossier de preuves'))+`<p class="sub">${esc(saleLine(p))}</p>
  <div class="card"><div class="row2 fld"><div><label class="l" for="pf_w">${t('Poids du colis (g)')}</label><input type="text" inputmode="decimal" id="pf_w" value="${esc(pr.w?String(pr.w).replace('.',app.DS):'')}" placeholder="450"></div><div><label class="l" for="pf_n">${t('Note')}</label><input type="text" id="pf_n" value="${esc(pr.n||'')}" placeholder="${t('NÂ° de suivi, Ã©tat Ã  l\'emballageâ€¦')}" autocomplete="off"></div></div>
  <div class="acts two"><label class="btn mint" style="cursor:pointer">${t('Photo du colis')}<input type="file" accept="image/*" capture="environment" id="pf_ph" hidden></label><label class="btn sec" style="cursor:pointer">${t('VidÃ©o courte')}<input type="file" accept="video/*" capture="environment" id="pf_vd" hidden></label></div>
  <div class="hint" id="pf_s">${t('Chaque fichier est horodatÃ© et reÃ§oit une empreinte numÃ©rique (SHA-256) qui prouve qu\'il n\'a pas Ã©tÃ© modifiÃ© aprÃ¨s coup. Les vidÃ©os restent sur cet appareil.')}</div></div>
  ${it.map((x,k)=>`<div class="pf"><div class="pfm">${x.k==='v'?`<video data-vd="${esc(x.id)}" controls playsinline muted preload="metadata"></video>`:phImg(x.id,'pfi')}</div><div class="pft"><b>${x.k==='v'?t('VidÃ©o'):t('Photo')} Â· ${fmtDT(x.t)}</b><small>${t('{s} Â· empreinte {h}',{s:fmtSize(x.s),h:esc((x.h||'').slice(0,12))+(x.h?'â€¦':'')})}</small><button type="button" class="btn sm sec" data-pdel="${k}">${t('Retirer')}</button></div></div>`).join('')||'<div class="empty" style="padding:14px 8px">'+t('Aucune preuve pour l\'instant. Photographie le colis emballÃ© avant de le dÃ©poser.')+'</div>'}
  ${it.length?'<div class="acts two"><button type="button" class="btn sec" id="pf_pr">'+t('Imprimer le dossier')+'</button><button type="button" class="btn sec" id="pf_sh">'+t('Enregistrer les fichiers')+'</button></div>':''}
  <div class="acts"><button type="button" class="btn sec" id="pf_bk">${t('Retour')}</button></div>`);
 hydrate();document.querySelectorAll('video[data-vd]').forEach(async v=>{const b=await phBlob(v.dataset.vd);if(b)v.src=URL.createObjectURL(b)});
 const cur=()=>app.P.find(x=>x.id===id),setPr=patch=>{const q=cur();app.save(Object.assign({},q,{pr:Object.assign({},q.pr||{},patch)}))};
 $('pf_w').onchange=()=>{const v=num($('pf_w').value);setPr({w:isNaN(v)||v<=0?undefined:v});app.toast(t('Poids enregistrÃ©'))};
 $('pf_n').onchange=()=>{setPr({n:$('pf_n').value.trim()||undefined});app.toast(t('Note enregistrÃ©e'))};
 $('pf_bk').onclick=()=>app.openSheet(id);
 $('shc').onchange=async e=>{const t=e.target;if(t.id!=='pf_ph'&&t.id!=='pf_vd')return;const f=t.files&&t.files[0];t.value='';if(!f)return;$('pf_s').textContent=window.t('Enregistrementâ€¦');await addProof(id,f,t.id==='pf_vd'?'v':'p');openProofs(id)};
 $('shc').onclick=async e=>{const d=e.target.closest('[data-pdel]');
  if(d){if(d.dataset.sure!=='1'){d.dataset.sure='1';d.textContent=window.t('Confirmer ?');setTimeout(()=>{if(d.isConnected){d.dataset.sure='';d.textContent=window.t('Retirer')}},4000);return}
   const q=cur(),i=[...(q.pr.i||[])],x=i.splice(+d.dataset.pdel,1)[0];app.save(Object.assign({},q,{pr:Object.assign({},q.pr,{i})}));if(x)await tx('photos','readwrite',s=>{s.delete(x.id)});openProofs(id);return}
  if(e.target.closest('#pf_pr'))return printProof(id);
  if(e.target.closest('#pf_sh')){const q=cur(),fs=[];for(const x of q.pr.i){const b=await phBlob(x.id);if(b)fs.push(new File([b],'preuve-'+(q.code||q.id)+'-'+ldate(new Date(x.t))+'-'+x.id+(x.k==='v'?'.mp4':'.jpg'),{type:b.type}))}await shareFiles(fs,window.t('Preuves {t}',{t:title(q)}))}};}
async function printProof(id){const p=app.P.find(x=>x.id===id),pr=p.pr||{},it=pr.i||[],rows=[];
 for(const x of it){let u='';if(x.k==='p'){const b=await phBlob(x.id);if(b)u=URL.createObjectURL(b)}rows.push({x,u})}
 const mark='<svg viewBox="0 0 104 104" width="34" height="34"><rect width="104" height="104" rx="22" fill="#111"/><rect x="12" y="68" width="80" height="18" rx="3" fill="#F1F2F4"/><rect x="18" y="46" width="68" height="18" rx="3" fill="#C9CBD0"/><rect x="32" y="14" width="58" height="18" rx="3" fill="#FF4A1C" transform="rotate(-12 62 24)"/></svg>';
 await app.printHTML(`<div class="rp"><div class="rph">${mark}<div><b>syno</b><span>${t('Dossier de preuves')}</span></div><div class="rpm"><b>${esc(title(p))}</b><span>${t('Ã©ditÃ© le {d}',{d:fmtDT(Date.now())})}</span></div></div>
  <h4>${t('Vente')}</h4><table class="rt"><tr><td>${t('PiÃ¨ce')}</td><td>${esc(title(p))}${p.code?' Â· '+esc(p.code):''}</td></tr><tr><td>${t('Acheteur')}</td><td>${p.acheteur?'@'+esc(p.acheteur):t('non renseignÃ©')}</td></tr><tr><td>${t('Plateforme')}</td><td>${esc(tv(p.canal||'Vinted'))}</td></tr><tr><td>${t('Prix')}</td><td>${eur(p.pv)}</td></tr><tr><td>${t('Date de vente')}</td><td>${ok(p.dv)?fd(p.dv):'â€”'}</td></tr><tr><td>${t('Poids du colis')}</td><td>${pr.w?String(pr.w).replace('.',app.DS)+' g':t('non renseignÃ©')}</td></tr>${pr.n?`<tr><td>${t('Note')}</td><td>${esc(pr.n)}</td></tr>`:''}</table>
  <h4>${t('Preuves horodatÃ©es')}</h4>${rows.map(({x,u})=>`<div class="pfp">${u?`<img src="${u}" alt="">`:''}<div><b>${x.k==='v'?t('VidÃ©o de l\'emballage'):t('Photo du colis')}</b><br>${fmtDT(x.t)} Â· ${fmtSize(x.s)}<br><span class="hs">SHA-256 ${esc(x.h||'')}</span></div></div>`).join('')||'<p>'+t('Aucune preuve.')+'</p>'}
  <p class="rpf">${t('Les dates viennent de l\'horloge de l\'appareil au moment de l\'enregistrement. L\'empreinte SHA-256 permet de vÃ©rifier qu\'un fichier n\'a pas Ã©tÃ© modifiÃ© depuis. Ce dossier n\'a pas de valeur d\'horodatage certifiÃ©.')}</p></div>`)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-proof]');if(b){e.preventDefault();e.stopPropagation();openProofs(b.dataset.proof)}},true);
