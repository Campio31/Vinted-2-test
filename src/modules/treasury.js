import { app } from '../state.js';
import { $, addDays, esc, eur, eurR, fd, num, ok, sold, today } from './core.js';
import { med } from './advice.js';
import { CFG0, fN } from './settings-core.js';
import { bigEur } from './goals.js';
import { sheetHead, showSheet } from './tools-index.js';
import { ballotsData } from './ballots-calendar.js';

app.tresoCardHTML = tresoCardHTML;
app.openTreso = openTreso;

/* --- trésorerie : calculée toute seule dans le Bilan --- */
/* Sans solde de départ, Max part de ton premier achat : ce que ton activité a généré (ventes encaissées, moins achats et dépenses).
   Si tu indiques ton solde réel, le calcul repart de ce solde. */
/* ballots achetés à la main : le coût sort de la trésorerie à sa date (à supprimer une fois les pièces ajoutées au stock, elles comptent alors par leur prix d'achat) */
Object.assign(CFG0,{ballotsBought:[]});
const bbList=()=>Array.isArray(app.cfg.ballotsBought)?app.cfg.ballotsBought:[];
function medBallot(){const L=ballotsData().map(b=>b.cost);return L.length?Math.round(med(L)):0}
const noCash=()=>app.cfg.cash===null||app.cfg.cash===undefined||app.cfg.cash==='';
function firstDate(){return[...app.P.map(p=>p.entree),...app.DEP.map(d=>d.date)].filter(ok).sort()[0]||''}
function tresoCalc(){const auto=noCash();let d0,cash;
 if(auto){const f=firstDate();if(!f)return null;d0=addDays(f,-1);cash=0}else{d0=ok(app.cfg.cashDate)?app.cfg.cashDate:today();cash=+app.cfg.cash}
 const t=today(),W=30,from=addDays(t,-W),net=p=>(p.pv||0)-(p.frais||0),sum=(l,f)=>l.reduce((a,x)=>a+f(x),0);
 const S=app.P.filter(p=>sold(p)&&ok(p.dv)),since=sum(S.filter(p=>p.dv>d0),net),buy=sum(app.P.filter(p=>ok(p.entree)&&p.entree>d0),p=>p.achat||0),dep=sum(app.DEP.filter(d=>ok(d.date)&&d.date>d0),d=>d.montant||0),bb=sum(bbList().filter(b=>!ok(b.d)||b.d>d0),b=>+b.v||0),now=cash+since-buy-dep-bb;
 const inR=sum(S.filter(p=>p.dv>from),net)/W,outR=sum(app.P.filter(p=>ok(p.entree)&&p.entree>from&&!p.ballot),p=>p.achat||0)/W,depR=sum(app.DEP.filter(d=>ok(d.date)&&d.date>from),d=>d.montant||0)/W,rate=inR-outR-depR,bud=+app.cfg.ballotBudget||medBallot();
 return{auto,cash,now,inR,outR,depR,rate,bud,d0,at:h=>now+rate*h,when:()=>now>=bud?0:rate>0?Math.ceil((bud-now)/rate):null}}
export const tresoData=tresoCalc;
function tresoCardHTML(){const c=tresoCalc(),lb=` data-lb="${esc(t('Trésorerie'))}"`;
 if(!c)return`<button type="button" class="card minic" data-tool="treso"${lb}><span class="l">${t('trésorerie')}</span><b>—</b><span class="mini-s">${t('Elle se calcule dès ta première pièce')}</span></button>`;
 const w=c.when(),bl=c.bud?(w===0?t('Tu as déjà de quoi racheter un ballot ({p})',{p:eurR(c.bud)}):w===null?t('À ce rythme, pas de quoi racheter un ballot'):t('Ballot de {p} possible vers le {d}',{p:eurR(c.bud),d:fd(addDays(today(),w))})):'';
 return`<button type="button" class="card minic" data-tool="treso"${lb}><span class="l">${t(c.auto?'trésorerie estimée':'trésorerie')}</span><b>${eurR(c.now)} <small>${t('dans 15 jours : {p}',{p:eurR(c.at(15))})}</small></b><span class="mini-s">${[bl,c.auto?t('touche pour indiquer ton solde réel'):''].filter(Boolean).join(' · ')}</span></button>`}
function openTreso(){const c=tresoCalc(),t0=today();
 if(!c){showSheet(sheetHead(t('Trésorerie'))+`<div class="card"><p class="sub">${t('La trésorerie se calcule toute seule dès que tu as ajouté une pièce.')}</p></div>`);return}
 const w=c.when(),pts=[];for(let h=0;h<=45;h++)pts.push(c.at(h));const mn=Math.min(0,...pts,c.bud?0:0),mx=Math.max(...pts,c.bud||0,1),X=h=>10+h/45*300,Y=v=>110-(v-mn)/(mx-mn||1)*100;
 showSheet(sheetHead(t('Trésorerie'))+`<div class="gcard"><div class="gh2"><span>${t(c.auto?'Argent généré par ton activité':'Argent disponible estimé')}</span></div><div class="gbig cd">${bigEur(c.now)}</div><div class="gl2">${c.auto?t('Ventes encaissées, moins achats et dépenses, depuis le {d}. Indique ton solde réel plus bas pour partir de ton vrai compte.',{d:fd(addDays(c.d0,1))}):t('Solde de départ {p} au {d}, plus les ventes, moins achats et dépenses depuis.',{p:eur(c.cash),d:fd(c.d0)})}</div></div>
  <div class="card"><h3>${t('Au rythme actuel')}</h3><div class="kpis two" style="margin-bottom:10px"><div class="kpi${c.at(15)>=0?'':' neg'}"><b>${eurR(c.at(15))}</b><span>${t('le {d}',{d:fd(addDays(t0,15))})}</span></div><div class="kpi${c.at(30)>=0?'':' neg'}"><b>${eurR(c.at(30))}</b><span>${t('le {d}',{d:fd(addDays(t0,30))})}</span></div></div>
  <svg viewBox="0 0 320 120" class="hist2" role="img" aria-label="${t('Prévision sur 45 jours')}"><path d="M10 ${Y(0).toFixed(1)}H310" stroke="var(--line)" stroke-width="1"/>${c.bud?`<path d="M10 ${Y(c.bud).toFixed(1)}H310" stroke="var(--acc)" stroke-width="1.5" stroke-dasharray="4 4"/>`:''}<polyline fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((v,h)=>X(h).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}"/></svg>
  <div class="cl cl-${c.bud&&w!==null?(w===0?'g':'o'):'o'}" style="margin-top:8px"><i></i><div><b>${c.bud?(w===0?t('Tu peux racheter un ballot dès maintenant'):w===null?t('À ce rythme, tu ne pourras pas racheter de ballot'):t('De quoi racheter un ballot de {p} le {d}',{p:eurR(c.bud),d:fd(addDays(t0,w))})):t('Fixe le prix d\'un ballot ci-dessous')}</b><span>${c.bud?t('Ligne orange : {p}',{p:eurR(c.bud)})+(+app.cfg.ballotBudget?'':' '+t('(prix médian de tes ballots)')):''}</span></div></div></div>
  <div class="card"><h3>${t('Hypothèses, 30 derniers jours')}</h3><div class="kv" style="grid-template-columns:auto 1fr"><dt>${t('Ventes encaissées par jour')}</dt><dd>+${eur(c.inR)}</dd><dt>${t('Achats hors ballot par jour')}</dt><dd>−${eur(c.outR)}</dd><dt>${t('Dépenses par jour')}</dt><dd>−${eur(c.depR)}</dd><dt>${t('Solde net par jour')}</dt><dd><b>${c.rate>=0?'+':'−'}${eur(Math.abs(c.rate))}</b></dd></div><div class="hint">${t('C\'est une projection, pas une promesse : elle suppose que ton rythme des 30 derniers jours continue. Le prix d\'un nouveau ballot n\'est pas compté.')}</div></div>
  <div class="card"><h3>${t('Ballots achetés')}</h3><p class="sub">${t('Note ici le prix d\'un ballot payé : il sort de ta trésorerie à sa date. Supprime la ligne quand tu ajoutes les pièces au stock, elles comptent alors par leur prix d\'achat.')}</p>
   <div class="fxl">${bbList().map((b,i)=>`<div class="fxr"><span>${esc(b.n||t('Ballot'))}<small>${ok(b.d)?fd(b.d):''}</small></span><b>${eur(b.v)}</b><button type="button" class="chip sm" data-bbd="${i}" aria-label="${t('Supprimer')}">✕</button></div>`).join('')}</div>
   <div class="row2" style="margin-top:8px"><input type="text" id="bb_n" placeholder="${t('Nom du ballot')}" autocomplete="off"><div class="price"><input type="text" inputmode="decimal" id="bb_v" placeholder="0"><span>€</span></div></div>
   <div class="row2 fld"><div><label class="l" for="bb_d">${t('Date d\'achat')}</label><input type="date" id="bb_d" value="${t0}"></div><div style="align-self:end"><button type="button" class="btn sm sec" id="bb_add">${t('Ajouter le ballot')}</button></div></div></div>
  <div class="card"><h3>${t('Réglages')}</h3><div class="row2 fld"><div><label class="l" for="tr_c">${t('Solde aujourd\'hui (€)')}</label><input type="text" inputmode="decimal" id="tr_c" value="${c.auto?'':esc(fN(c.now))}" placeholder="${esc(fN(c.now))}"></div><div><label class="l" for="tr_b">${t('Prix d\'un ballot (€)')}</label><input type="text" inputmode="decimal" id="tr_b" value="${esc(+app.cfg.ballotBudget?fN(+app.cfg.ballotBudget):'')}" placeholder="${c.bud||'0'}"></div></div><div class="acts"><button type="button" class="btn sec" id="tr_up">${t('Enregistrer')}</button>${c.auto?'':`<button type="button" class="btn sec" id="tr_auto">${t('Revenir au calcul automatique')}</button>`}</div></div>`);
 $('bb_add').onclick=()=>{const n=$('bb_n').value.trim(),v=num($('bb_v').value),d=$('bb_d').value||t0;if(isNaN(v)||v<=0)return app.toast(t('Indique le prix du ballot'));app.setCfg({ballotsBought:[...bbList(),{n,v,d}]});app.toast(t('Ballot ajouté'));openTreso();app.renderAll()};
 $('shc').onclick=e=>{const x=e.target.closest('[data-bbd]');if(x){app.setCfg({ballotsBought:bbList().filter((b,i)=>i!==+x.dataset.bbd)});openTreso();app.renderAll()}};
 $('tr_up').onclick=()=>{const raw=$('tr_c').value.trim(),v=num(raw),b=num($('tr_b').value),p={ballotBudget:isNaN(b)||b<0?0:b};if(raw!==''){if(isNaN(v))return app.toast(t('Indique ton solde'));p.cash=v;p.cashDate=today()}else if(!c.auto)return app.toast(t('Indique ton solde'));app.setCfg(p);app.toast(t('Enregistré'));openTreso();app.renderAll()};
 if($('tr_auto'))$('tr_auto').onclick=()=>{app.setCfg({cash:null,cashDate:''});app.toast(t('Calcul automatique'));openTreso();app.renderAll()}}
