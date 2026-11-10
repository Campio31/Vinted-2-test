import { app } from '../state.js';
import { $, avail, esc, sold, title, today } from './core.js';
import { go } from './nav.js';
import { sellOpen } from './sell-card.js';
import { openTools, sheetHead, showSheet } from './tools-index.js';
import { openVoice } from './voice.js';
import { missingFields, openComplete } from './complete.js';
import { codeClash } from './checks.js';

app.openHelp = openHelp;
app.incBanner = incBanner;

/* ===== 6. Raccourcis clavier et glisser ===== */
export function markPublished(p){if(!p||sold(p)||p.pub===today())return;const old=Object.assign({},p);app.save(Object.assign({},p,{pub:today()}));app.toast(t('Publié aujourd\'hui · {t}',{t:title(p)}),()=>app.save(old),5000)}
/* Les raccourcis sont une section du Centre d'aide (Outils, Aide et raccourcis) */
function shortcutsHTML(){const K=[['N','Ajouter une pièce'],['S','Stock'],['L','Live'],['B','Bilan'],['R','Réglages'],['/','Chercher dans le stock'],['O','Outils'],['M','Commande vocale'],['C','Compléter des fiches'],['?','Cette aide']],T=[['V','Vendre la carte survolée ou sélectionnée'],['P','La marquer publiée'],['↵','Ouvrir sa fiche'],['Esc','Fermer']];
 return`<span class="l">${t('sur ordinateur')}</span>${K.map(k=>`<div class="kr"><kbd>${k[0]}</kbd><span>${t(k[1])}</span></div>`).join('')}<span class="l" style="margin-top:12px">${t('sur une carte du stock')}</span>${T.map(k=>`<div class="kr"><kbd>${k[0]}</kbd><span>${t(k[1])}</span></div>`).join('')}<span class="l" style="margin-top:12px">${t('sur téléphone')}</span><div class="kr"><kbd>→</kbd><span>${t('Glisser une carte vers la droite : vendu')}</span></div><div class="kr"><kbd>←</kbd><span>${t('Glisser une carte vers la gauche : publié aujourd\'hui')}</span></div>`}
app.shortcutsHTML=shortcutsHTML;
function openHelp(){app.openAide()}
let hoverId=null;
const idOf=el=>{const t=el&&el.closest&&el.closest('.tl,.qrow');const d=t&&t.querySelector('[data-id]');return d?d.dataset.id:null};
$('lst').addEventListener('mouseover',e=>{hoverId=idOf(e.target)});$('lst').addEventListener('mouseleave',()=>{hoverId=null});
function sellFromCard(id){sellOpen(id);if(app.view==='list')app.renderList();const i=$('qp');if(i){i.scrollIntoView({block:'center'});i.focus();i.select()}}
document.addEventListener('keydown',e=>{
 const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable)||e.ctrlKey||e.metaKey||e.altKey)return;
 if(!$('auth').hidden||!$('scan').hidden)return;const k=e.key,lk=k.length===1?k.toLowerCase():k,sheetOpen=!$('sheet').hidden;
 if(sheetOpen)return;
 const go1={n:'add',s:'list',l:'quick',b:'dash',r:'set'}[lk];if(go1){e.preventDefault();go(go1);return}
 if(k==='/'){e.preventDefault();go('list');setTimeout(()=>$('q').focus(),30);return}
 if(lk==='o'){e.preventDefault();openTools();return}if(lk==='m'){e.preventDefault();openVoice();return}if(lk==='c'){e.preventDefault();openComplete();return}if(k==='?'){e.preventDefault();openHelp();return}
 if(app.view==='list'){const id=idOf(document.activeElement)||hoverId;if(!id)return;const p=app.P.find(x=>x.id===id);if(!p)return;
  if(lk==='v'&&avail(p)){e.preventDefault();sellFromCard(id)}else if(lk==='p'){e.preventDefault();markPublished(p)}else if(k==='Enter'&&!/BUTTON/.test(t.tagName)){e.preventDefault();app.openSheet(id)}}});
/* glisser une carte : droite = vendu, gauche = publié */
(function(){let st=null;const box=$('lst');
 box.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||e.target.closest('input,select,textarea,.qform'))return;const c=e.target.closest('.tl,.qrow');if(!c||c.classList.contains('open'))return;st={c,x:e.clientX,y:e.clientY,dx:0,on:false}});
 box.addEventListener('pointermove',e=>{if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;if(!st.on){if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.6){st.on=true;try{box.setPointerCapture(e.pointerId)}catch(x){}}else if(Math.abs(dy)>14){st=null;return}else return}
  st.dx=dx;st.c.style.transform=`translateX(${Math.max(-140,Math.min(140,dx))}px)`;st.c.style.transition='none';st.c.classList.toggle('swr',dx>70);st.c.classList.toggle('swl',dx<-70)});
 const end=()=>{if(!st)return;const{c,dx,on}=st;st=null;c.style.transition='transform .2s';c.style.transform='';c.classList.remove('swr','swl');if(!on)return;const id=idOf(c),p=app.P.find(x=>x.id===id);if(!p)return;c.dataset.sw='1';setTimeout(()=>delete c.dataset.sw,400);
  if(dx>=90&&avail(p))sellFromCard(id);else if(dx<=-90)markPublished(p)};
 box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
 box.addEventListener('click',e=>{const c=e.target.closest('.tl,.qrow');if(c&&c.dataset.sw){e.stopImmediatePropagation();e.preventDefault()}},true)})();

function incBanner(p){const LB={cat:'catégorie',sub:'type',marque:'marque',grade:'grade',etat:'état'},m=missingFields(p).map(k=>t(LB[k])),w=[];if(m.length)w.push(t('Il manque : {m}.',{m:m.join(', ')}));if(!p.code&&!m.length)w.push(t('Pas de code : il se génère à l\'enregistrement.'));const c=codeClash(p.code,p.id);if(c)w.push(t('Le code {c} est aussi utilisé par {p}.',{c:p.code,p:title(c)}));return w.length?`<div class="cl cl-o"><i></i><div><b>${t('Fiche à compléter')}</b><span>${esc(w.join(' '))}</span></div></div>`:''}
