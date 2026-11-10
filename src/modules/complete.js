import { app } from '../state.js';
import { $, avail, esc, eur, fd, pad, title } from './core.js';
import { hydrate, phImg } from './photos.js';
import { CATS0, ETAT0, GEN, GRADES, SUBS0, combo, freq, genCode, mrg, recentBrands, sizesFor, subsOf } from './form.js';
import { catSvg } from './stock-view.js';
import { sheetHead, showSheet } from './tools-index.js';
import { scheduleBadges } from './gamification.js';
import { canonVal } from './dedupe.js';

app.openComplete = openComplete;

/* ===== 4. Fiches à compléter ===== */
const NEED=['cat','sub','marque','grade','etat'];
/* une pièce dont la marque est « Non identifié » n'est jamais à compléter : on a déjà cherché, il n'y a rien de plus à trouver */
export const nonIdent=p=>/^non (identifi|renseign)/i.test(String(p.marque||'').trim());
export function missingFields(p){return NEED.filter(k=>!p[k])}
export const incomplete=p=>!nonIdent(p)&&(missingFields(p).length>0||(!p.code&&!!(p.cat&&p.sub&&p.marque&&p.grade)));
app.incomplete = incomplete;
const incList=()=>app.P.filter(incomplete).sort((a,b)=>(avail(b)-avail(a))||(missingFields(b).length-missingFields(a).length));
const LAB0={cat:'Catégorie',sub:'Type',marque:'Marque',grade:'Grade',etat:'État'};
/* de quoi reconnaître la pièce : photo, marque, modèle, taille, couleur, matière, bac, date d'entrée, prix d'achat, note */
export function infoRows(p){const R=[[t('Marque'),p.marque],[t('Modèle'),p.modele],[t('Taille'),p.taille],[t('Genre'),p.genre&&tv(p.genre)],[t('Catégorie'),[p.cat&&tv(p.cat),p.sub&&tv(p.sub)].filter(Boolean).join(' · ')],[t('Couleur'),(p.coul||[]).map(tv).join(', ')],[t('Matière'),(p.mat||[]).map(tv).join(', ')],[t('Bac'),p.bac],[t('Entrée'),p.entree&&fd(p.entree)],[t('Prix d\'achat'),p.achat!=null&&p.achat!==''?eur(p.achat):''],[t('Provenance'),p.prov&&tv(p.prov)],[t('Note'),p.note]];return R.filter(r=>r[1])}
export function openComplete(){const L0=incList(),noGrade=app.P.filter(p=>!p.grade&&!nonIdent(p)).length,noEtat=app.P.filter(p=>!p.etat&&!nonIdent(p)).length,noCode=app.P.filter(p=>!p.code&&!nonIdent(p)).length;
 if(!L0.length)return showSheet(sheetHead(t('Fiches à compléter'))+'<div class="empty">'+t('Toutes tes fiches sont complètes.')+'</div>');
 showSheet(sheetHead(t('Fiches à compléter'))+`<div class="card"><div class="kv" style="grid-template-columns:auto 1fr;margin-bottom:12px"><dt>${t('Fiches à compléter')}</dt><dd><b>${L0.length}</b></dd><dt>${t('Sans grade')}</dt><dd>${noGrade}</dd><dt>${t('Sans état')}</dt><dd>${noEtat}</dd><dt>${t('Sans code')}</dt><dd>${noCode}</dd></div><p class="sub">${t('Le mode « 10 fiches en 2 minutes » enchaîne uniquement les champs qui manquent. Le code se génère tout seul dès que c\'est possible. Les pièces de marque « Non identifié » ne sont pas demandées.')}</p><div class="acts"><button type="button" class="btn mint" id="cp_go">${t('Compléter 10 fiches')}</button></div></div>
  <div class="cpl">${L0.slice(0,30).map(p=>`<button type="button" class="li cpi" data-cpone="${esc(p.id)}">${p.photo?phImg(p.photo,'th'):`<div class="th">${catSvg(p)}</div>`}<div class="m"><b>${esc(title(p))}</b><small class="cpcode">${p.code?esc(p.code):t('Sans code')}</small><small>${esc([p.taille,(p.coul||[]).map(tv).join('/'),p.bac&&t('Bac {b}',{b:p.bac}),p.entree&&fd(p.entree)].filter(Boolean).join(' · '))}</small><small class="cpm2">${missingFields(p).map(k=>`<span class="tag x">${t(LAB0[k])}</span>`).join(' ')||'<span class="tag">'+t('Sans code')+'</span>'}</small></div></button>`).join('')}${L0.length>30?`<div class="hint">${t('{n} autres fiches : elles viennent ensuite.',{n:L0.length-30})}</div>`:''}</div>`);hydrate();
 $('cp_go').onclick=()=>runComplete();
 $('shc').onclick=e=>{const b=e.target.closest('[data-cpone]');if(b)runComplete([b.dataset.cpone])}}
function runComplete(ids){const queue=ids?ids.map(id=>({id})):incList().slice(0,10),total=queue.length;let i=0,done=0,t0=Date.now(),timer=null;
 const fmt=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+':'+pad(s%60,2)};
 const finish=()=>{clearInterval(timer);const left=incList().length;showSheet(sheetHead(t('Bravo'))+`<div class="card" style="text-align:center"><div class="cd" style="font-size:64px">${done}</div><p class="sub">${t(done>1?'fiches complétées en {d}':'fiche complétée en {d}',{d:fmt(Date.now()-t0)})}</p><p>${left?t(left>1?'Il reste {n} fiches à compléter.':'Il reste {n} fiche à compléter.',{n:left}):t('Toutes tes fiches sont complètes.')}</p><div class="acts">${left?'<button type="button" class="btn mint" id="cp_again">'+t('10 de plus')+'</button>':''}<button type="button" class="btn sec" data-x="1">${t('Fermer')}</button></div></div>`);if($('cp_again'))$('cp_again').onclick=runComplete;scheduleBadges()};
 const OPT={cat:()=>mrg(CATS0,freq('cat')),sub:p=>mrg(SUBS0[p.cat]||[],subsOf(p.cat||'')),marque:()=>recentBrands(),taille:p=>sizesFor(p.cat),genre:()=>GEN,grade:()=>GRADES,etat:()=>ETAT0},LAB={cat:'Catégorie',sub:'Type',marque:'Marque',taille:'Taille',genre:'Genre',grade:'Grade',etat:'État'};
 const show=()=>{if(i>=queue.length)return finish();const p=app.P.find(x=>x.id===queue[i].id);if(!p){i++;return show()}const miss=missingFields(p);
  if(!miss.length){if(!p.code){const g=genCode(p);if(g)app.save(Object.assign({},p,{code:g}))}done++;i++;return show()}
  showSheet(sheetHead(t('Fiche {a} sur {b}',{a:i+1,b:total}))+`<div class="pg" style="margin-bottom:6px">${queue.map((_,k)=>`<i class="${k<i?'f':k===i?'c':''}"></i>`).join('')}</div><div class="hint" style="margin:0 0 10px"><span id="cp_t">${fmt(Date.now()-t0)}</span> · ${t(done>1?'{n} complétées':'{n} complétée',{n:done})}</div>
   <div class="card"><div class="cpf">${p.photo?phImg(p.photo,'cpph'):`<div class="cpph">${catSvg(p)}</div>`}<div class="m"><b>${esc(title(p))}</b><small class="cpcode">${p.code?esc(p.code):t('Sans code')}</small></div></div><dl class="kv cpd">${infoRows(p).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl>
   ${miss.map(k=>`<span class="l" style="margin-top:12px">${t(LAB[k])}</span><div class="chips">${(OPT[k](p)||[]).slice(0,k==='marque'?18:30).map(v=>`<button type="button" class="chip sm${k==='grade'?' g-'+v:''}" data-cf="${k}" data-v="${esc(v)}">${esc(tv(v))}</button>`).join('')}</div>${k==='marque'?'<input type="text" class="cpm" placeholder="'+t('Autre marque')+'" style="margin-top:8px" autocomplete="off" autocorrect="off" data-lpignore="true" data-1p-ignore data-form-type="other">':''}`).join('')}
   <div class="acts two"><button type="button" class="btn sec" id="cp_skip">${t('Passer')}</button><button type="button" class="btn sec" id="cp_stop">${t('Terminer')}</button></div></div>`);
  hydrate();$('shc').onclick=e=>{const b=e.target.closest('[data-cf]');if(!b)return;const k=b.dataset.cf,v=b.dataset.v;apply(p.id,k,v)};
  const mi=$('shc').querySelector('.cpm');if(mi)mi.onkeydown=e=>{if(e.key==='Enter'&&mi.value.trim()){e.preventDefault();apply(p.id,'marque',canonVal('marque',mi.value.trim()))}};
  $('cp_skip').onclick=()=>{i++;show()};$('cp_stop').onclick=finish;
  clearInterval(timer);timer=setInterval(()=>{const e=$('cp_t');if(e)e.textContent=fmt(Date.now()-t0);else clearInterval(timer)},1000)};
 const apply=(id,k,v)=>{const p=app.P.find(x=>x.id===id);if(!p)return;const q=Object.assign({},p);q[k]=v;if(k==='cat')delete q.sub;if(!q.code||combo(q)!==combo(p)){const g=genCode(q);if(g)q.code=g}app.save(q);const left=missingFields(q);if(!left.length){done++;i++;setTimeout(show,250)}else show()};
 show()}
