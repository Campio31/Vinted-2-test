import { app } from '../state.js';
import { avail, isnum, sold } from './core.js';
import { advice, delai, med, nrm, targetDays } from './advice.js';

app.potential = potential;
app.estDelai = estDelai;

/* potentiel de vente : trois lectures de tes ventes passées (la combinaison exacte marque + catégorie, la marque seule, la catégorie seule) et le stock déjà présent.
   « Fiable » seulement si la combinaison exacte a au moins 3 ventes. Sinon l'estimation est indicative et retient le délai le plus lent des lectures disponibles. */
function potential(p){
 if(!p.cat)return{ok:false,cat:false};
 const mk=l=>{const d=l.map(delai).filter(v=>v!==null);return{n:l.length,dm:d.length?med(d):null,pm:l.length?med(l.map(x=>x.pv)):null}};
 const S=app.P.filter(x=>sold(x)&&isnum(x.pv)&&x.pv>0&&x.id!==p.id),mq=nrm(p.marque);
 const inCat=S.filter(x=>x.cat===p.cat),E=mq?mk(inCat.filter(x=>nrm(x.marque)===mq)):null,B=mq?mk(S.filter(x=>nrm(x.marque)===mq)):null,C=mk(inCat);
 const stock=app.P.filter(x=>avail(x)&&x.cat===p.cat&&(!mq||nrm(x.marque)===mq)&&(!p.taille||x.taille===p.taille)).length;
 const td=targetDays(),lv=d=>d===null?'o':d<=td?'g':d<=2*td?'o':'r';
 let basis,dm,sn=0;
 if(mq&&E.n>=3){basis='exact';dm=E.dm}
 else{const sig=(mq?[B,C]:[C]).filter(s=>s.n>=3&&s.dm!==null);if(!sig.length)return{ok:false,cat:true,E,B,C,stock};basis=mq?'indic':'cat';dm=Math.max(...sig.map(s=>s.dm));sn=sig.length}
 /* sans vente de la combinaison exacte, « fort » n'est affiché que si la marque ET la catégorie le confirment chacune sur au moins 3 ventes */
 let l=lv(dm);if(basis!=='exact'&&l==='g'&&!(basis==='indic'&&sn===2))l='o';
 return{ok:true,cat:true,basis,E,B,C,stock,dm,lvl:l}}
export function estDelai(p,prix,a){a=a||advice(p);if(!a.ok)return null;let best=null;a.tiers.forEach(t=>{if(t.delai===null)return;if(!best||Math.abs(t.price-prix)<Math.abs(best.price-prix))best=t});return best?best.delai:null}
