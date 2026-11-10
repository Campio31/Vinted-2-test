import { app } from '../state.js';
import { $, esc, nextId, num, title, today } from './core.js';
import { genCode } from './form.js';
import { PASTEL } from './stock-view.js';
import { sheetHead, showSheet } from './tools-index.js';

/* ---------- variantes : même modèle, un champ qui change ---------- */
export function openVariant(id,done){const p=app.P.find(x=>x.id===id);if(!p)return;let fld='taille',made=[];
 const cols=Object.keys(PASTEL),grades=[...new Set(app.P.map(x=>x.grade).filter(Boolean))].sort();
 const draw=()=>{showSheet(sheetHead(t('Créer des variantes'))+`<div class="card"><p class="sub" style="margin:0 0 10px">${esc(title(p))}${p.taille?' · '+esc(p.taille):''}${(p.coul||[]).length?' · '+esc(p.coul.map(tv).join(', ')):''}. ${t('La fiche est recopiée, un seul champ change.')}</p>
  <span class="l">${t('Ce qui change')}</span><div class="chips" id="va_f" style="margin:8px 0 12px">${[['taille','Taille'],['coul','Couleur'],['grade','Grade'],['achat','Prix d\'achat']].map(([k,l])=>`<button type="button" class="chip sm${fld===k?' on':''}" data-vf="${k}">${t(l)}</button>`).join('')}</div>
  ${fld==='coul'?`<div class="chips" id="va_c">${cols.map(c=>`<button type="button" class="chip sm" data-vc="${esc(c)}">${esc(tv(c))}</button>`).join('')}</div>`:fld==='grade'?`<div class="chips" id="va_c">${grades.map(c=>`<button type="button" class="chip sm" data-vc="${esc(c)}">${esc(c)}</button>`).join('')}</div>`:`<div class="fld"><label class="l" for="va_v">${fld==='taille'?t('Nouvelles tailles (sépare par des virgules)'):t('Nouveau prix d\'achat')}</label><input type="text" id="va_v" ${fld==='achat'?'inputmode="decimal"':''} placeholder="${fld==='taille'?'S, M, L':'0'+app.DS+'00'}" autocomplete="off"></div>`}
  <div class="hint">${fld==='coul'?t('Choisis une ou plusieurs couleurs : une fiche par couleur, sans la photo.'):t('La photo, le prix visé et les notes sont recopiés ; le code est recalculé.')}</div></div>
  <div class="acts"><button type="button" class="btn mint" id="va_go">${t('Créer')}</button><button type="button" class="btn sec" id="va_no">${made.length?t('Terminé'):t('Retour')}</button></div>${made.length?`<div class="card"><span class="l">${t('Créées')}</span>${made.map(m=>`<button type="button" class="li" data-id="${esc(m.id)}" style="margin-top:6px"><div class="m"><b>${esc(title(m))}</b><small>${esc([m.taille,(m.coul||[]).map(tv).join(', '),m.grade].filter(Boolean).join(' · '))}${m.code?' · '+esc(m.code):''}</small></div></button>`).join('')}</div>`:''}`);
  $('va_no').onclick=()=>done?done():app.openSheet(id);
  $('shc').onclick=e=>{const f=e.target.closest('[data-vf]');if(f){fld=f.dataset.vf;return draw()}const c=e.target.closest('[data-vc]');if(c){c.classList.toggle('on');return}const li=e.target.closest('.li[data-id]');if(li)return app.openSheet(li.dataset.id)};
  $('va_go').onclick=()=>{let vals=[];if(fld==='coul'||fld==='grade')vals=[...document.querySelectorAll('#va_c .on')].map(x=>x.dataset.vc);else if(fld==='achat'){const v=num($('va_v').value);if(!isNaN(v)&&v>=0)vals=[v]}else vals=$('va_v').value.split(',').map(s=>s.trim()).filter(Boolean);
   if(!vals.length)return app.toast(t('Indique la nouvelle valeur'));
   vals.forEach(v=>{const q=Object.assign({},p,{id:nextId(),statut:'Disponible',entree:today(),cree:Date.now()});['pub','pvise','pv','dv','canal','frais','vt','acheteur','exp','lot','lotn','fo','h','pr','retours','code','ex','dispo'].forEach(k=>delete q[k]);
    if(fld==='coul'){q.coul=[v];delete q.photo}else q[fld]=v;const cd=genCode(q);if(cd)q.code=cd;q.h=[{t:Date.now(),e:'Variante de '+(p.code||title(p))}];app.save(q);made.push(q)});
   app.toast(tn(vals.length,'fiche créée','fiches créées'));draw()}};draw()}
