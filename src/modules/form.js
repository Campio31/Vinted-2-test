import { app } from '../state.js';
import { $, andJoin, dj, esc, eur, num, pad } from './core.js';
import { hydrate, phImg, savePhoto } from './photos.js';
import { setPotBg } from './nav.js';

/* ---------- aides de saisie ---------- */
export function freq(f,arr){const c=new Map();app.P.forEach(p=>{const v=arr?(p[f]||[]):[p[f]];v.forEach(x=>{if(x&&x!=='Aucun'&&x!=='Aucune')c.set(x,(c.get(x)||0)+1)})});return[...c.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0])}
export function subsOf(cat){const c=new Map();app.P.forEach(p=>{if(p.cat===cat&&p.sub)c.set(p.sub,(c.get(p.sub)||0)+1)});return[...c.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0])}
const MARQUES0=['Nike','Adidas','Levis','Tommy','Ralph Lauren','Lacoste','Champion','Carhartt','The North Face','Puma','Reebok','Under Armour','Jordan','Kappa','Fila','Umbro','New Balance','Columbia','Calvin Klein','Hugo Boss','Diesel','Guess','Gap','Dickies','Wrangler','Lee','Vans','Converse','Zara','H&M','Jack & Jones','Uniqlo','Superdry','Napapijri','Nautica','Starter','Russell'];
const sortFr=a=>[...a].sort((x,y)=>String(x).localeCompare(String(y),app.LOC,{sensitivity:'base',numeric:true}));
export const allBrands=()=>{const seen=new Set();return sortFr([...freq('marque'),...MARQUES0].filter(b=>{const k=b.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}))};
export const recentBrands=()=>{const used=freq('marque').filter(b=>!/^Non (renseigné|Identifié)$/i.test(b)).slice(0,8),seen=new Set(used.map(b=>b.toLowerCase()));return sortFr([...used,...MARQUES0.filter(b=>!seen.has(b.toLowerCase()))])};
export function lev(a,b){a=a.toLowerCase();b=b.toLowerCase();const d=[];for(let i=0;i<=a.length;i++)d[i]=[i];for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]==b[j-1]?0:1));return d[a.length][b.length]}
function suggestBrand(v){v=(v||'').trim();if(v.length<3)return null;const all=allBrands();if(all.some(b=>b.toLowerCase()===v.toLowerCase()))return null;let best=null,bd=3;for(const b of all){const d=lev(v,b);if(d<bd&&d<=Math.max(1,Math.floor(b.length/4))){bd=d;best=b}}return best}
function canon(v){v=(v||'').trim();return allBrands().find(b=>b.toLowerCase()===v.toLowerCase())||v}
const L=(x,n)=>String(x==null?'':x).slice(0,n);
const mod=p=>(p.modele==null||p.modele===''?'0':String(p.modele));
export const combo=p=>[p.cat,p.sub,p.marque,mod(p),p.grade].join('\u0001');
/* Le code garde son numéro tant que son début (catégorie, type, marque, modèle, grade) ne change pas, majuscules ou non.
   Un nouveau code prend le plus grand numéro existant pour ce début, plus un : jamais de doublon. */
export function genCode(p){if(!p.cat||!p.sub||!p.marque||!p.grade)return undefined;const pre=L(p.cat,2)+L(p.sub,3)+L(p.marque,2)+L(mod(p),3)+L(p.grade,1),pl=pre.toLowerCase()+'-',others=app.P.filter(q=>q.id!==p.id&&q.code);
 if(p.code&&p.code.toLowerCase().startsWith(pl)&&!others.some(q=>q.code.toLowerCase()===p.code.toLowerCase()))return p.code;
 let n=0;others.forEach(q=>{if(q.code.toLowerCase().startsWith(pl)){const k=parseInt(q.code.slice(pl.length),10);if(k>n)n=k}});return pre+'-'+pad(n+1,3)}

/* ---------- formulaire (ajout et modification) ---------- */
const SIZES=['XS','S','M','L','XL','XXL','3XL'],NUM=['32','34','36','38','40','42','44','46','48','50'];
const SIZES_CAT={Pantalon:NUM,RobeJupe:[...SIZES,'34','36','38','40','42','44'],Autres:[...SIZES,'TU']};
export const sizesFor=cat=>{const base=SIZES_CAT[cat]||SIZES,used=cat?[...app.P.filter(p=>p.cat===cat&&p.taille).reduce((m,p)=>m.set(p.taille,(m.get(p.taille)||0)+1),new Map())].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,8):[];return mrg(base,used)};
export const PROV0=['Pawpick','Frip','Providence','Vide grenier'],GEN=['Homme','Femme','Enfant','Les deux'],GRADES=['A','B','C'];
export const DH=[['ep','Épaule à épaule'],['ai','Aisselle à aisselle'],['lo','Longueur du vêtement'],['ma','Longueur des manches']],DB=[['ta','Largeur à la taille'],['lp','Longueur du pantalon']],DK=[...DH,...DB].map(x=>x[0]);
const HAUT=['Tshirt','Sweat','Chemise','Polo','Veste','Maillot'],BAS=['Pantalon','Short'];
export const CATS0=['Tshirt','Sweat','Chemise','Pantalon','Veste','Short','Polo','Maillot','RobeJupe','Autres'];
export const SUBS0={Short:['Sport','Jeans'],Tshirt:['T-Imprimé','T-Unis','T-Rayures'],Sweat:['Rond Col Pull','V Col Pull','Sweat à capuche','Pull demi-zip','Pull Col Roulé','Survetements','Veste'],Pantalon:['Droite','Slim','Skinny','Super skinny','Bootcut'],Veste:['Blouson','Doudoune','Blazers','Bomber','Manteau long','Coupe-vent','Parka','Polaire','Cabans','Duffle-Coat','Blouson Teddy','Perfecto','Jeans','Chemise','Survetement'],Maillot:['Football','Basket'],Chemise:['C-Unis','C-Carreaux','C-Rayures','C-Motifs','C-Tie&Dye','C-Jeans'],Polo:['P-Unis','P-Rayures','P-Motifs'],RobeJupe:['Robe de soirée','Longueur Genou','Mini jupe','Sweat'],Autres:['Cardigan','Sac à main','Pyjama']};
const MAT0=['Coton','Polyester','Laine','Nylon','Viscose','Lyocell','Elasthanne','Acrylique','Lin','Cachemire','Alpage','Cuir'];
const COUL0=['Bleu','Noir','Blanc','Gris','Rouge','Vert','Beige','Violet','Marron','Rose','Jaune','Orange','Bleu marine','Kaki','Bordeaux','Moutarde','Corail','Turquoise','Multicolore'];
/* état général (un seul choix) et défauts précis (plusieurs choix) : on sait ainsi exactement ce que le vêtement a */
export const ETAT0=['Neuf avec étiquette','Neuf sans étiquette','Très bon état','Bon état','Satisfaisant'];
export const DEFAUTS=['Tache légère','Grosse tache','Usure aux coudes ou genoux','Bouloches','Décoloration','Fil tiré','Couture défaite','Petit trou','Déchirure','Bouton manquant','Fermeture cassée','Cordon manquant','Rétrécit','Odeur'];
const MADEIN0=['Afghanistan','Afrique du Sud','Albanie','Algérie','Allemagne','Andorre','Angola','Antigua-et-Barbuda','Arabie saoudite','Argentine','Arménie','Australie','Autriche','Azerbaïdjan','Bahamas','Bahreïn','Bangladesh','Barbade','Belgique','Belize','Bénin','Bhoutan','Biélorussie','Birmanie','Bolivie','Bosnie-Herzégovine','Botswana','Brésil','Brunei','Bulgarie','Burkina Faso','Burundi','Cambodge','Cameroun','Canada','Cap-Vert','Chili','Chine','Chypre','Colombie','Comores','Congo','Corée du Nord','Corée du Sud','Costa Rica','Côte d\'Ivoire','Croatie','Cuba','Danemark','Djibouti','Dominique','Égypte','Émirats arabes unis','Équateur','Érythrée','Espagne','Estonie','Eswatini','États-Unis','Éthiopie','Fidji','Finlande','France','Gabon','Gambie','Géorgie','Ghana','Grèce','Grenade','Groenland','Guatemala','Guinée','Guinée-Bissau','Guinée équatoriale','Guyana','Haïti','Honduras','Hong Kong','Hongrie','Îles Marshall','Inde','Indonésie','Irak','Iran','Irlande','Islande','Israël','Italie','Jamaïque','Japon','Jordanie','Kazakhstan','Kenya','Kirghizistan','Kiribati','Kosovo','Koweït','Laos','Lesotho','Lettonie','Liban','Liberia','Libye','Liechtenstein','Lituanie','Luxembourg','Macao','Macédoine du Nord','Madagascar','Malaisie','Malawi','Maldives','Mali','Malte','Maroc','Maurice','Mauritanie','Mexique','Micronésie','Moldavie','Monaco','Mongolie','Monténégro','Mozambique','Namibie','Nauru','Népal','Nicaragua','Niger','Nigeria','Norvège','Nouvelle-Zélande','Oman','Ouganda','Ouzbékistan','Pakistan','Palaos','Palestine','Panama','Papouasie-Nouvelle-Guinée','Paraguay','Pays-Bas','Pérou','Philippines','Pologne','Porto Rico','Portugal','Qatar','République centrafricaine','République dominicaine','République tchèque','Roumanie','Royaume-Uni','Russie','Rwanda','Saint-Christophe-et-Niévès','Saint-Marin','Saint-Vincent-et-les-Grenadines','Sainte-Lucie','Salomon','Salvador','Samoa','Sao Tomé-et-Principe','Sénégal','Serbie','Seychelles','Sierra Leone','Singapour','Slovaquie','Slovénie','Somalie','Soudan','Soudan du Sud','Sri Lanka','Suède','Suisse','Suriname','Syrie','Taïwan','Tadjikistan','Tanzanie','Tchad','Thaïlande','Timor oriental','Togo','Tonga','Trinité-et-Tobago','Tunisie','Turkménistan','Turquie','Tuvalu','Ukraine','Uruguay','Vanuatu','Vatican','Venezuela','Vietnam','Yémen','Zambie','Zimbabwe','UK','USA','Taiwan'];
globalThis.MADEIN0 = MADEIN0;
export const mrg=(a,b)=>[...new Set([...(a||[]),...(b||[])])];
const dimsFor=cat=>HAUT.includes(cat)?DH:BAS.includes(cat)?DB:[...DH,...DB];
/* Groupes dans l'ordre de saisie : un seul est ouvert au départ (la catégorie), le suivant s'ouvre quand le précédent est rempli. */
/* 4 étapes guidées ; dans chaque étape, un paramètre à la fois (Suivant / Passer). L'ordre suit l'ordre d'affichage de chaque étape. */
const STEPS=[['Article',['cat','sub','marque','genre']],['Caractéristiques',['taille','coul','mat','dim','madein']],['État',['grade','photo','etat']],['Achat et gestion',['achat','prov','stk','ballot','dates','det']]];
const ORDER=STEPS.flatMap(s=>s[1]);
const stepOf=k=>STEPS.findIndex(s=>s[1].includes(k));
const isNeuf=e=>/^neuf/i.test(e||'');
export const COLORS={Bleu:['#2F6FDE','#fff'],Noir:['#1A1A1A','#fff'],Blanc:['#FFFFFF','#17233B'],Gris:['#8A8F98','#fff'],Rouge:['#D32F2F','#fff'],Vert:['#2E9E5B','#fff'],Beige:['#D8C3A5','#17233B'],Violet:['#7E57C2','#fff'],Marron:['#7B4A2D','#fff'],Rose:['#F48FB1','#17233B'],Jaune:['#F5C518','#17233B'],Orange:['#F57C00','#17233B'],'Bleu marine':['#1B2A57','#fff'],Kaki:['#7A7A3A','#fff'],Bordeaux:['#6E1A2C','#fff'],Moutarde:['#D9A21B','#17233B'],Corail:['#F26B5B','#17233B'],Turquoise:['#1BB5B0','#17233B'],Multicolore:['conic-gradient(#D32F2F,#F5C518,#2E9E5B,#2F6FDE,#7E57C2,#D32F2F)','#17233B']};
export const abc=a=>[...a].sort((x,y)=>String(tv(x)).localeCompare(String(tv(y)),app.LOC,{sensitivity:'base',numeric:true}));
export function mkForm(host,S,o){
 const edit=o.mode==='edit';
 let G=new Set(edit?ORDER:['cat']),errs={},newField=null,focusKey=null,curStep=0;
 const chip=(f,v,on,sm)=>{let cls='chip'+(on?' on':'')+(sm?' sm':''),st='',inner=esc(tv(v));
  if(f==='grade')cls+=' g-'+v;
  if(f==='coul'&&COLORS[v]){cls+=' cl';st=` style="--c:${COLORS[v][0]};--ct:${COLORS[v][1]}"`;inner='<i class="sw"></i>'+inner}
  return`<button type="button" class="${cls}"${st} data-f="${f}" data-v="${esc(v)}">${inner}</button>`};
 const group=(f,vals,multi,allowNew)=>{const cur=multi?(S[f]||[]):[S[f]];const set=[...vals];cur.forEach(c=>{if(c&&!set.includes(c))set.unshift(c)});
  return`<div class="chips" data-g="${f}" ${multi?'data-multi="1"':''}>${set.map(v=>chip(f,v,cur.includes(v))).join('')}${allowNew?(newField===f?`<input type="text" class="newin" data-n="${f}" placeholder="${t('Nouveau…')}" style="width:150px">`:`<button type="button" class="chip add" data-new="${f}">${t('+ autre')}</button>`):''}</div>`};
 const hasSub=()=>!!(S.cat&&(mrg(SUBS0[S.cat],subsOf(S.cat)).length||S.sub));
 function advance(k){if(edit||ORDER.indexOf(k)<0)return;G.delete(k);let i=ORDER.indexOf(k)+1;if(ORDER[i]==='sub'&&!hasSub())i++;if(ORDER[i]==='stk'&&!app.hasComptes())i++;const n=ORDER[i];if(n){G.add(n);focusKey=n}}
 function potHTML(){const p=app.potential(S),mq=(S.marque||'').trim();let lvl='n',tt=t('Choisis une catégorie'),tag='',rows='',note=t('Le potentiel de vente apparaît d\'après tes ventes passées.'),l2='';
  const row=(lab,s)=>`<div class="pr2"><span>${esc(lab)}</span><b>${s.n?tn(s.n,'vente','ventes')+(s.dm!==null?' · '+dj(s.dm):'')+(s.pm!==null?' · '+eur(s.pm):''):t('aucune vente')}</b></div>`;
  if(S.cat){
   rows=(mq&&p.E?row(mq+' · '+tv(S.cat),p.E)+row(t('Marque {m}',{m:mq}),p.B):'')+row(t('Catégorie {c}',{c:tv(S.cat)}),p.C);
   if(!p.ok){tt=t('Pas assez de données');note=t('Il faut au moins 3 ventes comparables pour estimer.')}
   else{lvl=p.lvl;tt=(p.basis==='exact'?{g:t('Fort'),o:t('Moyen'),r:t('Faible')}:{g:t('Probablement fort'),o:t('Moyen'),r:t('Probablement faible')})[p.lvl];tag={exact:t('fiable'),indic:t('indicatif'),cat:t('catégorie seule')}[p.basis];
    note=p.basis==='exact'?t('Basé sur les ventes de cette marque dans cette catégorie, délai médian {n} j.',{n:Math.round(p.dm)}):p.basis==='indic'?t('Estimation indicative : trop peu de ventes de cette combinaison. Elle retient le délai le plus lent des lectures qui ont au moins 3 ventes ({n} j) et n\'annonce « fort » que si la marque et la catégorie le confirment.',{n:Math.round(p.dm)}):t('Saisis la marque pour une estimation plus précise. Basé sur la catégorie seule ({n} j).',{n:Math.round(p.dm)})}
   if(p.stock>0){const cr=[t('catégorie')];if(mq)cr.unshift(t('marque'));if(S.taille)cr.push(t('taille'));
    l2=(p.stock>=3?t('Attention : '):'')+t('déjà {n} en stock (même {c})',{n:p.stock,c:andJoin(cr)})}}
  setPotBg(lvl);
  /* prix de vente conseillé : l'appli le propose, on ne le saisit plus */
  const ra=S.cat?app.advice(S):null,recoRow=ra&&ra.ok&&ra.reco>0?`<div class="pr2 reco"><span>${t('Prix de vente conseillé')}</span><b>${eur(ra.reco)}</b></div>`:'';
  return`<div class="pot pot-${lvl}${p.stock>=3?' sat':''}" id="pot"><div class="pt"><span class="mono">${t('potentiel de vente')}${tag?' · '+esc(tag):''}</span><b>${esc(tt)}</b></div>${rows}${recoRow}<div class="ps">${esc(note)}</div>${l2?`<div class="ps w">${esc(l2)}</div>`:''}</div>`} function updatePot(){const e=host.querySelector('#pot');if(!e)return;const t=document.createElement('div');t.innerHTML=potHTML();e.replaceWith(t.firstChild)}
 /* les étapes suivent les onglets de saisie, dans l'ordre : l'étape en cours est le premier onglet ouvert, les précédents sont faits ou passés */
 const stepKeys=n=>STEPS[n][1].filter(k=>(k!=='sub'||hasSub())&&(k!=='stk'||app.hasComptes()));
 function progHTML(){const L=stepKeys(curStep),i=L.findIndex(k=>G.has(k));
  return`<div class="prog stps"><div class="steps">${STEPS.map(([l],n)=>`<button type="button" class="stb${n===curStep?' cur':n<curStep?' done':''}" data-step="${n}"${n===curStep?' aria-current="step"':''}><b>${n<curStep?'✓':n+1}</b><span>${t(l)}</span></button>`).join('')}</div><div class="mono">${t('étape {a} sur {b}',{a:curStep+1,b:STEPS.length})} · ${t(STEPS[curStep][0])}${i>=0?' · '+(i+1)+' / '+L.length:''}</div></div>`}
 function updateRenta(){const el=host.querySelector('#rp');if(!el)return;const a=num(S.achat),v=num(S.pvise);
  if(isNaN(a)||isNaN(v)||v<=0){el.innerHTML='<div class="hint">'+t('Saisis le prix d\'achat et le prix de vente visé pour voir la marge.')+'</div>';return}
  const fr=app.defFrais(v,'Vinted'),r=app.renta(a,v,fr,app.estDelai(S,v));el.innerHTML=`<div class="pv">${app.rentaHTML(r)}<div class="hint" style="margin-top:6px">${esc(t('Frais comptés : {f} (emballage, envoi et commission d\'après tes réglages)',{f:eur(fr)}))}</div></div>`}
 function cprev(){const e=host.querySelector('#cdp');if(!e)return;const c=genCode(Object.assign({},S,{id:S.id||'_new'}));e.textContent=c?t('Code : {c}',{c}):t('Code : renseigne catégorie, type, marque et grade')}
 function draw(){
  if(o.onChange)Promise.resolve().then(()=>o.onChange(S));
  const cats=mrg(CATS0,freq('cat')),subs=S.cat?mrg(SUBS0[S.cat],subsOf(S.cat)):[],sizes=sizesFor(S.cat),provs=[...new Set([...PROV0,...freq('prov')])];
  const sizesSorted=sizes.sort((a,b)=>{const ia=SIZES.indexOf(a),ib=SIZES.indexOf(b);if(ia>=0&&ib>=0)return ia-ib;if(ia>=0)return-1;if(ib>=0)return 1;return String(a).localeCompare(String(b),'fr',{numeric:true})});
  const rb=recentBrands(),sug=suggestBrand(S.marque);
  const dimN=DK.filter(k=>S[k]!=null&&S[k]!=='').length,detN=['modele','collab','bac','note'].filter(k=>Array.isArray(S[k])?S[k].length:S[k]).length,nDef=isNeuf(S.etat)?0:(S.defauts||[]).length,nDates=[S.entree,S.pub].filter(Boolean).length;
  const sums={cat:tv(S.cat),sub:tv(S.sub),marque:S.marque,taille:S.taille,genre:tv(S.genre),achat:S.achat!==''&&S.achat!=null&&num(S.achat)>=0?eur(num(S.achat)):'',prov:tv(S.prov),coul:(S.coul||[]).map(x=>tv(x)).join(', '),mat:(S.mat||[]).map(x=>tv(x)).join(', '),photo:S.photo?t('Ajoutée'):'',dim:dimN?tn(dimN,'valeur','valeurs'):'',etat:[S.etat&&tv(S.etat),nDef?tn(nDef,'défaut','défauts'):''].filter(Boolean).join(' · '),ballot:S.ballot||'',madein:S.madein?cn(S.madein):'',dates:nDates?tn(nDates,'date','dates'):'',det:detN?tn(detN,'renseigné','renseignés'):''};
  /* l'étape affichée est celle du premier paramètre ouvert */
  if(!edit){const i0=ORDER.findIndex(k=>G.has(k)&&(k!=='sub'||hasSub())&&(k!=='stk'||app.hasComptes()));if(i0>=0)curStep=stepOf(ORDER[i0])}
  const sec=(k,label,body,opt)=>{if(!edit&&stepOf(k)!==curStep)return'';opt=opt||{};const op=G.has(k),sm=opt.sumHtml!==undefined?opt.sumHtml:esc(sums[k]||'');
   return`<div class="grp${op?' open':''}${errs[k]?' err':''}" data-sec="${k}"><button type="button" class="gh" data-tg="${k}" aria-expanded="${op}"><span class="l">${t(label)}</span><span class="gs">${sm}${sm?'<i class="ckm"></i>':''}</span><span class="gc" aria-hidden="true"></span></button>${op?`<div class="gb">${body}${opt.next&&!edit?`<div class="acts" style="margin-top:12px"><button type="button" class="btn sec sm" data-next="${k}">${t(opt.next)} ›</button></div>`:''}</div>`:''}</div>`};
  host.innerHTML=(edit?'':progHTML())+
   sec('cat','Catégorie',group('cat',cats,false,true))+
   (hasSub()?sec('sub','Type',group('sub',subs,false,true)):'')+
   sec('marque','Marque',`${rb.length?`<div class="chips" style="margin-bottom:8px">${rb.map(b=>chip('marque',b,S.marque===b,true)).join('')}</div>`:''}
    <input type="text" id="fm" list="dlm" placeholder="${t('Taper la marque')}" value="${esc(S.marque)}" autocomplete="off" autocapitalize="words"><datalist id="dlm">${allBrands().map(b=>`<option value="${esc(b)}">`).join('')}</datalist>
    <div class="sug" id="sg">${sug?`<button type="button" class="chip sm" data-sug="${esc(sug)}">${esc(t('Tu voulais dire {m} ?',{m:sug}))}</button>`:''}</div>`,{next:'Suivant'})+
   sec('taille','Taille',group('taille',sizesSorted,false,true))+
   sec('genre','Genre',group('genre',GEN,false,false))+
   sec('grade','Grade',group('grade',GRADES,false,false),{sumHtml:S.grade?`<span class="pill g-${esc(S.grade)}">${esc(S.grade)}</span>`:''})+
   sec('achat',"Prix d'achat",`<div class="price"><input type="text" inputmode="decimal" id="fa" placeholder="0${app.DS}00" value="${S.achat!=null&&S.achat!==''?esc(String(S.achat).replace('.',app.DS)):''}"><span>€</span></div>`,{next:'Suivant'})+
   sec('prov','Provenance',group('prov',provs,false,true))+
   (app.hasComptes()?sec('stk','Compte',`<div class="chips" data-g="stk">${app.comptes().map(c=>`<button type="button" class="chip${S.stk===c.id?' on':''}" data-f="stk" data-v="${esc(c.id)}">${esc(c.n)}</button>`).join('')}</div><div class="hint">${t('Le compte où tu comptes vendre cette pièce : tu pourras ranger ton stock par compte.')}</div>`,{next:'Passer',sumHtml:esc((app.comptes().find(c=>c.id===S.stk)||{}).n||'')}):'')+
   sec('coul','Couleur',group('coul',mrg(COUL0,freq('coul',1)),true,true),{next:'Passer'})+
   sec('mat','Matière',group('mat',mrg(MAT0,freq('mat',1)),true,true),{next:'Passer'})+
   sec('photo','Photo (facultatif)',`<div class="photo">${S.photo?phImg(S.photo):''}<span class="btn sec sm filebtn">${t('Prendre une photo')}<input type="file" accept="image/*" capture="environment" class="fph" aria-label="${t('Prendre une photo')}"></span><span class="btn sec sm filebtn">${t('Choisir une image')}<input type="file" accept="image/*" class="fph" aria-label="${t('Choisir une image')}"></span>${S.photo?'<button type="button" class="btn sec sm" data-rmph="1">'+t('Retirer')+'</button>':''}</div><div class="hint" id="phs"></div>`,{next:'Passer'})+
   sec('dim','Dimensions (cm)',`<div class="row2">${dimsFor(S.cat).map(([k,l])=>`<div><div class="l">${t(l)}</div><input type="text" inputmode="decimal" data-d="${k}" value="${S[k]!=null&&S[k]!==''?esc(String(S[k]).replace('.',app.DS)):''}" placeholder="cm"></div>`).join('')}</div>`,{next:'Suivant'})+
   sec('etat','État et défauts',`<div class="l">${t('État général')}</div>${group('etat',ETAT0,false,false)}
    ${isNeuf(S.etat)?`<div class="hint">${t('Vêtement neuf : pas de défauts à indiquer.')}</div>`:`<div class="l">${t('Défauts du vêtement')}</div>${group('defauts',mrg(DEFAUTS,freq('defauts',1)),true,true)}`}`,{next:'Suivant'})+
   sec('ballot','Ballot',group('ballot',abc(freq('ballot')),false,true),{next:'Passer'})+
   sec('madein','Made in',`<input type="text" data-k="madein" list="dlmi" value="${esc(cn(S.madein))}" placeholder="${t('Pays')}"><datalist id="dlmi">${abc(mrg(MADEIN0,freq('madein'))).map(b=>`<option value="${esc(cn(b))}">`).join('')}</datalist>`,{next:'Passer'})+
   sec('dates','Dates',`<div class="row2"><div><div class="l">${t('Date d\'entrée')}</div><input type="date" data-k="entree" value="${esc(S.entree)}"></div><div><div class="l">${t('Date de publication')}</div><input type="date" data-k="pub" value="${esc(S.pub)}"></div></div>`,{next:'Passer'})+
   sec('det','Plus de détails',`<div class="l">${t('Bac (emplacement)')}</div>${group('bac',abc(freq('bac')),false,true)}
    <div class="l">${t('Modèle')}</div><input type="text" data-k="modele" value="${esc(S.modele)}">
    <div class="l">${t('Collab / équipe')}</div><input type="text" data-k="collab" list="dlc" value="${esc(S.collab&&!/^Aucun/.test(S.collab)?S.collab:'')}"><datalist id="dlc">${freq('collab').map(b=>`<option value="${esc(b)}">`).join('')}</datalist>
    <div class="l">${t('Note')}</div><textarea data-k="note" rows="2">${esc(S.note)}</textarea>`)+
   (edit?'':potHTML())+`<div class="hint" id="cdp"></div>
  <div class="acts">${edit?`<button type="button" class="btn" id="fok">${t('Enregistrer')}</button><button type="button" class="btn sec" id="fcancel">${t('Retour')}</button>`:`<button type="button" class="btn" id="fok">${t('Ajouter')}</button><button type="button" class="btn sec" id="fdup">${t('Ajouter et dupliquer')}</button><button type="button" class="btn sec" id="fclear"${dirty()?'':' disabled'}>${t('Annuler la saisie')}</button>`}</div>`;
  const nf=host.querySelector('.newin');if(nf)nf.focus();
  cprev();updateRenta();hydrate();
  if(focusKey){const el=host.querySelector(`[data-sec="${focusKey}"]`);focusKey=null;if(el)el.scrollIntoView({block:'nearest',behavior:'smooth'})}
 }
 host.addEventListener('click',e=>{
  const c=e.target.closest('button');if(!c)return;
  if(c.dataset.step!==undefined){const n=+c.dataset.step,L=stepKeys(n);G=new Set([L[0]]);curStep=n;focusKey=L[0];draw();return}
  if(c.dataset.tg){const k=c.dataset.tg;if(G.has(k))G.delete(k);else G.add(k);draw();return}
  if(c.dataset.next){advance(c.dataset.next);draw();return}
  if(c.dataset.f){const f=c.dataset.f,v=c.dataset.v,multi=c.parentNode.dataset.multi;
   if(multi){const a=S[f]||[];S[f]=a.includes(v)?a.filter(x=>x!==v):[...a,v]}
   else{S[f]=S[f]===v?'':v;if(f==='cat')S.sub='';if(f==='etat'&&isNeuf(S.etat))S.defauts=[];if(S[f]&&f!=='etat')advance(f)}
   delete errs[f];draw();return}
  if(c.dataset.usereco){S.pvise=Number(c.dataset.usereco);S._vt=1;draw();return}
  if(c.dataset.rmph){S.photo='';draw();return}
  if(c.dataset.new){newField=c.dataset.new;draw();return}
  if(c.dataset.sug){S.marque=c.dataset.sug;delete errs.marque;advance('marque');draw();return}
  if(c.id==='fok')submit(false);
  if(c.id==='fdup')submit(true);
  if((c.id==='fcancel'||c.id==='fclear')&&o.onCancel)o.onCancel();
 });
 function addNew(inp){const f=inp.dataset.n,v=inp.value.trim();if(newField!==f)return;newField=null;if(v){if(['mat','coul','defauts'].includes(f)){const a=S[f]||[];if(!a.includes(v))S[f]=[...a,v]}else{S[f]=v;if(f==='cat')S.sub='';advance(f)}}draw()}
 host.addEventListener('keydown',e=>{
  if(e.target.classList.contains('newin')&&e.key==='Enter'){e.preventDefault();addNew(e.target);return}
  if(e.key==='Enter'&&e.target.id==='fm'){e.preventDefault();S.marque=e.target.value;if(S.marque.trim()){delete errs.marque;advance('marque');draw()}}
  if(e.key==='Enter'&&e.target.id==='fa'){e.preventDefault();if(num(S.achat)>=0){delete errs.achat;advance('achat');draw()}}
  if(e.key==='Enter'&&e.target.id==='fv'){e.preventDefault();advance('renta');draw()}});
 host.addEventListener('focusout',e=>{if(e.target.classList&&e.target.classList.contains('newin'))addNew(e.target)});
 host.addEventListener('input',e=>{const t=e.target;
  if(t.id==='fm'){S.marque=t.value;delete errs.marque;updatePot();const s=suggestBrand(t.value);$('sg').innerHTML=s?`<button type="button" class="chip sm" data-sug="${esc(s)}">Tu voulais dire ${esc(s)} ?</button>`:''}
  else if(t.id==='fa'){const v=t.value.replace(',','.');S.achat=v===''?'':v;delete errs.achat;updatePot()}
  else if(t.id==='fv'){const v=t.value.replace(',','.');S.pvise=v;S._vt=1;updateRenta()}
  else if(t.dataset.d){S[t.dataset.d]=t.value.replace(',','.')}
  else if(t.dataset.k){S[t.dataset.k]=t.dataset.k==='madein'?cnFr(t.value):t.value}
  cprev();if(o.onChange)o.onChange(S)});
 async function doPhoto(f){const st=$('phs');st.textContent=t('Enregistrement de la photo…');try{S.photo=await savePhoto(f);advance('photo');draw()}catch(er){st.textContent=t('Photo non enregistrée ({e}).',{e:(er&&(er.message||er.code))||t('erreur')})}}
 host.addEventListener('change',e=>{const t=e.target;
  if(t.classList&&t.classList.contains('fph')){const f=t.files&&t.files[0];t.value='';if(f)doPhoto(f);return}
  if(t.dataset.k==='etat'||t.dataset.k==='entree'||t.dataset.k==='pub')S[t.dataset.k]=t.value;
  cprev();if(o.onChange)o.onChange(S)});
 /* première étape pas encore remplie : c'est là que s'ouvre un brouillon repris */
 function emptyFirst(){const L=['cat','sub','marque','taille','genre','grade','achat','prov'].filter(k=>k!=='sub'||hasSub());const f=k=>k==='achat'?(S.achat!==''&&S.achat!=null&&num(S.achat)>=0):k==='marque'?!!(S.marque||'').trim():!!S[k];return L.find(k=>!f(k))||'photo'}
 /* vrai dès qu'un champ est rempli (la date d'entrée par défaut ne compte pas) : le bouton Annuler la saisie s'active */
 function dirty(){return Object.keys(S).some(k=>k!=='entree'&&k[0]!=='_'&&(Array.isArray(S[k])?S[k].length>0:S[k]!==''&&S[k]!=null&&S[k]!==false))}
 function submit(dup){
  errs={};const a=num(S.achat);
  if(!S.cat)errs.cat=1;if(!(S.marque||'').trim())errs.marque=1;if(!(a>=0))errs.achat=1;
  if(Object.keys(errs).length){if(!edit)G=new Set();Object.keys(errs).forEach(k=>G.add(k));draw();const el=host.querySelector('.grp.err');if(el)el.scrollIntoView({block:'center',behavior:'smooth'});return}
  DK.forEach(k=>{const v=num(S[k]);S[k]=v>0?v:''});
  if(isNeuf(S.etat))S.defauts=[];
  const pvv=num(S.pvise);S.pvise=pvv>0?pvv:'';
  S.marque=app.canonVal('marque',canon(S.marque));['collab','prov','ballot','madein'].forEach(k=>{if(S[k])S[k]=app.canonVal(k,S[k])});S.achat=Math.round(a*100)/100;o.onSubmit(S,dup);
 }
 draw();
 return{draw,reset(ns,resume){S=ns;errs={};G=new Set(edit?ORDER:[resume?emptyFirst():'cat']);draw()},get state(){return S},get dirty(){return dirty()}};
}
