import { app } from '../state.js';
import { $, age, avail, days, dj, esc, eur, fd, isnum, lc, num, ok, profit, sold, title, today } from './core.js';
import { hydrate, phImg } from './photos.js';
import { DB, DH, combo, genCode, mkForm } from './form.js';
import { finDate, isFinal } from './finalisation.js';

app.openSheet = openSheet;

/* ---------- fiche d'une pièce ---------- */
export function closeSheet(){$('sheet').hidden=true}
$('sheet').onclick=e=>{if(e.target===$('sheet')||e.target.closest('[data-x]'))closeSheet()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sheet').hidden)closeSheet()});
document.addEventListener('click',e=>{const c=e.target.closest('.chip[data-t]');if(!c)return;const inp=$(c.dataset.t),on=/^(s|e)_plat$/.test(c.dataset.t)||!c.classList.contains('on');inp.value=on?app.pfShow(c.dataset.v):'';c.parentNode.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===c&&on))});
const CANAUX=['Vinted','TikTok Live','Autre'];
function openSheet(id,m){
 const p=app.P.find(x=>x.id===id);if(!p)return closeSheet();$('sheet').hidden=false;const c=$('shc');m=m||'view';
 const head=h=>`<div class="sh"><h2>${h}</h2><button type="button" class="x" data-x="1" aria-label="${t('Fermer')}">×</button></div>`;
 const back=`<button class="btn sec" id="g_no" type="button">${t('Retour')}</button>`;
 if(m==='view'){
  const dims=[...DH,...DB].filter(([k])=>p[k]).map(([k,l])=>t(l)+' '+String(p[k]).replace('.',app.DS)+' cm').join(' · ');
  const rows=[['Bac',p.bac],['Code',p.code],['Catégorie',tv(p.cat)],['Type',tv(p.sub)],['Marque',p.marque],['Modèle',p.modele],['Taille',p.taille],['Genre',tv(p.genre)],['Grade',p.grade],['État',tv(p.etat)],['Défauts',(p.defauts||[]).map(tv).join(', ')],['Matières',(p.mat||[]).map(tv).join(', ')],['Couleurs',(p.coul||[]).map(tv).join(', ')],['Made in',cn(p.madein)],['Collab',p.collab&&!/^Aucun/.test(p.collab)?p.collab:''],['Ballot',p.ballot],['Compte',!sold(p)&&p.stk&&app.hasComptes()?((app.comptes().find(c=>c.id===p.stk)||{}).n||''):''],['Provenance',tv(p.prov)],['Acheté',isnum(p.achat)?eur(p.achat):''],['Entrée',fd(p.entree)+(ok(p.entree)?' ('+dj(age(p))+')':'')],['Publiée',fd(p.pub)],['Dimensions',dims],
   ...(sold(p)?[['Vendu',eur(p.pv)+' · '+tv(p.canal||'Vinted')+' · '+fd(p.dv)],['Frais',p.frais?eur(p.frais):''],['Compte',app.hasComptes()?app.cptName(p):''],['Finalisation',!app.countsForFisc(p)?t('Hors déclaration (compte non pris en compte)'):isFinal(p)?t('Finalisée le {d}',{d:fd(finDate(p))}):t('En attente · finalisée automatiquement le {d}',{d:fd(finDate(p))})]]:[]),
   ...(p.retours||[]).map(r=>['Retour',fd(r.d)+(isnum(r.p)?' · '+eur(r.p):'')+(r.m?' · '+tv(r.m):'')]),['Note',p.note]].filter(r=>r[1]);
  c.innerHTML=head(esc(title(p)))+(p.photo?phImg(p.photo,'big-ph'):'')+`<div class="card"><dl class="kv">${rows.map(r=>`<dt>${t(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>${sold(p)?`<div class="pv" style="color:${profit(p)>=0?'var(--mint)':'var(--red)'}">${t('Bénéfice net : {b}',{b:eur(profit(p))})}</div>`:''}</div>
  ${app.incBanner(p)}${app.histHTML(p)}${avail(p)?'<div class="card" id="pc"></div>':''}<div class="acts">${avail(p)?'<button class="btn mint" id="a_sell" type="button">'+t('Marquer comme vendu')+'</button><button class="btn sec" id="a_ann" type="button">'+t('Créer l\'annonce Vinted')+'</button>':''}${sold(p)&&!isFinal(p)&&app.countsForFisc(p)?'<button class="btn mint" id="a_fin" type="button">'+t('Marquer la vente finalisée')+'</button>':''}${sold(p)?'<button class="btn" id="a_esale" type="button">'+t('Modifier la vente')+'</button><button class="btn sec" id="a_proof" type="button">'+t('Dossier de preuves')+app.proofN(p)+'</button><button class="btn sec" id="a_ret" type="button">'+t('Enregistrer un retour')+'</button><button class="btn sec" id="a_unsell" type="button">'+t('Annuler la vente')+'</button>':''}${p.statut==='Pas Disponible'?'<button class="btn sec" id="a_dis" type="button">'+t('Remettre en stock')+'</button>':''}${avail(p)?'<button class="btn sec" id="a_indis" type="button">'+t('Marquer indisponible')+'</button>':''}
  <div class="acts two" style="margin:0"><button class="btn sec" id="a_edit" type="button">${t('Modifier')}</button><button class="btn sec" id="a_del" type="button">${t('Supprimer')}</button></div></div>`;
  const on=(i,f)=>{if($(i))$(i).onclick=f};
  on('a_sell',()=>app.openSheet(id,'sell'));on('a_ret',()=>app.openSheet(id,'ret'));on('a_edit',()=>app.openSheet(id,'edit'));on('a_del',()=>app.openSheet(id,'del'));
  on('a_indis',()=>{app.save(Object.assign({},p,{statut:'Pas Disponible'}));closeSheet();app.toast(t('Marquée indisponible'),()=>app.save(p))});
  on('a_dis',()=>{app.save(Object.assign({},p,{statut:'Disponible'}));closeSheet();app.toast(t('Remise en stock'),()=>app.save(p))});
  on('a_ann',()=>app.openSheet(id,'ann'));on('a_esale',()=>app.openSheet(id,'esale'));on('a_proof',()=>app.openProofs(id));
  on('a_fin',()=>{app.finalize([p]);app.openSheet(id);app.toast(t('Vente finalisée ✓'),()=>{app.save(p);app.openSheet(id)})});
  on('a_unsell',()=>{const q=Object.assign({},p,{statut:'Disponible'});['pv','dv','canal','frais','vt','acheteur','exp','lot','lotn','fo','fin','cpt'].forEach(k=>delete q[k]);app.save(q);closeSheet();app.toast(t('Vente annulée : pièce remise en stock'),()=>app.save(p))});
  hydrate();if(avail(p))app.renderAdvice(p);
 }
 if(m==='ann'){const a=app.advice(p);
  c.innerHTML=head(t('Annonce Vinted'))+`<div class="card"><div class="fld"><label class="l" for="an_t">${t('Titre')} <span id="an_c" style="text-transform:none;letter-spacing:0"></span></label><input type="text" id="an_t" maxlength="60"></div>
  <div class="fld"><label class="l" for="an_d">${t('Description')}</label><textarea id="an_d" rows="15" style="min-height:300px;font-size:15px"></textarea></div>
  <dl class="kv" style="margin-top:14px"><dt>${t('Catégorie')}</dt><dd>${esc(app.vCategory(p))}</dd><dt>${t('État à choisir')}</dt><dd>${esc(app.vCond(p))}</dd><dt>${t('Prix conseillé')}</dt><dd>${a.ok?esc(eur(a.reco))+' ('+esc(lc(t(a.tier)))+')':a.fallback?esc(eur(a.fallback))+' '+t('(repère 2,5 × l\'achat)'):t('données insuffisantes')}</dd></dl>
  <div class="hint">${t('Pour de meilleurs résultats : 4 à 6 photos (de face, de dos, étiquette, défauts) en lumière naturelle. Vérifie la catégorie dans Vinted, elle peut varier.')}</div></div>
  <div class="acts two"><button class="btn" id="an_ct" type="button">${t('Copier le titre')}</button><button class="btn" id="an_cd" type="button">${t('Copier la description')}</button></div>
  <div class="acts"><button class="btn sec" id="an_all" type="button">${t('Copier le titre et la description')}</button><div class="acts two" style="margin:0"><button class="btn sec" id="an_rg" type="button">${t('Régénérer')}</button><button class="btn sec" id="g_no" type="button">${t('Retour')}</button></div></div>`;
  const fill=()=>{$('an_t').value=app.vTitle(p);$('an_d').value=app.vDesc(p);cnt()},cnt=()=>{$('an_c').textContent=$('an_t').value.length+'/60'};
  fill();$('an_t').oninput=cnt;
  $('an_ct').onclick=()=>app.copyText($('an_t').value,t('Titre'));$('an_cd').onclick=()=>app.copyText($('an_d').value,t('Description'));
  $('an_all').onclick=()=>app.copyText($('an_t').value+'\n\n'+$('an_d').value,t('Annonce'));
  $('an_rg').onclick=()=>{fill();app.toast(t('Annonce régénérée'))};$('g_no').onclick=()=>app.openSheet(id)}
 if(m==='edit'){c.innerHTML=head(t('Modifier'))+`<div class="card frm" id="fed"></div>`;
  mkForm($('fed'),Object.assign({},p),{mode:'edit',open:true,onCancel:()=>app.openSheet(id),onSubmit(S){const q=Object.assign({},p,S);q.id=p.id;q.statut=p.statut;if(!S.photo)delete q.photo;if(!q.code||combo(q)!==combo(p)){const cd=genCode(q);if(cd)q.code=cd;else delete q.code}app.save(q);app.openSheet(id);app.toast(t('Enregistré ✓'))}})}
 if(m==='del'){c.innerHTML=head(t('Supprimer cette pièce ?'))+`<div class="card"><p style="margin:0"><b>${esc(title(p))}</b> ${t('sera retirée du stock et du bilan.')}</p></div><div class="acts two"><button class="btn sec" id="d_no" type="button">${t('Garder')}</button><button class="btn red" id="d_ok" type="button">${t('Supprimer')}</button></div>`;
  $('d_no').onclick=()=>app.openSheet(id);$('d_ok').onclick=()=>{app.remove(id);closeSheet();app.toast(t('Pièce supprimée'),()=>app.save(p))}}
 if(m==='sell'){const adv=app.advice(p),pr0=app.priceFor(p),cp0=app.hasComptes()?app.compteDef('Vinted'):null,cn0=cp0?cp0.pf:'Vinted';c.innerHTML=head(t('Marquer comme vendu'))+`<div class="card"><p class="sub" style="margin-bottom:12px">${esc(title(p))} · ${t('acheté {p}',{p:eur(p.achat)})}</p>
  <div class="fld" id="s_w"><label class="l" for="s_prix">${t('Prix de vente')}</label><div class="price"><input type="text" inputmode="decimal" id="s_prix" placeholder="0${app.DS}00" value="${pr0?app.fN(pr0):''}"><span>€</span></div>${adv.ok?`<div class="hint">${t('Prix conseillé : {p} ({n} ventes comparables). Modifie-le si besoin.',{p:eur(adv.reco),n:adv.n})}</div>`:''}</div>
  <div class="fld"><label class="l" for="s_plat">${t('Vendu sur')}</label><input type="text" id="s_plat" value="${esc(app.pfShow(cn0))}"><div class="chips sug">${CANAUX.map(x=>`<button type="button" class="chip sm${x===cn0?' on':''}" data-t="s_plat" data-v="${x}">${tv(x)}</button>`).join('')}</div></div>
  ${app.cptField('s_cpt',cp0&&cp0.id)}
  <div class="row2 fld"><div><label class="l" for="s_date">${t('Date de vente')}</label><input type="date" id="s_date" value="${today()}"></div><div><label class="l" for="s_frais">${t('Frais')}</label><div class="price"><input type="text" inputmode="decimal" id="s_frais" value="${app.fN(app.defFrais(pr0||0,cn0,cp0&&cp0.id))}"><span>€</span></div></div></div>
  <div class="hint">${t('Frais : commission, envoi à ta charge… Sur Vinted, les frais de protection sont payés par l\'acheteur.')}</div><div class="fld" style="margin-top:12px"><label class="l" for="s_ps">${t('@pseudo de l\'acheteur (facultatif)')}</label><input type="text" id="s_ps" placeholder="@${t('pseudo')}" autocapitalize="none" autocomplete="off"></div><div class="pv" id="s_pv"></div></div>
  <div class="acts"><button class="btn mint" id="s_ok" type="button">${t('Valider la vente')}</button>${back}</div>`;
  let ft=false;
  const pv=()=>{const x=num($('s_prix').value),f=num($('s_frais').value)||0;$('s_pv').innerHTML=isNaN(x)?t('Bénéfice net : —'):app.rentaHTML(app.renta(p.achat||0,x,f,app.ageDelai(p),true))};
  const auto=()=>{const cn=app.pfKey($('s_plat').value.trim())||'Vinted',cps=app.cptFollow('s_cpt',cn);if(ft)return;const x=num($('s_prix').value);$('s_frais').value=app.fN(app.defFrais(isNaN(x)?0:x,cn,cps||undefined))};
  pv();$('s_prix').oninput=()=>{auto();pv()};$('s_frais').oninput=()=>{ft=true;pv()};
  document.querySelectorAll('[data-t="s_plat"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{auto();pv()},0)));
  $('g_no').onclick=()=>app.openSheet(id);
  $('s_ok').onclick=()=>{const x=num($('s_prix').value);$('s_w').classList.toggle('err',isNaN(x)||x<0);if(isNaN(x)||x<0)return app.toast(t('Indique le prix de vente'));
   if(!app.guardSale(p,x,num($('s_frais').value)||0,$('s_date').value||today()))return;const q=Object.assign({},p,{statut:'Vendu',pv:x,canal:app.pfKey($('s_plat').value.trim())||'Autre',dv:$('s_date').value||today(),frais:num($('s_frais').value)||0,vt:Date.now()});{const ps0=$('s_ps')?$('s_ps').value.trim().replace(/^@+/,''):'';if(ps0)q.acheteur=ps0}{const cps=app.cptSel('s_cpt');if(cps)q.cpt=cps}app.save(q);closeSheet();app.toast(t('Vendu · bénéfice {b}',{b:eur(profit(q))})+(p.bac?t(' · bac {b}',{b:p.bac}):''),()=>app.save(p))}}
 if(m==='esale'){c.innerHTML=head(t('Modifier la vente'))+`<div class="card"><p class="sub" style="margin-bottom:12px">${esc(title(p))} · ${t('acheté {p}',{p:eur(p.achat)})}</p>
  <div class="fld" id="e_w"><label class="l" for="e_prix">${t('Prix de vente')}</label><div class="price"><input type="text" inputmode="decimal" id="e_prix" value="${app.fN(p.pv||0)}"><span>€</span></div></div>
  <div class="row2 fld"><div><label class="l" for="e_date">${t('Date de vente')}</label><input type="date" id="e_date" value="${esc(ok(p.dv)?p.dv:today())}"></div><div><label class="l" for="e_frais">${t('Frais')}</label><div class="price"><input type="text" inputmode="decimal" id="e_frais" value="${app.fN(p.frais||0)}"><span>€</span></div></div></div>
  <div class="fld"><label class="l" for="e_plat">${t('Vendu sur')}</label><input type="text" id="e_plat" value="${esc(app.pfShow(p.canal||'Vinted'))}"><div class="chips sug">${CANAUX.map(x=>`<button type="button" class="chip sm${(p.canal||'Vinted')===x?' on':''}" data-t="e_plat" data-v="${x}">${tv(x)}</button>`).join('')}</div></div>
  ${app.cptField('e_cpt',(app.compteOf(p)||{}).id)}
  <div class="fld"><label class="l" for="e_ps">${t('@pseudo de l\'acheteur (facultatif)')}</label><input type="text" id="e_ps" value="${esc(p.acheteur?'@'+p.acheteur:'')}" placeholder="@${t('pseudo')}" autocapitalize="none" autocomplete="off"></div>
  <div class="pv" id="e_pv"></div></div>
  <div class="acts"><button class="btn mint" id="e_ok" type="button">${t('Enregistrer la vente')}</button>${back}</div>`;
  const pv=()=>{const x=num($('e_prix').value),f=num($('e_frais').value)||0,d=$('e_date').value,from=ok(p.pub)?p.pub:p.entree;
   if(isNaN(x)){$('e_pv').textContent=t('Bénéfice net : —');return}
   $('e_pv').innerHTML=app.rentaHTML(app.renta(p.achat||0,x,f,ok(d)&&ok(from)?Math.max(0,days(from,d)):null,true))+(ok(d)&&ok(from)&&d<from?'<div class="hint">'+t('La date de vente est avant la date d\'entrée de la pièce.')+'</div>':'')};
  pv();['e_prix','e_frais','e_date'].forEach(i=>$(i).addEventListener('input',pv));
  document.querySelectorAll('[data-t="e_plat"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>app.cptFollow('e_cpt',app.pfKey($('e_plat').value.trim())||'Vinted'),0)));
  $('g_no').onclick=()=>app.openSheet(id);
  $('e_ok').onclick=()=>{const x=num($('e_prix').value),d=$('e_date').value;$('e_w').classList.toggle('err',isNaN(x)||x<0);
   if(isNaN(x)||x<0)return app.toast(t('Indique le prix de vente'));if(!ok(d))return app.toast(t('Indique la date de vente'));
   if(!app.guardSale(p,x,num($('e_frais').value)||0,d))return;const q=Object.assign({},p,{pv:x,dv:d,canal:app.pfKey($('e_plat').value.trim())||'Autre',frais:num($('e_frais').value)||0}),ps=$('e_ps').value.trim().replace(/^@+/,'');if(ps)q.acheteur=ps;else delete q.acheteur;
   {const cps=app.cptSel('e_cpt');if(cps)q.cpt=cps}
   app.save(q);app.openSheet(id);app.toast(t('Vente modifiée ✓'),()=>{app.save(p);app.openSheet(id)})}}
 if(m==='ret'){c.innerHTML=head(t('Enregistrer un retour'))+`<div class="card"><p class="sub" style="margin-bottom:12px">${esc(title(p))} · ${t('vendu {p}',{p:eur(p.pv)})}. ${t('La pièce repasse en stock et la vente est retirée du bilan.')}</p>
  <div class="row2"><div><label class="l" for="r_date">${t('Date du retour')}</label><input type="date" id="r_date" value="${today()}"></div><div><label class="l" for="r_p">${t('Montant remboursé')}</label><div class="price"><input type="text" inputmode="decimal" id="r_p" value="${String(p.pv||'').replace('.',app.DS)}"><span>€</span></div></div></div></div>
  <div class="fld" style="margin-top:14px"><span class="l">${t('Motif du retour')}</span><div class="chips" id="r_m">${app.MOTIFS.map(x=>`<button type="button" class="chip sm" data-v="${esc(x)}">${esc(tv(x))}</button>`).join('')}</div></div>${p.acheteur?`<label class="chk" style="margin-top:12px"><input type="checkbox" id="r_f"><span>${t('Retour de la faute de l\'acheteur (il entre en liste noire)')}</span></label>`:''}<div class="acts"><button class="btn" id="r_ok" type="button">${t('Valider le retour')}</button>${back}</div>`;
  $('g_no').onclick=()=>app.openSheet(id);
  $('r_m').onclick=e=>{const c=e.target.closest('[data-v]');if(!c)return;const was=c.classList.contains('on');$('r_m').querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));if(!was)c.classList.add('on')};$('r_ok').onclick=()=>{const x=num($('r_p').value),mc=document.querySelector('#r_m .on'),rr={d:$('r_date').value||today(),p:isNaN(x)?0:x};if(mc)rr.m=mc.dataset.v;if(p.acheteur){rr.a=p.acheteur;if($('r_f')&&$('r_f').checked)rr.f=1}const q=Object.assign({},p,{statut:'Disponible',retours:[...(p.retours||[]),rr]});delete q.pv;delete q.dv;delete q.canal;delete q.frais;delete q.lot;delete q.lotn;delete q.fin;delete q.cpt;app.save(q);closeSheet();app.toast(t('Retour enregistré'),()=>app.save(p))}}
}
