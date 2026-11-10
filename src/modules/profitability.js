import { app } from '../state.js';
import { esc, eur } from './core.js';
import { targetDays } from './advice.js';

app.renta = renta;

/* ---------- rentabilité : bénéfice net, ROI et feu tricolore (qui tient compte du délai de vente) ---------- */
const feuL={g:'Rentable',o:'À surveiller',r:'À éviter'};
const feuS={g:'Bonne vente',o:'Vente correcte',r:'Vente à perte'};
const feuLabel=(s,c)=>t((s?feuS:feuL)[c]);
export function renta(achat,prix,frais,delai,sale){const td=targetDays(),net=prix-achat-frais,roi=achat>0?net/achat:null;
 const lent=delai!=null&&delai>td,tres=delai!=null&&delai>2*td,okR=roi===null||roi*100>=app.cfg.roi,okM=net>=app.cfg.minM;let c,why=[];
 if(net<=0){c='r';why.push(t('Aucun bénéfice'))}
 else if(tres&&!sale){c='r';why.push(t('Vente très lente (≈ {n} j)',{n:Math.round(delai)}))}
 else if(roi!==null&&roi<0.4&&net<app.cfg.minM/2){c='r';why.push(t('Marge trop faible'))}
 else if(okR&&okM&&!lent)c='g';
 else{c='o';if(!okM)why.push(t('Marge sous {m}',{m:eur(app.cfg.minM)}));if(!okR)why.push(t('Rendement sous {r} %',{r:app.cfg.roi}));if(lent)why.push(sale?t('Pièce restée {n} j en stock',{n:Math.round(delai)}):t('Délai ≈ {n} j pour {td} j visés',{n:Math.round(delai),td}))}
 return{net,roi,c,why,delai,sale:!!sale,label:feuLabel(sale,c)}}
export const rentaHTML=r=>`<div class="feu f-${r.c}"><i></i><b>${r.label}</b><span>${t('Bénéfice net {l}',{l:eur(r.net)})}${r.roi!==null?' · ROI '+Math.round(r.roi*100)+' %':''}${r.delai!=null?(r.sale?' · '+t('en stock {n} j',{n:Math.round(r.delai)}):' · '+t('vente ≈ {n} j',{n:Math.round(r.delai)})):''}</span></div>${r.why.length?`<div class="hint">${esc(r.why.join(' · '))}</div>`:''}`;
app.rentaHTML = rentaHTML;
