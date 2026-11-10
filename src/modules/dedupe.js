import { app } from '../state.js';
import { $, LSg, LSs, esc } from './core.js';
import { persist, tx } from './storage.js';
import { freq, genCode, lev } from './form.js';
import { nrm } from './advice.js';
import { queueMany } from './sync.js';
import { sheetHead, showSheet } from './tools-index.js';

app.canonVal = canonVal;
app.openMerge = openMerge;

/* ===== 3. Valeurs en double : fusion et listes fermées ===== */
const MFIELDS=[['marque','Marque'],['collab','Collab / équipe'],['prov','Provenance'],['etat','État'],['madein','Made in'],['ballot','Ballot'],['bac','Bac'],['taille','Taille'],['cat','Catégorie'],['sub','Type'],['modele','Modèle']];
const NONE_RE=/^aucune?$/i;
const vkey=v=>nrm(v).replace(/s$/,'');
export function canonVal(f,v){v=String(v==null?'':v).trim();if(!v)return v;if(f==='collab'&&NONE_RE.test(v))return'';const al=(app.cfg.alias&&app.cfg.alias[f])||{},k=nrm(v);if(Object.prototype.hasOwnProperty.call(al,k))return al[k];const ex=freq(f).find(x=>nrm(x)===k||vkey(x)===vkey(v)&&vkey(v).length>=4);return ex||v}
function nearValue(f,v){v=String(v||'').trim();if(v.length<4||/\d/.test(v))return null;const k=nrm(v);let best=null,bd=9;freq(f).forEach(x=>{if(/\d/.test(x)||nrm(x)===k)return;const d=lev(k,nrm(x));if(d<bd&&d<=(Math.min(k.length,x.length)>=9?2:1)&&Math.abs(x.length-v.length)<=2){bd=d;best=x}});return best}
function valCounts(f){const m=new Map();app.P.forEach(p=>{const v=p[f];if(v!==undefined&&v!==null&&v!==''&&typeof v==='string')m.set(v,(m.get(v)||0)+1)});return m}
function mergeSuggestions(f){const m=valCounts(f),vals=[...m.entries()],out=[],used=new Set();
 if(f==='collab')vals.filter(([v])=>NONE_RE.test(v)).forEach(([v,c])=>out.push({from:v,to:'',fc:c,tc:0,why:t('« {v} » veut dire « pas de collab » : à vider',{v})}));
 for(let i=0;i<vals.length;i++)for(let j=i+1;j<vals.length;j++){const [a,ca]=vals[i],[b,cb]=vals[j];if(f==='collab'&&(NONE_RE.test(a)||NONE_RE.test(b)))continue;const ka=nrm(a),kb=nrm(b);let why=null;
  if(ka===kb||vkey(a)===vkey(b)&&vkey(a).length>=4)why=t('même mot (casse ou pluriel)');else if(['marque','collab','prov'].includes(f)&&!/\d/.test(a+b)&&Math.min(ka.length,kb.length)>=6&&lev(ka,kb)<=(Math.min(ka.length,kb.length)>=9?2:1)&&Math.abs(ka.length-kb.length)<=2)why=t('orthographe proche');
  if(why){const [fr,to,fc,tc]=ca>=cb?[b,a,cb,ca]:[a,b,ca,cb];out.push({from:fr,to,fc,tc,why})}}
 return out.sort((a,b)=>b.fc+b.tc-(a.fc+a.tc))}
export function mergeValues(f,from,to){const L=app.P.filter(p=>p[f]===from);if(!L.length)return 0;const old=L.map(p=>Object.assign({},p));
 /* le code d'une pièce ne change jamais à cause d'une fusion : on le garde tel quel, même si la marque ou la catégorie change d'orthographe */
 L.forEach(p=>{const code=p.code;if(to==='')delete p[f];else p[f]=to;if(code===undefined)delete p.code;else p.code=code});const ids=L.map(p=>p.id),al=JSON.parse(JSON.stringify(app.cfg.alias||{}));al[f]=al[f]||{};al[f][nrm(from)]=to;app.setCfg({alias:al});
 app.renderAll();persist(async()=>{await tx('pieces','readwrite',s=>{L.forEach(p=>s.put(p))});await queueMany(ids,[])});
 app.toast(t('{n} : « {a} » devient {b}',{n:tn(L.length,'fiche','fiches'),a:from,b:to===''?t('vide'):'« '+to+' »'}),()=>{old.forEach(o=>{const i=app.P.findIndex(p=>p.id===o.id);if(i>=0)app.P[i]=o});app.renderAll();persist(async()=>{await tx('pieces','readwrite',s=>{old.forEach(p=>s.put(p))});await queueMany(ids,[])});const a2=JSON.parse(JSON.stringify(app.cfg.alias||{}));if(a2[f])delete a2[f][nrm(from)];app.setCfg({alias:a2})},7000);return L.length}
function openMerge(){let f=LSg('mergeField','marque');
 const draw=()=>{const m=valCounts(f),sg=mergeSuggestions(f),vals=[...m.entries()].sort((a,b)=>b[1]-a[1]);
  $('mg_b').innerHTML=`${sg.length?`<span class="l">${t('Doublons probables')} · ${sg.length}</span>${sg.slice(0,40).map((s,i)=>`<div class="mrg"><div class="mt"><b>${esc(s.from)}</b> <em>${s.fc}</em> <span>→</span> <b>${s.to===''?t('(vide)'):esc(s.to)}</b> <em>${s.tc}</em><small>${esc(s.why)}</small></div><div class="mb"><button type="button" class="btn sm" data-mg="${i}">${t('Fusionner')}</button>${s.to!==''?`<button type="button" class="btn sm sec" data-sw="${i}" aria-label="${t('Inverser le sens')}">⇄</button>`:''}</div></div>`).join('')}`:'<div class="hint">'+t('Aucun doublon évident pour ce champ.')+'</div>'}
   <span class="l" style="margin-top:14px">${t('Fusionner à la main')}</span><div class="pwrow"><select id="mg_a">${vals.map(([v,c])=>`<option value="${esc(v)}">${esc(v)} (${c})</option>`).join('')}</select><select id="mg_t">${vals.map(([v,c])=>`<option value="${esc(v)}">${esc(v)} (${c})</option>`).join('')}${f==='collab'?'<option value="">'+t('(vide)')+'</option>':''}</select></div><input type="text" id="mg_n" placeholder="${t('ou écris la bonne valeur (ex. Brooks Brothers)')}" style="margin-top:8px" autocomplete="off"><div class="hint">${t('Gauche : valeur à remplacer. Droite : valeur à garder, ou la bonne valeur écrite dans le champ.')}</div><div class="acts"><button type="button" class="btn sec" id="mg_go">${t('Fusionner ces deux valeurs')}</button></div>
   <span class="l" style="margin-top:14px">${t('Toutes les valeurs')} · ${vals.length}</span><div class="mvals">${vals.slice(0,80).map(([v,c])=>`<span class="chip sm">${esc(v)} · ${c}</span>`).join('')}</div>
   ${f==='marque'?'':''}`;
  $('mg_b').onclick=e=>{const b=e.target.closest('[data-mg]'),w=e.target.closest('[data-sw]');if(b){const s=sg[+b.dataset.mg];mergeValues(f,s.from,s.to);draw()}if(w){const s=sg[+w.dataset.sw];mergeValues(f,s.to,s.from);draw()}};
  $('mg_go').onclick=()=>{const a=$('mg_a').value,t=$('mg_n').value.trim()||$('mg_t').value;if(a===t)return app.toast(window.t('Choisis deux valeurs différentes'));mergeValues(f,a,t);draw()}};
 showSheet(sheetHead(t('Nettoyer les valeurs'))+`<p class="sub">${t('Les valeurs fusionnées sont retenues : si tu retapes l\'ancienne orthographe, elle est corrigée toute seule.')}</p><div class="chips" id="mg_f" style="margin-bottom:12px">${MFIELDS.map(([k,l])=>`<button type="button" class="chip sm${k===f?' on':''}" data-f2="${k}">${t(l)}</button>`).join('')}</div><div id="mg_b"></div><div id="mg_c"></div>`);
 $('mg_f').onclick=e=>{const b=e.target.closest('[data-f2]');if(!b)return;f=b.dataset.f2;LSs('mergeField',f);$('mg_f').querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===b));draw()};draw();codesBlock()}
function dupCodes(){const m=new Map();app.P.forEach(p=>{if(p.code)(m.get(p.code)||m.set(p.code,[]).get(p.code)).push(p)});return[...m.entries()].filter(e=>e[1].length>1)}
function codesBlock(){const d=dupCodes(),noCode=app.P.filter(p=>!p.code&&p.cat&&p.sub&&p.marque&&p.grade);
 $('mg_c').innerHTML=`<span class="l" style="margin-top:14px">${t('Codes')}</span><div class="card" style="padding:12px 14px;margin:0"><div class="kv" style="grid-template-columns:auto 1fr"><dt>${t('Codes en double')}</dt><dd>${d.length?tn(d.length,'code','codes')+' ('+tn(d.reduce((a,e)=>a+e[1].length,0),'fiche','fiches')+')':t('aucun')}</dd><dt>${t('Fiches sans code, générables')}</dt><dd>${noCode.length}</dd></div><div class="acts two"><button type="button" class="btn sec sm" id="cd_fix"${d.length?'':' disabled'}>${t('Corriger les doublons')}</button><button type="button" class="btn sec sm" id="cd_gen"${noCode.length?'':' disabled'}>${t('Générer les manquants')}</button></div></div>`;
 $('cd_fix').onclick=()=>{const ch=[];const old=[];dupCodes().forEach(([c,l])=>{l.slice(1).forEach(p=>{const keep=p.code;delete p.code;const g=genCode(p);if(g){old.push(Object.assign({},p,{code:keep}));p.code=g;ch.push([p,g])}else p.code=keep})});if(!ch.length)return app.toast(t('Rien à corriger'));bulkSaveIds(ch.map(x=>x[0].id));app.toast(tn(ch.length,'code en double corrigé','codes en double corrigés'),()=>{old.forEach(o=>{const i=app.P.findIndex(p=>p.id===o.id);if(i>=0)app.P[i]=o});bulkSaveIds(old.map(o=>o.id))});codesBlock()};
 $('cd_gen').onclick=()=>{const L=app.P.filter(p=>!p.code&&p.cat&&p.sub&&p.marque&&p.grade),old=L.map(p=>Object.assign({},p));L.forEach(p=>{const g=genCode(p);if(g)p.code=g});bulkSaveIds(L.map(p=>p.id));app.toast(tn(L.length,'code généré','codes générés'),()=>{old.forEach(o=>{const i=app.P.findIndex(p=>p.id===o.id);if(i>=0)app.P[i]=o});bulkSaveIds(old.map(o=>o.id))});codesBlock()}}
function bulkSaveIds(ids){app.renderAll();const L=ids.map(id=>app.P.find(p=>p.id===id)).filter(Boolean);persist(async()=>{await tx('pieces','readwrite',s=>{L.forEach(p=>s.put(p))});await queueMany(ids,[])})}
