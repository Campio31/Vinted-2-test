import { app } from '../state.js';
import { $, addDays, avail, days, dj, esc, eur, eurR, fd, isnum, num, ok, profit, sold, title, today } from './core.js';
import { stats } from './dashboard.js';
import { goalCalc, goalKinds } from './goals.js';
import { sheetHead, showSheet } from './tools-index.js';
import { pseudoKey } from './buyers.js';
import { CFG0 } from './settings-core.js';
import { openWizard } from './wizard.js';

Object.assign(CFG0,{seuilQ:null,fournQ:null});

/* ===== v24 b : analyses (live, cohortes, tranches, courbe, seuil) ===== */
const pctF=v=>Math.round(v*100)+' %';
const soldIn=(from,to)=>app.P.filter(p=>sold(p)&&ok(p.dv)&&(!from||p.dv>=from)&&(!to||p.dv<=to));

/* --- bilan de chaque live --- */
function liveSessions(){const g={};app.P.filter(p=>sold(p)&&p.canal==='TikTok Live'&&ok(p.dv)).forEach(p=>{(g[p.dv]=g[p.dv]||[]).push(p)});return Object.keys(g).sort().reverse().map(d=>{const L=g[d],S=stats(L),ts=L.map(p=>p.vt).filter(Boolean).sort((a,b)=>a-b),hrs={};ts.forEach(v=>{const h=new Date(v).getHours();hrs[h]=(hrs[h]||0)+1});
 const buy=new Set(L.map(p=>p.acheteur).filter(Boolean).map(pseudoKey));return{d,L,S,ts,hrs,buy:buy.size,dur:ts.length>1?(ts[ts.length-1]-ts[0])/6e4:0}})}
app.liveSelD = '';
export function livesBody(){const LS=liveSessions();if(!LS.length)return`<div class="empty" style="padding:14px 8px">${t('Aucune vente en TikTok Live enregistrée. Vends depuis l\'onglet Live pour voir ton bilan.')}</div>`;
 const cur=LS.find(s=>s.d===app.liveSelD)||LS[0],i=LS.indexOf(cur),prev=LS.slice(i+1),avg=prev.length?prev.reduce((a,s)=>a+s.S.ca,0)/prev.length:0,rank=[...LS].sort((a,b)=>b.S.ca-a.S.ca).indexOf(cur)+1;
 const hrs=Object.keys(cur.hrs).map(Number).sort((a,b)=>a-b),mx=Math.max(1,...Object.values(cur.hrs)),top=[...cur.L].sort((a,b)=>profit(b)-profit(a)).slice(0,3);
 const vs=avg?(cur.S.ca/avg-1):null;
 return`<div class="chips" id="lv_d" style="margin-bottom:12px;flex-wrap:nowrap;overflow-x:auto">${LS.slice(0,14).map(s=>`<button type="button" class="chip sm${s.d===cur.d?' on':''}" data-ld="${s.d}">${fd(s.d)}</button>`).join('')}</div>
 <div class="kpis"><div class="kpi"><b>${eurR(cur.S.ca)}</b><span>${t('chiffre d\'affaires')}</span></div><div class="kpi"><b>${cur.S.n}</b><span>${t('ventes')}</span></div><div class="kpi"><b>${eurR(cur.S.ben)}</b><span>${t('bénéfice net')}</span></div></div>
 <dl class="kv" style="margin:10px 0 0"><dt>${t('Panier moyen')}</dt><dd>${eur(cur.S.panier)}</dd>${cur.dur?`<dt>${t('Durée des ventes')}</dt><dd>${Math.floor(cur.dur/60)} h ${Math.round(cur.dur%60)} min</dd><dt>${t('Ventes par heure')}</dt><dd>${(cur.S.n/Math.max(.5,cur.dur/60)).toFixed(1).replace('.',app.DS)}</dd>`:''}${cur.buy?`<dt>${t('Acheteurs')}</dt><dd>${cur.buy}</dd>`:''}<dt>${t('Rang')}</dt><dd>${rank} / ${LS.length}</dd></dl>
 ${hrs.length?`<span class="l" style="display:block;margin-top:14px">${t('Ventes par heure')}</span><div class="hrb">${hrs.map(h=>`<div><i style="height:${Math.max(6,cur.hrs[h]/mx*100)}%"></i><b>${cur.hrs[h]}</b><small>${h} h</small></div>`).join('')}</div>`:''}
 <span class="l" style="display:block;margin-top:14px">${t('Pièces qui ont le mieux marché')}</span>${top.map(p=>`<button type="button" class="li" data-id="${esc(p.id)}" style="margin-top:6px"><div class="m"><b>${esc(title(p))}</b><small>${esc([p.taille,p.acheteur&&'@'+p.acheteur].filter(Boolean).join(' · '))}</small></div><div class="p g">${eur(p.pv)}<small>+${eur(profit(p))}</small></div></button>`).join('')}
 ${prev.length?`<div class="cl cl-${vs>=0?'g':'o'}" style="margin-top:14px"><i></i><div><b>${vs>=0?'+':'−'}${Math.abs(Math.round(vs*100))} % ${t('par rapport à tes lives précédents')}</b><span>${t('Moyenne des {n} lives d\'avant : {c}',{n:prev.length,c:eurR(avg)})}</span></div></div>`:`<div class="hint">${t('C\'est ton premier live enregistré : la comparaison apparaîtra au prochain.')}</div>`}`}
export function openLives(){showSheet(sheetHead(t('Bilan des lives'))+`<div class="card" id="lvb">${livesBody()}</div>`);$('shc').onclick=e=>{const d=e.target.closest('[data-ld]');if(d){app.liveSelD=d.dataset.ld;$('lvb').innerHTML=livesBody()}}}

/* --- cohortes : pièces entrées le même mois --- */
function cohorteData(){const g={},nowD=today();app.P.filter(p=>ok(p.entree)&&!p.ex).forEach(p=>{(g[p.entree.slice(0,7)]=g[p.entree.slice(0,7)]||[]).push(p)});
 return Object.keys(g).sort().reverse().slice(0,12).map(m=>{const L=g[m],row={m,n:L.length,left:L.filter(avail).length};[30,60,90].forEach(N=>{const el=L.filter(p=>days(p.entree,nowD)>=N||(sold(p)&&ok(p.dv)&&days(p.entree,p.dv)<=N));const s=el.filter(p=>sold(p)&&ok(p.dv)&&days(p.entree,p.dv)<=N).length;row['r'+N]=el.length>=Math.max(3,L.length*.5)?s/el.length:null});return row}).filter(r=>r.n>=3)}
export function cohorteBody(){const R=cohorteData();if(!R.length)return`<div class="empty" style="padding:14px 8px">${t('Pas assez de pièces par mois d\'entrée (3 minimum).')}</div>`;
 const mn=m=>new Date(m+'-15T12:00:00').toLocaleDateString(app.LOC,{month:'short',year:'2-digit'}).replace('.',''),cell=v=>v==null?'<td class="mu">—</td>':`<td><i class="cb" style="--w:${Math.round(v*100)}%"></i><b>${pctF(v)}</b></td>`;
 const best=R.filter(r=>r.r60!=null).sort((a,b)=>b.r60-a.r60)[0];
 return`<p class="sub" style="margin:0 0 10px">${t('Part des pièces entrées un mois donné qui sont vendues au bout de 30, 60 et 90 jours.')}</p><div class="rpv"><table class="coh"><thead><tr><th>${t('Entrées en')}</th><th>${t('Pièces')}</th><th>30 ${t('j')}</th><th>60 ${t('j')}</th><th>90 ${t('j')}</th></tr></thead><tbody>${R.map(r=>`<tr><th>${esc(mn(r.m))}</th><td>${r.n}</td>${cell(r.r30)}${cell(r.r60)}${cell(r.r90)}</tr>`).join('')}</tbody></table></div>
 <div class="hint" style="margin-top:8px">${t('« — » : trop tôt pour mesurer cette période.')}</div>${best?`<div class="cl cl-g" style="margin-top:10px"><i></i><div><b>${t('Meilleurs achats à 60 jours : {m}',{m:mn(best.m)})}</b><span>${pctF(best.r60)} ${t('des pièces vendues')}</span></div></div>`:''}`}
export function openCohortes(){showSheet(sheetHead(t('Qualité de tes achats'))+`<div class="card">${cohorteBody()}</div>`)}

/* --- rentabilité par tranche de prix d'achat --- */
const TRANCHES=[[0,1,'Moins de 1 €'],[1,2,'1 à 2 €'],[2,3,'2 à 3 €'],[3,5,'3 à 5 €'],[5,8,'5 à 8 €'],[8,12,'8 à 12 €'],[12,1e9,'12 € et plus']];
function tranchesData(){return TRANCHES.map(([a,b,l])=>{const all=app.P.filter(p=>!p.ex&&isnum(p.achat)&&p.achat>=a&&p.achat<b),S=all.filter(sold),st=stats(S),cost=st.cost;return{l,n:all.length,sold:S.length,rate:all.length?S.length/all.length:0,ben:st.ben,roi:cost?st.ben/cost:null,per:S.length?st.ben/S.length:0,delai:st.delai}}).filter(r=>r.n>0)}
export function tranchesBody(){const R=tranchesData();if(!R.length)return`<div class="empty" style="padding:14px 8px">${t('Renseigne les prix d\'achat pour comparer.')}</div>`;const mx=Math.max(1,...R.map(r=>Math.abs(r.roi||0))),best=R.filter(r=>r.sold>=3&&r.roi!=null).sort((a,b)=>b.roi-a.roi)[0];
 return`<p class="sub" style="margin:0 0 10px">${t('Pour 1 € dépensé, combien rapporte chaque tranche de prix d\'achat ?')}</p>${R.map(r=>`<div class="hb"><span class="n">${t(r.l)}</span><div class="tr"><i class="${(r.roi||0)<0?'neg':''}" style="width:${Math.max(3,Math.abs(r.roi||0)/mx*100)}%"></i></div><span class="v">${r.roi==null?'—':'×'+(r.roi+1).toFixed(1).replace('.',app.DS)}</span><small>${tn(r.n,'pièce','pièces')} · ${t('{p} vendues',{p:pctF(r.rate)})} · ${eur(r.per)} ${t('par vente')}${r.sold?' · '+dj(r.delai):''}</small></div>`).join('')}
 <div class="hint" style="margin-top:8px">${t('« ×3,0 » : chaque euro dépensé en revient avec 2 € de bénéfice net en plus. Les tranches à moins de 3 ventes sont peu fiables.')}</div>${best?`<div class="cl cl-g" style="margin-top:10px"><i></i><div><b>${t('Tranche la plus rentable : {l}',{l:t(best.l)})}</b><span>${t('Rendement ×{x}',{x:(best.roi+1).toFixed(1).replace('.',app.DS)})}</span></div></div>`:''}`}
export function openTranches(){showSheet(sheetHead(t('Rentabilité par prix d\'achat'))+`<div class="card">${tranchesBody()}</div>`)}

/* --- courbe de bénéfice cumulé et objectif --- */
export function courbeBody(){const kind=(goalKinds()||[]).find(k=>goalCalc(k,'m'));if(!kind)return`<p class="sub" style="margin:0 0 10px">${t('Fixe un objectif mensuel pour voir si tu es en avance ou en retard chaque jour.')}</p><button type="button" class="btn sm" data-goalset>${t('Définir mon objectif')}</button>`;
 const d=goalCalc(kind,'m'),now=new Date(),y=now.getFullYear(),mo=now.getMonth(),n=new Date(y,mo+1,0).getDate(),dn=now.getDate(),pre=today().slice(0,7),per=Array(n+1).fill(0);
 app.P.filter(p=>sold(p)&&(p.dv||'').startsWith(pre)).forEach(p=>{const dd=+p.dv.slice(8,10);per[dd]+=kind==='net'?profit(p):(p.pv||0)});
 const cum=[0];for(let i=1;i<=dn;i++)cum[i]=cum[i-1]+per[i];const g=d.g,proj=cum[dn]/dn*n,mxv=Math.max(g,proj,...cum,1)*1.1,W=320,H=170,X=i=>8+(i-1)/(n-1)*(W-16),Y=v=>H-22-v/mxv*(H-40);
 const line=cum.slice(1).map((v,i)=>(i?'L':'M')+X(i+1).toFixed(1)+' '+Y(v).toFixed(1)).join(' '),exp=g*dn/n,diff=cum[dn]-exp,ahead=diff>=0,fin=dn<n;
 /* projection : du point d'aujourd'hui jusqu'à la fin du mois, en pointillés d'une autre couleur ; repère vertical « aujourd'hui » ; axe en jours */
 const px=X(dn).toFixed(1),endV=Math.max(proj,cum[dn]);
 return`<svg viewBox="0 0 ${W} ${H}" class="crv" role="img" aria-label="${t('Courbe cumulée du mois')}"><line x1="${X(1)}" y1="${Y(0)}" x2="${X(n)}" y2="${Y(g)}" class="tg"/>${fin?`<line x1="${px}" y1="10" x2="${px}" y2="${Y(0)}" class="td"/><path d="M${px} ${Y(cum[dn]).toFixed(1)} L${X(n).toFixed(1)} ${Y(endV).toFixed(1)}" class="pj"/><circle cx="${X(n)}" cy="${Y(endV)}" r="4" class="pjc"/>`:''}<path d="${line}" class="ac ${ahead?'up':'dn'}"/><circle cx="${px}" cy="${Y(cum[dn])}" r="4.5" class="ac ${ahead?'up':'dn'}"/><circle cx="${X(dn)}" cy="${Y(exp)}" r="3.5" class="tg2"/><text x="${W-8}" y="${Y(g)-6}" text-anchor="end" class="lb">${t('objectif')} ${eurR(g)}</text>${fin?`<text x="${Math.min(W-52,Math.max(52,X(dn)))}" y="${H-6}" text-anchor="middle" class="lb">${t('aujourd\'hui')}</text>`:''}${dn>6?`<text x="8" y="${H-6}" class="lb">1</text>`:''}${dn<n-6?`<text x="${W-8}" y="${H-6}" text-anchor="end" class="lb">${n}</text>`:''}</svg>
 <div class="crl"><span class="cr-a">${t('Réel')}</span>${fin?`<span class="cr-p">${t('Projection : {p}',{p:eurR(proj)})}</span>`:''}<span class="cr-o">${t('Objectif')}</span></div>
 <div class="cl cl-${ahead?'g':'o'}"><i></i><div><b>${ahead?t('En avance de {x}',{x:eur(Math.abs(diff))}):t('En retard de {x}',{x:eur(Math.abs(diff))})}</b><span>${t('Aujourd\'hui : {a} · objectif du jour : {b}',{a:eur(cum[dn]),b:eur(exp)})}</span></div></div>
 <div class="hint" style="margin-top:8px">${t('Au rythme actuel, tu finis le mois à {p}.',{p:eurR(proj)})} ${proj>=g?t('L\'objectif est tenu.'):t('Il manque {x} pour y arriver.',{x:eurR(g-proj)})}</div>`}
export function openCourbe(){showSheet(sheetHead(t('Bénéfice cumulé et objectif'))+`<div class="card">${courbeBody()}</div>`)}

/* --- seuil de rentabilité mensuel --- */
const fixesList=()=>Array.isArray(app.cfg.fixes)?app.cfg.fixes:[];
const fixesMois=()=>fixesList().reduce((a,f)=>a+(f.p==='A'?(+f.v||0)/12:(+f.v||0)),0);
/* apports : aides ou versements qui couvrent une partie des frais fixes.
   k='M' : chaque mois, du mois d (compris) au mois f (compris, facultatif) ; k='U' : une seule fois, au mois d. */
const apportsList=()=>Array.isArray(app.cfg.apports)?app.cfg.apports:[];
export const apportsMois=(mo=today().slice(0,7))=>apportsList().reduce((a,x)=>a+(x.k==='U'?(x.d===mo?+x.v||0:0):((!x.d||x.d<=mo)&&(!x.f||x.f>=mo)?+x.v||0:0)),0);
const moisTxt=m=>new Date(m+'-15T12:00:00').toLocaleDateString(app.LOC,{month:'long',year:'numeric'});
const apportTxt=x=>x.k==='U'?t('une fois en {m}',{m:moisTxt(x.d)}):(x.d?t('par mois depuis {m}',{m:moisTxt(x.d)}):t('par mois'))+(x.f?' '+t('jusqu\'en {m}',{m:moisTxt(x.f)}):'');
export function seuilCalc(){const F=fixesMois(),A=apportsMois(),Fn=Math.max(0,F-A),S=stats(soldIn(addDays(today(),-90),'')),per=S.n?S.ben/S.n:0,need=per>0?Math.ceil(Fn/per):null,needSans=per>0?Math.ceil(F/per):null,pre=today().slice(0,7),M=stats(soldIn(pre+'-01',pre+'-31'));
 return{F,A,Fn,per,need,needSans,M,rate:S.n/90*30,reached:M.ben>=Fn,left:Math.max(0,Fn-M.ben)}}
function seuilBody(){const c=seuilCalc();
 return`<div class="fxl">${fixesList().map((f,i)=>`<div class="fxr"><span>${esc(f.n)}<small>${f.p==='A'?t('par an'):t('par mois')}</small></span><b>${eur(f.v)}</b><button type="button" class="chip sm" data-fxd="${i}" aria-label="${t('Supprimer')}">✕</button></div>`).join('')||`<p class="sub" style="margin:0 0 8px">${t('Ajoute tes frais fixes : abonnements, matériel (photo, cintres), forfait téléphone.')}</p>`}</div>
 <details class="xdet"><summary>${t('Ajouter ou ajuster à la main')}</summary><div class="row2" style="margin-top:8px"><input type="text" id="fx_n" placeholder="${t('Nom (ex. abonnement)')}" autocomplete="off"><div class="price"><input type="text" inputmode="decimal" id="fx_v" placeholder="0"><span>€</span></div></div>
 <div class="chips" id="fx_p" style="margin:8px 0"><button type="button" class="chip sm on" data-fp="M">${t('par mois')}</button><button type="button" class="chip sm" data-fp="A">${t('par an')}</button><button type="button" class="btn sm sec" id="fx_add" style="width:auto;margin-left:auto;min-height:40px">${t('Ajouter')}</button></div></details>
 <h3 style="margin:18px 0 6px">${t('Apports')}</h3><p class="sub" style="margin:0 0 8px">${t('Aides ou versements qui couvrent une partie de tes frais fixes (par exemple une aide mensuelle). Ils font baisser le seuil.')}</p>
 <div class="fxl">${apportsList().map((x,i)=>`<div class="fxr"><span>${esc(x.n)}<small>${esc(apportTxt(x))}</small></span><b>${eur(x.v)}</b><button type="button" class="chip sm" data-apd="${i}" aria-label="${t('Supprimer')}">✕</button></div>`).join('')}</div>
 <details class="xdet"><summary>${t('Ajouter ou ajuster à la main')}</summary><div class="row2" style="margin-top:8px"><input type="text" id="ap_n" placeholder="${t('Nom (ex. aide mensuelle)')}" autocomplete="off"><div class="price"><input type="text" inputmode="decimal" id="ap_v" placeholder="0"><span>€</span></div></div>
 <div class="chips" id="ap_k" style="margin:8px 0 4px"><button type="button" class="chip sm on" data-ak="M">${t('chaque mois')}</button><button type="button" class="chip sm" data-ak="U">${t('une fois')}</button></div>
 <div class="row2 fld"><div><label class="l" for="ap_d" id="ap_dl">${t('À partir de')}</label><input type="month" id="ap_d" value="${today().slice(0,7)}"></div><div id="ap_fw"><label class="l" for="ap_f">${t('Jusqu\'à (facultatif)')}</label><input type="month" id="ap_f"></div></div>
 <button type="button" class="btn sm sec" id="ap_add" style="margin-bottom:6px">${t('Ajouter l\'apport')}</button></details>
 ${c.F?`<div class="kpis two" style="margin-top:12px"><div class="kpi"><b>${eurR(c.F)}</b><span>${t('frais fixes par mois')}</span></div><div class="kpi"><b>${c.need==null?'—':c.need}</b><span>${t('ventes pour couvrir')}</span></div></div>
 ${c.A?`<dl class="kv" style="margin:12px 0 0"><dt>${t('Apports ce mois-ci')}</dt><dd>− ${eur(c.A)}</dd><dt>${t('Reste à couvrir par tes ventes')}</dt><dd>${eur(c.Fn)}</dd>${c.needSans!=null&&c.needSans!==c.need?`<dt>${t('Seuil sans les apports')}</dt><dd>${tn(c.needSans,'vente','ventes')}</dd>`:''}</dl>`:''}
 <dl class="kv" style="margin:12px 0 0"><dt>${t('Bénéfice moyen par vente')}</dt><dd>${eur(c.per)}</dd><dt>${t('Ce mois-ci')}</dt><dd>${tn(c.M.n,'vente','ventes')} · ${eur(c.M.ben)}</dd><dt>${t('Ton rythme (90 jours)')}</dt><dd>${Math.round(c.rate)} ${t('ventes par mois')}</dd></dl>
 ${c.need==null?`<div class="hint">${t('Pas encore assez de ventes pour calculer un bénéfice moyen.')}</div>`:c.Fn===0?`<div class="cl cl-g" style="margin-top:12px"><i></i><div><b>${t('Tes apports couvrent déjà tes frais fixes')}</b><span>${t('Chaque vente est un bénéfice net pour toi ce mois-ci.')}</span></div></div>`:`<div class="cl cl-${c.reached?'g':'o'}" style="margin-top:12px"><i></i><div><b>${c.reached?t('Frais fixes couverts, tu gagnes de l\'argent'):t('À partir de la {n}e vente du mois, tu gagnes de l\'argent',{n:c.need})}</b><span>${c.reached?t('Marge de sécurité : {x}',{x:eur(c.M.ben-c.Fn)}):t('Il reste {x} à couvrir ce mois-ci, soit environ {n} ventes.',{x:eur(c.left),n:Math.ceil(c.left/c.per)})}</span></div></div><div class="hint" style="margin-top:8px">${c.rate<c.need?t('À ton rythme actuel ({r} ventes par mois), le seuil n\'est pas atteint.',{r:Math.round(c.rate)}):t('Ton rythme actuel couvre le seuil.')}</div>`}`:''}`}
export function openSeuil(){const draw=()=>{showSheet(sheetHead(t('Seuil de rentabilité'))+`<div class="acts" style="margin:0 0 10px"><button type="button" class="btn mint" id="sq_go">${t(fixesList().length||apportsList().length?'Refaire le questionnaire':'Répondre au questionnaire')}</button></div><div class="card" id="sl_b">${seuilBody()}</div>`);let per='M',ak='M';
 $('shc').onclick=e=>{if(e.target.closest('#sq_go'))return openSeuilQ();const p=e.target.closest('[data-fp]');if(p){per=p.dataset.fp;$('fx_p').querySelectorAll('[data-fp]').forEach(x=>x.classList.toggle('on',x===p));return}const d=e.target.closest('[data-fxd]');if(d){app.setCfg({fixes:fixesList().filter((f,i)=>i!==+d.dataset.fxd)});return draw()}
  const k=e.target.closest('[data-ak]');if(k){ak=k.dataset.ak;$('ap_k').querySelectorAll('[data-ak]').forEach(x=>x.classList.toggle('on',x===k));$('ap_fw').hidden=ak==='U';$('ap_dl').textContent=ak==='U'?t('Mois de l\'apport'):t('À partir de');return}
  const ad=e.target.closest('[data-apd]');if(ad){app.setCfg({apports:apportsList().filter((f,i)=>i!==+ad.dataset.apd)});return draw()}
  if(e.target.closest('#ap_add')){const n=$('ap_n').value.trim(),v=num($('ap_v').value),d=$('ap_d').value||today().slice(0,7),f=$('ap_f').value;if(!n||isNaN(v)||v<=0)return app.toast(t('Indique un nom et un montant'));if(ak==='M'&&f&&f<d)return app.toast(t('La fin doit être après le début'));const o={n,v,k:ak,d};if(ak==='M'&&f)o.f=f;app.setCfg({apports:[...apportsList(),o]});return draw()}
  if(e.target.closest('#fx_add')){const n=$('fx_n').value.trim(),v=num($('fx_v').value);if(!n||isNaN(v)||v<=0)return app.toast(t('Indique un nom et un montant'));app.setCfg({fixes:[...fixesList(),{n,v,p:per}]});draw()}}};draw()}
export const seuilCardTxt=()=>{const c=seuilCalc();return c.F?(c.need==null?'':c.Fn===0?t('Frais fixes couverts par tes apports'):c.reached?t('Frais fixes couverts'):t('Seuil : {n} ventes',{n:c.need})):''};
/* --- questionnaire du seuil : remplace les frais fixes par tes réponses (refaisable à tout moment) --- */
const SQ_ROWS=[['abo','Abonnements (outils, comptabilité…)'],['tel','Téléphone et internet'],['loc','Local ou stockage'],['mat','Matériel (photo, cintres, balance), par mois'],['transp','Transport et carburant'],['assur','Assurance'],['banque','Frais bancaires'],['autre','Autres frais fixes']];
export function openSeuilQ(){
 openWizard({title:'Seuil de rentabilité',intro:'Quelques questions sur tes frais fixes. Tes réponses remplacent la liste actuelle, tu peux les refaire à tout moment.',answers:app.cfg.seuilQ||{},
  steps:[{k:'rows',type:'rows',q:'Quels frais fixes paies-tu chaque mois ?',h:'Laisse vide ce que tu ne paies pas. Une dépense annuelle : divise-la par 12.',rows:SQ_ROWS.map(([k,l])=>({k,l,u:'€'}))},
   {k:'apport',type:'num',u:'€',q:'Reçois-tu une aide ou un apport chaque mois ?',h:'Par exemple une aide d\'un proche. Laisse vide s\'il n\'y en a pas.'}],
  onDone:a=>{const fixes=SQ_ROWS.filter(([k])=>(a.rows||{})[k]>0).map(([k,l])=>({n:t(l),v:a.rows[k],p:'M'})),ap=apportsList().filter(x=>!x.q);
   if(a.apport>0)ap.push({n:t('Aide mensuelle'),v:a.apport,k:'M',d:today().slice(0,7),q:1});
   app.setCfg({fixes,apports:ap,seuilQ:a});app.toast(t('Seuil mis à jour'));app.renderAll();openSeuil()}})}