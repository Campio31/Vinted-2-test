import { app } from '../state.js';
import { $, LSg, LSs, esc, today } from './core.js';
import { cloud, errMsg } from './sync.js';
import { sheetHead, showSheet } from './tools-index.js';
import { MOIS } from './gamification.js';
import { defiProg } from './challenges.js';

app.amisPublish = amisPublish;
app.amisInit = amisInit;
app.amisClick = amisClick;

/* --- 6b. classement entre amis (tables amis_* : voir classement-setup.sql) --- */
let amisSort='ventes';
const amisErr=e=>(e&&(e.code==='42P01'||e.code==='PGRST202'||e.code==='PGRST205'||/schema cache|does not exist/i.test(e.message||'')))?t('Classement non installé : exécute classement-setup.sql dans Supabase.'):errMsg(e);
async function amisPublish(force){if(!cloud||!app.user||app.importing||!app.loaded||!LSg('amisOn',false))return;
 const m=today().slice(0,7),pubs=defiProg({type:'pub',m}),ventes=defiProg({type:'sold',m}),k=app.user.id+':'+m+':'+pubs+':'+ventes;if(!force&&LSg('amisLast','')===k)return;
 const{error}=await app.sb.from('amis_scores').upsert({user_id:app.user.id,mois:m,pubs,ventes},{onConflict:'user_id,mois'});if(error)throw error;LSs('amisLast',k)}
async function amisInit(){const b=$('am_in');if(!b)return;
 if(!cloud||!app.user){b.textContent=t('Connecte-toi (onglet Réglages) pour jouer entre amis.');return}
 let G;try{const{data,error}=await app.sb.from('amis_membres').select('groupe_id,pseudo,amis_groupes(nom,code)').order('joined_at');if(error)throw error;G=data||[]}catch(e){if($('am_in'))$('am_in').textContent=amisErr(e);return}
 if(!$('am_in'))return;if(G.length)LSs('amisOn',true);
 $('am_in').outerHTML=`<div id="am_in">${G.map(g=>`<div class="row2" style="align-items:center;margin-bottom:8px"><div><b>${esc(g.amis_groupes.nom)}</b><div class="hint" style="margin:0">${t('Tu es « {p} »',{p:esc(g.pseudo)})}</div></div><button type="button" class="btn sm mint" data-am="view" data-g="${esc(g.groupe_id)}">${t('Classement')}</button></div>`).join('')}
  <label class="l" for="am_ps">${t('Ton pseudo')}</label><input type="text" id="am_ps" maxlength="24" placeholder="${t('ex. Camille')}" value="${esc(LSg('amisPseudo',''))}">
  <div class="row2 fld" style="margin-top:10px"><div><label class="l" for="am_nom">${t('Créer un groupe')}</label><input type="text" id="am_nom" maxlength="40" placeholder="${t('Les revendeuses')}"></div><div style="align-self:end"><button type="button" class="btn sec" data-am="new">${t('Créer')}</button></div></div>
  <div class="row2 fld"><div><label class="l" for="am_code">${t('Rejoindre avec un code')}</label><input type="text" id="am_code" maxlength="6" placeholder="ABC234" autocapitalize="characters"></div><div style="align-self:end"><button type="button" class="btn sec" data-am="join">${t('Rejoindre')}</button></div></div>
  <div class="hint">${t('Seuls ton pseudo, ton nombre de pièces publiées et de ventes du mois sont partagés, jamais tes prix ni ton stock.')}</div></div>`}
async function amisClick(e){const t=e.target.closest('[data-am]'),a=t.dataset.am;
 if(a==='back')return app.openDefis();
 if(a==='view')return openClassement(t.dataset.g);
 if(a==='sort'){amisSort=t.dataset.s;return openClassement(t.dataset.g)}
 if(a==='copy'){try{await navigator.clipboard.writeText(t.dataset.t);app.toast(window.t('Code copié'))}catch(er){app.toast(t.dataset.t)}return}
 if(a==='leave'){if(!confirm(window.t('Quitter ce groupe ?')))return;try{const{error}=await app.sb.from('amis_membres').delete().eq('groupe_id',t.dataset.g).eq('user_id',app.user.id);if(error)throw error}catch(er){return app.toast(amisErr(er))}return app.openDefis()}
 const ps=($('am_ps').value||'').trim();if(!ps)return app.toast(window.t('Choisis un pseudo'));LSs('amisPseudo',ps);
 try{let r;if(a==='new'){const n=($('am_nom').value||'').trim();if(!n)return app.toast(window.t('Donne un nom au groupe'));r=await app.sb.rpc('creer_groupe',{p_nom:n,p_pseudo:ps})}
  else{const c=($('am_code').value||'').trim();if(!c)return app.toast(window.t('Entre le code reçu'));r=await app.sb.rpc('rejoindre_groupe',{p_code:c,p_pseudo:ps})}
  if(r.error)throw r.error;LSs('amisOn',true);await amisPublish(true).catch(()=>{});openClassement(r.data.id)}catch(er){app.toast(amisErr(er))}}
async function openClassement(g){const m=today().slice(0,7);
 showSheet(sheetHead(t('Classement'))+'<div class="hint">'+t('Chargement…')+'</div>');
 $('shc').onclick=e=>{if(e.target.closest('[data-am]'))amisClick(e)};
 try{await amisPublish(true).catch(()=>{});
  const[c,i]=await Promise.all([app.sb.rpc('classement',{p_groupe:g,p_mois:m}),app.sb.from('amis_groupes').select('nom,code').eq('id',g).single()]);if(c.error)throw c.error;if(i.error)throw i.error;
  const R=[...c.data].sort((a,b)=>(b[amisSort]-a[amisSort])||(b.ventes+b.pubs-a.ventes-a.pubs)),med=['🥇','🥈','🥉'];
  showSheet(sheetHead(esc(i.data.nom))+`<p class="sub">${MOIS[+m.slice(5)-1]} ${m.slice(0,4)}</p>
   <div class="chips"><button type="button" class="chip sm${amisSort==='ventes'?' on':''}" data-am="sort" data-s="ventes" data-g="${esc(g)}">${t('Ventes')}</button><button type="button" class="chip sm${amisSort==='pubs'?' on':''}" data-am="sort" data-s="pubs" data-g="${esc(g)}">${t('Pièces publiées')}</button></div>
   <div class="card">${R.map((r,k)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;${k?'border-top:1px solid var(--line,#ddd);':''}${r.moi?'font-weight:700':''}"><span style="width:28px;text-align:center">${med[k]||(k+1)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(r.pseudo)}${r.moi?' '+t('(toi)'):''}</span><span>${tn(r.ventes,'vente','ventes')} · ${tn(r.pubs,'publiée','publiées')}</span></div>`).join('')}</div>
   <div class="card"><div class="hint" style="margin:0 0 8px">${t('Pour inviter un ami : donne-lui ce code, à saisir dans Défis du mois → Rejoindre.')}</div><div class="row2" style="align-items:center"><b style="font-size:22px;letter-spacing:3px">${esc(i.data.code)}</b><button type="button" class="btn sm sec" data-am="copy" data-t="${esc(i.data.code)}">${t('Copier le code')}</button></div></div>
   <div class="acts"><button type="button" class="btn sec" data-am="back">← ${t('Défis')}</button><button type="button" class="btn sec" data-am="leave" data-g="${esc(g)}">${t('Quitter le groupe')}</button></div>
   <div class="hint">${t('Les chiffres des amis se mettent à jour quand ils ouvrent l\'appli.')}</div>`)}
 catch(er){showSheet(sheetHead(t('Classement'))+`<div class="hint">${esc(amisErr(er))}</div><div class="acts"><button type="button" class="btn sec" data-am="back">← ${t('Défis')}</button></div>`)}
 $('shc').onclick=e=>{if(e.target.closest('[data-am]'))amisClick(e)}}
