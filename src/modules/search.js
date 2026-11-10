import { app } from '../state.js';
import { lev } from './form.js';
import { STAT } from './stock-view.js';
import { nrm } from './advice.js';

app.searchToks = searchToks;
app.searchScore = searchScore;

/* --- recherche tolérante : plusieurs mots, accents, pluriels, petites fautes --- */
export const fold=s=>nrm(s).replace(/[^a-z0-9]+/g,' ').trim();
export function searchToks(q){let t=fold(q).split(' ').filter(Boolean).map(w=>w.length>3&&/[sx]$/.test(w)?w.slice(0,-1):w);if(t.length>1)t=t.filter(w=>w.length>1);return t}
export function searchScore(p,toks){const h=' '+fold([p.marque,p.cat,p.sub,p.modele,p.taille,p.genre,p.grade,p.etat,(p.defauts||[]).join(' '),p.collab,p.madein,p.ballot,p.bac,p.prov,p.canal,p.acheteur,p.note,p.code,p.id,(p.coul||[]).join(' '),(p.mat||[]).join(' '),STAT[p.statut]||''].filter(Boolean).join(' '))+' ',
 st=' '+fold([p.marque,p.cat,p.sub,p.modele].filter(Boolean).join(' '))+' ';let sc=0,ws=null;
 for(const t of toks){let s=0;const w=' '+t;
  if(h.includes(w))s=st.includes(w)?3:2;else if(t.length>=4&&h.includes(t))s=1;
  else if(t.length>=5){ws=ws||h.split(' ');if(ws.some(x=>x.length>=4&&Math.abs(x.length-t.length)<=1&&lev(x,t)<=1))s=.5}
  if(!s)return-1;sc+=s}
 return sc}
