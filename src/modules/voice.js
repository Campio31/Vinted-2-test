import { app } from '../state.js';
import { $, LSg, LSs, addDays, avail, esc, eur, eurR, isnum, num, ok, sold, title, today } from './core.js';
import { go } from './nav.js';
import { stats } from './dashboard.js';
import { colisList } from './colis.js';
import { pendingSales } from './finalisation.js';
import { COLORS, allBrands, lev } from './form.js';
import { closeSheet } from './piece-sheet.js';
import { nrm } from './advice.js';
import { defFrais, fN } from './settings-core.js';
import { priceFor } from './sell-card.js';
import { TI, sheetHead, showSheet } from './tools-index.js';

/* ===== 6. Commande vocale ===== */
const WNUM={zero:0,un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,onze:11,douze:12,treize:13,quatorze:14,quinze:15,seize:16,vingt:20,vingts:20,trente:30,quarante:40,cinquante:50,soixante:60};
function frNumWords(tokens){let tot=0,cur=0,got=false;for(let i=0;i<tokens.length;i++){const w=tokens[i];if(w==='et'||w==='')continue;if(w==='quatre'&&/^vingts?$/.test(tokens[i+1]||'')){cur+=80;i++;got=true;continue}
  if(w==='cent'||w==='cents'){cur=(cur||1)*100;got=true;continue}if(w in WNUM){cur+=WNUM[w];got=true;continue}break}return got?tot+cur:null}
function voicePrice(n){let m=/(\d+(?:[.,]\d+)?)\s*(?:euros?|€|eur\b|e\b)/.exec(n);if(m)return num(m[1]);
 const t=n.split(/[\s-]+/),i=t.findIndex(w=>/^euros?$/.test(w));if(i>0){let j=i-1;while(j>=0&&(t[j] in WNUM||/^(et|cent|cents|vingts?)$/.test(t[j])))j--;const v=frNumWords(t.slice(j+1,i));if(v!==null)return v}
 m=/(?:a|pour|prix)\s+(\d+(?:[.,]\d+)?)\b/.exec(n);return m?num(m[1]):null}
const CATW={tshirt:'Tshirt','t-shirt':'Tshirt',tee:'Tshirt',sweat:'Sweat',pull:'Sweat',hoodie:'Sweat',chemise:'Chemise',pantalon:'Pantalon',jean:'Pantalon',jeans:'Pantalon',veste:'Veste',manteau:'Veste',doudoune:'Veste',blouson:'Veste',short:'Short',polo:'Polo',maillot:'Maillot',robe:'RobeJupe',jupe:'RobeJupe'};
function parseVoice(text){const n=nrm(text).replace(/[,.!?]/g,' ').replace(/\s+/g,' ').trim(),o={raw:text,n};
 if(/\b(annule|annuler|annulation)\b/.test(n))return Object.assign(o,{intent:'undo'});
 if(/\b(ou est|ou se trouve|ou sont|trouve|cherche|recherche|montre)\b/.test(n)&&!/\bvendu/.test(n))o.intent=/\bou\b/.test(n)?'where':'search';
 else if(/\bvendu|vendue|vendus|j ai vendu|vends\b/.test(n))o.intent='sell';else o.intent=/\d/.test(n)&&/vinted|tiktok|live|euro/.test(n)?'sell':'unknown';
 o.price=voicePrice(n);o.canal=/tik ?tok|\blive\b/.test(n)?'TikTok Live':/vinted/.test(n)?'Vinted':null;const ps=/@\s?(\w+)/.exec(text);if(ps)o.pseudo=ps[1];
 const toks=n.split(' ');o.brand=null;const bs=allBrands().map(b=>[b,nrm(b)]).filter(x=>x[1].length>=3).sort((a,b)=>b[1].length-a[1].length);
 for(const [b,k] of bs){if((' '+n+' ').includes(' '+k+' ')){o.brand=b;break}}
 if(!o.brand){for(const t of toks){if(t.length<4)continue;const hit=bs.find(([b,k])=>!k.includes(' ')&&lev(t,k)<=1&&Math.abs(t.length-k.length)<=1);if(hit){o.brand=hit[0];break}}}
 o.color=Object.keys(COLORS).find(c=>toks.includes(nrm(c)))||null;o.cat=null;for(const t of toks){if(CATW[t]){o.cat=CATW[t];break}}
 let sz=/(?:taille|en)\s+(xxl|3xl|xl|xs|[sml]|\d{2})\b/.exec(n);if(!sz)sz=/\b(xxl|3xl|xl|xs)\b/.exec(n);if(!sz)sz=/\b([sml])\b/.exec(n.replace(/\b(a|en)\s+[sml]\b/,'$&'));
 o.size=sz?sz[1].toUpperCase():null;o.code=(/\b([a-z]{2}[a-z0-9]{4,}-\d{3})\b/i.exec(text)||[])[1]||null;return o}
function voiceMatch(o,pool){const sc=p=>{let s=0,k=0;if(o.brand){k++;if(nrm(p.marque)===nrm(o.brand))s+=3;else return -1}if(o.color){k++;if((p.coul||[]).includes(o.color))s+=2;else return -1}if(o.size){k++;if(nrm(p.taille)===nrm(o.size))s+=2;else return -1}if(o.cat){k++;if(p.cat===o.cat)s+=2;else return -1}if(o.code){return nrm(p.code)===nrm(o.code)?10:-1}return k?s:-1};
 const sc2=pool.map(p=>[sc(p),p]).filter(x=>x[0]>0);if(!sc2.length)return[];const top=Math.max(...sc2.map(x=>x[0]));return sc2.filter(x=>x[0]===top).map(x=>x[1]).sort((a,b)=>(a.entree||'').localeCompare(b.entree||''))}
let lastUndo=null;
function speak(t){try{if('speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='fr-FR';speechSynthesis.speak(u)}}catch(e){}}
function voiceSell(p,o){const canal=o.canal||LSg('lastCanal','Vinted'),pr=isnum(o.price)?o.price:priceFor(p),fr=defFrais(pr,canal),old=p;
 const q=Object.assign({},p,{statut:'Vendu',pv:pr,canal,dv:today(),frais:fr,vt:Date.now()});if(o.pseudo)q.acheteur=o.pseudo;LSs('lastCanal',canal);app.save(q);lastUndo=()=>app.save(old);
 const msg='Vendu : '+title(p)+(p.taille?' '+p.taille:'')+', '+fN(pr)+' euros, '+canal+(p.bac?'. Bac '+p.bac:'');speak(msg);app.toast('Vendu · '+eur(pr)+(p.bac?' · bac '+p.bac:''),()=>{old&&app.save(old)});return msg}
/* ===== commandes : tout faire à la voix ===== */
/* Chaque commande reconnue agit, répond à voix haute et à l'écran, et laisse une annulation (« Annule »).
   Quand plusieurs pièces correspondent, on propose la liste et on touche (ou on dit) la bonne. */
const NAV={stock:'list',stocks:'list',vente:'sales',ventes:'sales',bilan:'dash',outils:'tools',reglages:'set',parametres:'set',ajouter:'add',ajout:'add'};
const NAVL={list:'Stock',sales:'Ventes',dash:'Bilan',tools:'Outils',set:'Réglages',add:'Ajouter'};
const TOOLW=[['coach',/\bcoach\b/],['fisc',/\b(ligne fiscale|plafond|urssaf|fiscal)\b/],['colis',/\bcolis\b/],['depenses',/\bdepenses?\b/],['trophees',/\b(defis?|trophees?|niveau|serie)\b/],['qr',/\b(scanner|scan|qr|etiquettes?|bacs)\b/],['wrapped',/\bwrapped\b/],['vintage',/\bvintage\b/],['buyers',/\bacheteurs?\b/],['seuil',/\bseuil\b/],['fourn',/\bfournitures?\b/],['aide',/\b(aide|raccourcis)\b/],['rappels',/\brappels?\b/],['complete',/\b(completer|fiches)\b/],['trash',/\bcorbeille\b/],['merge',/\bdoublons?\b/],['live',/\blive\b/]];
const HELP=[['Vendre','« Vendu, Tommy bleu L, 18 euros, Vinted »'],['Retrouver','« Où est le Nike gris M ? » · « Cherche les Levi\'s »'],['Ranger','« Range le Nike gris M dans le bac B3 »'],['Publier','« J\'ai publié le Tommy bleu L »'],['Changer le prix','« Baisse le prix du Nike gris M à 12 euros »'],['Disponibilité','« Mets le Nike gris M indisponible » · « Remets le Nike gris M en stock »'],['Ajouter une pièce','« Ajoute un Tommy bleu L à 4 euros »'],['Noter une dépense','« Ajoute une dépense de 25 euros carburant »'],['Colis','« Colis prêt pour le Tommy bleu L » · « Colis à préparer »'],['Poser une question','« Combien j\'ai gagné ce mois-ci ? » · « Combien de pièces en stock ? »'],['Aller quelque part','« Va au bilan » · « Ouvre la ligne fiscale » · « Pièces à publier »'],['Rapports PDF','« Rapport fiscal » · « Rapport du mois »'],['Objectif','« Objectif 800 euros »'],['Finaliser','« Finalise les ventes »'],['Annuler','« Annule »']];
let pending=null;
const specTxt=o=>[o.brand,o.cat,o.color,o.size].filter(Boolean).join(' ');
const hasSpec=o=>!!(o.brand||o.cat||o.color||o.size||o.code);
function choose(list,act){pending={list:list.slice(0,6),act};$('vc_out').innerHTML=`<div class="vres o"><b>${list.length} pièces correspondent.</b> Laquelle ?</div>`+pending.list.map((p,i)=>`<button type="button" class="lcand" data-vc="${i}"><b>${i+1}</b><span>${esc(title(p))}${p.taille?' · '+esc(p.taille):''}${p.code?' · '+esc(p.code):''}${p.bac?' · bac '+esc(p.bac):''}</span></button>`).join('');speak(list.length+' pièces correspondent. Laquelle ?')}
/* trouve la pièce dite, applique act(p) (qui renvoie la phrase de réponse) ; plusieurs candidates : on demande laquelle */
function target(o,pool,act,say){
 if(!hasSpec(o)){say('<b>De quelle pièce parles-tu ?</b><br>Dis par exemple « Tommy bleu L ».','o');return true}
 const m=voiceMatch(o,pool);
 if(!m.length){say(`<b>Aucune pièce ne correspond</b> à « ${esc(specTxt(o)||o.code)} ».`,'o');return true}
 const same=m.every(p=>nrm(p.marque)===nrm(m[0].marque)&&p.cat===m[0].cat&&p.taille===m[0].taille&&(p.coul||[]).join()===(m[0].coul||[]).join());
 if(m.length===1||same){const msg=act(m[0]);say(`<b>${esc(msg)}</b>${m.length>1?`<br><small>${m.length} pièces identiques : j'ai pris la plus ancienne.</small>`:''}`,'g');speak(msg);return true}
 choose(m,act);return true}
const changePiece=(p,patch,msg)=>{const old=p;app.save(Object.assign({},p,patch));lastUndo=()=>app.save(old);app.toast(msg,()=>{app.save(old)});return msg};
/* réponses chiffrées : « combien j'ai gagné ce mois-ci ? » */
function answer(n){
 const t0=today(),per=/aujourd/.test(n)?['today',t0,'aujourd\'hui']:/semaine|7 jours/.test(n)?['week',addDays(t0,-6),'sur 7 jours']:/annee|cette an|\ban\b/.test(n)?['year',t0.slice(0,4)+'-01-01','cette année']:/tout|depuis le debut|au total/.test(n)?['all','','depuis le début']:['month',t0.slice(0,7)+'-01','ce mois-ci'];
 const S=app.P.filter(p=>sold(p)&&ok(p.dv)&&(!per[1]||p.dv>=per[1])),st=stats(S);
 if(/gagn|benefice|profit|marge/.test(n))return`Bénéfice ${per[2]} : ${eurR(st.ben)}, sur ${st.n} vente${st.n>1?'s':''}.`;
 if(/chiffre d affaires|encaisse|\bca\b/.test(n))return`Chiffre d'affaires ${per[2]} : ${eurR(st.ca)}, sur ${st.n} vente${st.n>1?'s':''}.`;
 if(/depenses?/.test(n)){const d=app.DEP.filter(x=>ok(x.date)&&(!per[1]||x.date>=per[1])).reduce((a,x)=>a+(x.montant||0),0);return`Dépenses ${per[2]} : ${eurR(d)}.`}
 if(/a publier|pas publie|jamais publie/.test(n))return`${app.P.filter(p=>avail(p)&&!ok(p.pub)).length} pièces à publier.`;
 if(/colis/.test(n)){const c=colisList().length;return c?`${c} colis à préparer.`:'Aucun colis à préparer.'}
 if(/stock|pieces en stock/.test(n)){const L=app.P.filter(avail);return`${L.length} pièces en stock, ${eurR(L.reduce((a,p)=>a+(p.achat||0),0))} d'achat.`}
 if(/vendu|vente|ventes/.test(n))return`${st.n} vente${st.n>1?'s':''} ${per[2]} : ${eurR(st.ca)}.`;
 if(/finalis/.test(n)){const L=pendingSales();return L.length?`${L.length} vente${L.length>1?'s':''} à finaliser.`:'Aucune vente à finaliser.'}
 return null}
function command(o,say){
 const n=o.n,has=r=>r.test(n),pr=o.price,open=/\b(ouvre|ouvrir|affiche|afficher|montre|montrer|va|aller|lance|lancer|retour)\b/;
 const ok_=(h,msg)=>{say(h,'g');if(msg)speak(msg);return true};
 if(has(/^(aide|help)$|que sais tu faire|quelles? (sont les )?commandes|qu est ce que (tu comprends|je peux)/))return say('<b>Ce que je comprends</b>'+HELP.map(([k,v])=>`<br><small><b>${k}</b> : ${esc(v)}</small>`).join(''),'g'),true;
 /* aller quelque part */
 const nv=/^(?:va |aller |ouvre |ouvrir |affiche |afficher |montre |montrer |retour )?(?:au |a |aux |a l |l |le |la |les |mes |mon |ma )?(stocks?|ventes?|bilan|outils|reglages|parametres|ajouter|ajout)$/.exec(n);
 if(nv){const v=NAV[nv[1]];closeSheet();go(v);return ok_(`<b>${NAVL[v]}</b> ouvert.`,NAVL[v])}
 if(has(/(pieces?|stock).* a publier|a publier/)&&!has(/combien|quel/)&&(open.test(n)||has(/^(pieces? )?a publier$/))){closeSheet();go('list');app.filt='Apub';app.lim=60;app.renderList();return ok_('<b>Pièces à publier</b> affichées.','Pièces à publier')}
 if(has(/ventes? a finaliser|a finaliser/)&&!has(/combien|quel|finalise les|tout/)){closeSheet();app.openSalesFilter('fin');return ok_('<b>Ventes à finaliser</b> affichées.','Ventes à finaliser')}
 if(has(/colis a preparer|colis en attente/)&&!has(/combien|quel|pret|prete/)){app.openColis();return true}
 if(has(/\bfinalis/)&&has(/\b(tout|toutes|les ventes|ventes)\b/)){const L=pendingSales();if(!L.length)return say('<b>Aucune vente à finaliser.</b>','o'),true;const old=app.finalize(L);lastUndo=()=>old.forEach(p=>app.save(p));const msg=`${L.length} vente${L.length>1?'s':''} finalisée${L.length>1?'s':''}`;app.toast(msg,()=>old.forEach(p=>app.save(p)));return ok_(`<b>${msg}.</b>`,msg)}
 if(has(/\b(rapport|rapports|pdf)\b/)){app.openRapports(has(/fiscal|urssaf|impot|declar/)?'fisc':'ventes');return true}
 /* objectif */
 if(has(/\bobjectif\b/)&&isnum(pr)&&pr>0){const k=has(/chiffre d affaires|\bca\b/)?'goalCA':'goal',old=app.cfg[k];app.setCfg({[k]:pr});lastUndo=()=>app.setCfg({[k]:old});app.renderAll();const msg=`Objectif ${k==='goalCA'?'de chiffre d\'affaires':'de bénéfice'} : ${fN(pr)} euros par mois`;return ok_(`<b>${msg}.</b>`,msg)}
 /* dépense */
 if(has(/\bdepenses?\b/)&&has(/\b(ajoute|ajouter|note|noter|enregistre|enregistrer|j ai depense|saisis|nouvelle)\b/)){
  const m=isnum(pr)?pr:(/(\d+(?:[.,]\d+)?)/.exec(n)||[])[1]?num(/(\d+(?:[.,]\d+)?)/.exec(n)[1]):null;
  if(!isnum(m)||m<=0)return say('<b>Quel montant ?</b><br>Dis par exemple « Ajoute une dépense de 25 euros carburant ».','o'),true;
  const cat=has(/carburant|essence|gasoil|plein/)?'Carburant':has(/photo|materiel/)?'Matériel photo':has(/cintres?|emballage|carton|sachet|scotch/)?'Cintres et emballage':has(/abonnement/)?'Abonnement':'Autre',id='dep_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  app.depSave({id,date:today(),montant:Math.round(m*100)/100,cat,note:''});lastUndo=()=>app.depRemove(id);app.toast('Dépense enregistrée',()=>app.depRemove(id));
  const msg=`Dépense de ${fN(m)} euros, ${cat}`;return ok_(`<b>${msg}.</b>`,msg)}
 /* ajouter une pièce : on ouvre le formulaire déjà rempli */
 if(has(/\b(ajoute|ajouter|nouvelle piece|nouveau|nouvelle|cree|creer)\b/)&&!has(/depense/)){
  const s={entree:today()};if(o.brand)s.marque=o.brand;if(o.cat)s.cat=o.cat;if(o.size)s.taille=o.size;if(o.color)s.coul=[o.color];if(isnum(pr))s.achat=pr;
  closeSheet();go('add');app.addForm.reset(s,true);return ok_(`<b>Formulaire prérempli</b> : ${esc(specTxt(o)||'nouvelle pièce')}${isnum(pr)?' · '+esc(fN(pr))+' € d\'achat':''}.<br><small>Complète le reste puis ajoute.</small>`,'Formulaire prérempli')}
 /* publier */
 if(has(/\b(publie|publiee|publiees|publier|mis en ligne|mise en ligne|en ligne)\b/)&&!has(/vendu|combien|quel/))
  return target(o,app.P.filter(p=>avail(p)&&!ok(p.pub)),p=>changePiece(p,{pub:today()},'Publié : '+title(p)+(p.taille?' '+p.taille:'')),say);
 /* indisponible / de retour en stock */
 if(has(/\b(remets?|remise|rends?|redevient|de nouveau)\b.*\b(en stock|disponible)\b/))return target(o,app.P.filter(p=>p.statut==='Pas Disponible'),p=>changePiece(p,{statut:'Disponible'},'Remis en stock : '+title(p)),say);
 if(has(/\b(indisponible|pas disponible|plus disponible|retire|retirer)\b/)&&!has(/vendu/))return target(o,app.P.filter(avail),p=>changePiece(p,{statut:'Pas Disponible'},'Indisponible : '+title(p)),say);
 /* bac */
 const bm=/\bbac\s+([a-z0-9]{1,6})\b/.exec(n);
 if(bm&&has(/\b(range|ranger|mets|met|mettre|place|placer|classe|classer)\b/)){const bac=bm[1].toUpperCase();return target(o,app.P.filter(p=>!sold(p)),p=>changePiece(p,{bac},title(p)+' rangé dans le bac '+bac),say)}
 /* prix visé */
 if(has(/\b(prix|baisse|baisser|monte|monter|augmente|augmenter)\b/)&&!has(/vendu|vends|combien|quel/)){
  if(!isnum(pr)||pr<=0)return say('<b>Quel prix ?</b><br>Dis par exemple « Baisse le prix du Nike gris M à 12 euros ».','o'),true;
  return target(o,app.P.filter(avail),p=>changePiece(p,{pvise:pr},'Prix visé de '+title(p)+' : '+fN(pr)+' euros'),say)}
 /* colis prêt */
 if(has(/\bcolis\b/)&&has(/\b(pret|prete|prepare|prepares|expedie|expedies|envoye|poste|depose)\b/)){
  const pool=colisList();if(!pool.length)return say('<b>Aucun colis à préparer.</b>','o'),true;
  if(!hasSpec(o)&&has(/\b(tous|toutes|tout)\b/)){const old=pool.map(p=>Object.assign({},p));pool.forEach(p=>app.save(Object.assign({},p,{exp:today()})));lastUndo=()=>old.forEach(p=>app.save(p));const msg=pool.length+' colis prêts';return ok_(`<b>${msg}.</b>`,msg)}
  return target(o,pool,p=>changePiece(p,{exp:today()},'Colis prêt : '+title(p)+(p.bac?', bac '+p.bac:'')),say)}
 /* questions chiffrées */
 if(has(/\b(combien|quel|quelle|quels|quelles|c est quoi|donne moi)\b/)){const a=answer(n);if(a)return ok_(`<b>${esc(a)}</b>`,a)}
 /* ouvrir un outil */
 if(open.test(n)){const hit=TOOLW.find(([,r])=>r.test(n));if(hit){closeSheet();app.openTool(hit[0]);return true}}
 return false}
function runVoice(text){const o=parseVoice(text),out=$('vc_out');if(!out)return;
 const say=(h,cls)=>{out.innerHTML=`<div class="vres ${cls||''}">${h}</div>`};
 pending=null;
 if(o.intent==='undo'){if(lastUndo){lastUndo();lastUndo=null;speak('Annulé');return say('<b>Annulé</b> : la dernière action est défaite.','g')}return say('Rien à annuler.','o')}
 if(command(o,say))return;
 if(o.intent==='unknown'||(!o.brand&&!o.cat&&!o.color&&!o.size&&!o.code))return say(`<b>Je n'ai pas compris.</b><br>Essaie : « Vendu, Tommy bleu L, 18 euros, Vinted ».`,'o');
 const pool=o.intent==='sell'?app.P.filter(avail):app.P,m=voiceMatch(o,pool);
 if(o.intent==='where'){if(!m.length)return say('<b>Aucune pièce trouvée.</b>','o');const p=m[0];speak(p.bac?'Bac '+p.bac:'Pas de bac renseigné');return say(`<b>${esc(title(p))}${p.taille?' · '+esc(p.taille):''}</b><br>${p.bac?'Bac <b>'+esc(p.bac)+'</b>':'Pas de bac renseigné'} · ${esc(p.code||'')}${m.length>1?`<br><small>${m.length-1} autre${m.length>2?'s':''} pièce${m.length>2?'s':''} correspondante${m.length>2?'s':''}</small>`:''}`,'g')}
 if(o.intent==='search'){const q=[o.brand,o.cat,o.color,o.size].filter(Boolean).join(' ');closeSheet();go('list');$('q').value=q;app.filt='Disponible';app.renderList();return}
 if(!m.length)return say(`<b>Aucune pièce en stock ne correspond</b> à « ${esc([o.brand,o.cat,o.color,o.size].filter(Boolean).join(' '))} ».`,'o');
 const same=m.every(p=>nrm(p.marque)===nrm(m[0].marque)&&p.cat===m[0].cat&&p.taille===m[0].taille&&(p.coul||[]).join()===(m[0].coul||[]).join());
 if(m.length===1||same){const p=m[0];if(!isnum(o.price)&&!priceFor(p))return say(`<b>${esc(title(p))}</b> : je n'ai pas entendu le prix. Redis-le, par exemple « Vendu, Tommy bleu L, 18 euros ».`,'o');const msg=voiceSell(p,o);return say(`<b>${esc(msg)}</b>${m.length>1?`<br><small>${m.length} pièces identiques : j'ai pris la plus ancienne.</small>`:''}`,'g')}
 choose(m,p=>voiceSell(p,o))}
export function openVoice(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 showSheet(sheetHead('Commande vocale')+`<div class="card" style="text-align:center"><button type="button" class="micbig" id="vc_mic" aria-label="Parler">${TI('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>')}</button><div id="vc_st" class="hint" style="margin:8px 0">${SR?'Touche le micro et parle.':'Le micro n\'est pas disponible dans ce navigateur : écris la commande ci-dessous.'}</div>
  <div class="hint">« Vendu, Tommy bleu L, 18 euros, Vinted » · « Range le Nike gris M dans le bac B3 » · « Combien j'ai gagné ce mois-ci ? » · « Annule »</div>
  <details class="xdet" style="text-align:left;margin-top:8px"><summary>Tout ce que je comprends</summary>${HELP.map(([k,v])=>`<p style="margin:8px 0 0"><b>${k}</b><br><small>${esc(v)}</small></p>`).join('')}</details>
  <div class="pwrow" style="margin-top:12px"><input type="text" id="vc_t" placeholder="Ou écris ta commande" autocomplete="off"><button type="button" class="btn sm" id="vc_go">OK</button></div></div><div id="vc_out"></div>`);
 let rec=null;const st=m=>{$('vc_st').textContent=m};
 const start=()=>{if(!SR)return $('vc_t').focus();try{rec=new SR();rec.lang='fr-FR';rec.interimResults=true;rec.maxAlternatives=1;let fin='';
  rec.onstart=()=>{$('vc_mic').classList.add('on');st('J\'écoute…')};rec.onerror=e=>{$('vc_mic').classList.remove('on');st(e.error==='not-allowed'?'Accès au micro refusé.':'Je n\'ai rien entendu, réessaie.')};
  rec.onresult=e=>{let t='';for(const r of e.results){t+=r[0].transcript;if(r.isFinal)fin=t}$('vc_t').value=t;st('« '+t+' »')};
  rec.onend=()=>{$('vc_mic').classList.remove('on');const t=fin.trim();if(t){$('vc_t').value=t;runVoice(t)}};rec.start()}catch(e){st('Micro indisponible')}};
 $('vc_mic').onclick=()=>{if(rec&&$('vc_mic').classList.contains('on')){rec.stop();return}start()};
 $('vc_go').onclick=()=>{const t=$('vc_t').value.trim();if(t)runVoice(t)};$('vc_t').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const t=$('vc_t').value.trim();if(t)runVoice(t)}};
 $('vc_out').onclick=e=>{const b=e.target.closest('[data-vc]');if(!b||!pending)return;const p=pending.list[+b.dataset.vc];if(!p)return;const msg=pending.act(p);pending=null;speak(msg);$('vc_out').innerHTML=`<div class="vres g"><b>${esc(msg)}</b></div>`};
 if(SR)setTimeout(start,250)}
$('mic').onclick=openVoice;
