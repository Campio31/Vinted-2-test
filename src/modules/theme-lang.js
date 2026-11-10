import { app } from '../state.js';
import { $, LSg, LSs, fmtInit } from './core.js';
import { TITLES } from './nav.js';
import { closeSheet } from './piece-sheet.js';
import { renderSet } from './export-import.js';
import { refreshStatus } from './sync.js';

app.renderTheme = renderTheme;
app.renderLang = renderLang;

/* ---------- apparence : clair par défaut, sombre en option ---------- */
const THEMES=[['light','Clair'],['dark','Sombre'],['auto','Automatique']];
function applyTheme(t){document.documentElement.dataset.theme=t;const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=(t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme:dark)').matches))?'#0E0F11':'#F1F2F4'}
function renderTheme(){const th=LSg('theme','light');$('thc').innerHTML=`<h3>${t('Apparence')}</h3><p class="sub">${t('Le mode clair est utilisé par défaut. Choisis le mode sombre, ou laisse l\'appli suivre le réglage de ton téléphone. Ce choix est propre à cet appareil.')}</p><div class="chips">${THEMES.map(([k,l])=>`<button type="button" class="chip${th===k?' on':''}" data-th="${k}">${t(l)}</button>`).join('')}</div>`}
/* ---------- langue (propre à l'appareil, enregistrée dans cfg) ---------- */
const STATIC_SKIP='#acc,#abo,#kp,#fadd,#gq,#lh,#lc,#lcur,#lcol,#flt,#lst,#per,#dsh,#sy,#lgc,#thc,#cfgc,#cptc,#rlc,#cfc,#hlp,#bkc,#exc,#shc,#toast,#sync,#ttl,#au_msg,#au_msg2,#xs,#is,#insth,#phs,#scan_s,#au_eye';
/* textes fixes du HTML : traduits sur place, le français d'origine est gardé pour pouvoir changer de langue sans recharger */
function applyStatic(){const skip=[...document.querySelectorAll(STATIC_SKIP)],inSkip=n=>skip.some(s=>s.contains(n));
 const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];
 while(w.nextNode()){const n=w.currentNode;if(!n.nodeValue.trim()||n.parentNode.closest('script,style,svg')||inSkip(n))continue;nodes.push(n)}
 nodes.forEach(n=>{if(n._fr==null)n._fr=n.nodeValue;const m=n._fr.match(/^(\s*)([\s\S]*?)(\s*)$/);n.nodeValue=m[1]+t(m[2])+m[3]});
 document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el=>{if(inSkip(el))return;['placeholder','aria-label','title'].forEach(a=>{if(el.hasAttribute(a)){if(el['_fr_'+a]==null)el['_fr_'+a]=el.getAttribute(a);el.setAttribute(a,t(el['_fr_'+a]))}})})}
function renderLang(){$('lgc').innerHTML=`<h3>${t('Langue')}</h3><p class="sub">${t('Langue de l\'appli, des dates, des nombres et des annonces. Ce choix est propre à cet appareil.')}</p><div class="chips">${I18N.LANGS.map(([k,l])=>`<button type="button" class="chip${app.LANG===k?' on':''}" data-lg="${k}" lang="${k}">${l}</button>`).join('')}</div>`}
function setLang(l){if(!I18N.LOCS[l]||l===app.LANG)return;app.LANG=l;micOk();app.setCfg({lang:l},true);fmtInit();applyStatic();$('au_eye').textContent=t($('au_pw').type==='password'?'Afficher':'Masquer');closeSheet();$('ttl').textContent=t(TITLES[app.view]);refreshStatus();app.addForm.draw();app.renderAll();if(app.view==='set')renderSet()}
$('lgc').addEventListener('click',e=>{const b=e.target.closest('[data-lg]');if(b)setLang(b.dataset.lg)});
const micOk=()=>{$('mic').hidden=app.LANG!=='fr'};/* la commande vocale ne comprend que le français */
micOk();if(app.LANG!=='fr'){applyStatic();$('au_eye').textContent=t('Afficher')}
$('thc').addEventListener('click',e=>{const b=e.target.closest('[data-th]');if(!b)return;LSs('theme',b.dataset.th);applyTheme(b.dataset.th);renderTheme()});
applyTheme(LSg('theme','light'));
