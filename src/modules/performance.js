import { app } from '../state.js';
import { $, LSg, LSs, today } from './core.js';
import { tx } from './storage.js';
import { phBlob, phURL } from './photos.js';
import { cloud, queueMany } from './sync.js';
import { compressBlob } from './photo-compress.js';
import { scheduleDefis } from './challenges.js';

/* --- 10. performances : défilement par morceaux, recherche allégée, photos allégées automatiquement --- */
let moreObs=null;
function obsMore(){if(moreObs)moreObs.disconnect();const m=$('more');if(!m||!('IntersectionObserver' in window))return;moreObs=new IntersectionObserver(es=>{if(es[0].isIntersecting){moreObs.disconnect();app.lim+=60;app.renderList()}},{rootMargin:'700px'});moreObs.observe(m)}
const renderList0=app.renderList;app.renderList=function(){renderList0();obsMore()};
let scT=null;window.addEventListener('scroll',()=>{if(scT||app.view!=='list')return;scT=setTimeout(()=>{scT=null;const m=$('more');if(m&&m.getBoundingClientRect().top<innerHeight+700){app.lim+=60;app.renderList()}},120)},{passive:true});
$('q').oninput=(()=>{let t;return()=>{clearTimeout(t);t=setTimeout(()=>{app.lim=60;app.renderList()},160)}})();
const renderAll0=app.renderAll;app.renderAll=function(){renderAll0();scheduleDefis()};

/* Les nouvelles photos sont réduites à l'ajout (900 px, JPEG). Celles qui existaient déjà le sont ici, en tâche de fond,
   quelques-unes à la fois. Une photo qui ne peut pas être allégée n'est tentée qu'une fois (phTried). */
export const HEAVY=130000;
export async function heavyPhotoIds(){const tried=new Set(LSg('phTried',[]));const recs=(await tx('photos','readonly',s=>s.getAll()))||[];return recs.filter(r=>r.blob&&!(r.blob.type||'').startsWith('video')&&r.blob.size>HEAVY&&!tried.has(r.id)).map(r=>r.id)}
export async function autoCompress(max){const ids=await heavyPhotoIds(),batch=ids.slice(0,max||25),changed=[],tried=LSg('phTried',[]);
 for(const id of batch){tried.push(id);try{const b=await phBlob(id);if(!b||b.size<=HEAVY)continue;const nb=await compressBlob(b);if(nb.size<b.size*.9){await tx('photos','readwrite',st=>st.put({id,blob:nb}));const u=phURL.get(id);if(u){URL.revokeObjectURL(u);phURL.delete(id)}changed.push(id)}}catch(e){}}
 LSs('phTried',tried.slice(-3000));if(changed.length)await queueMany([],changed);
 return{changed:changed.length,left:ids.length-batch.length}}
export function startAutoCompress(){const run=async()=>{let r;try{r=await autoCompress(25)}catch(e){return}if(r.left>0)setTimeout(run,4000)};setTimeout(run,10000)}
export async function checkSpace(){if(!cloud||LSg('spaceDay','')===today())return;LSs('spaceDay',today());try{const recs=(await tx('photos','readonly',s=>s.getAll()))||[];const b=recs.reduce((a,r)=>a+(r.blob&&!(r.blob.type||'').startsWith('video')?r.blob.size:0),0);if(b/(1024*1048576)>=.7)app.toast(t('Espace photos à {p} % du Go gratuit. Max allège tes photos automatiquement ; pense à une formule payante si ça continue.',{p:Math.round(b/(1024*1048576)*100)}),null,6000)}catch(e){}}
