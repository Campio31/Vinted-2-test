import { app } from '../state.js';
import { $, LSg, LSs, age, avail, dj, esc, eur, idn, isnum, profit, sold, title } from './core.js';
import { hydrate, phImg } from './photos.js';
import { activeChips, activeCount, facet, filterLabel, openFilters } from './filters.js';

app.renderList = renderList;

/* ---------- filtres du Stock (fenêtre « Filtres », voir filters.js) ---------- */
const ADVK = ['cat', 'genre', 'taille', 'marque', 'bac', 'age', 'photo', 'stk', 'grp'];
const adv = Object.assign({ cat: '', genre: '', taille: '', marque: '', bac: '', age: '', photo: '', stk: '', grp: '', tri: '' }, LSg('stockAdv', {}));
const AGEB = { 30: a => a < 30, 90: a => a >= 30 && a < 90, 91: a => a >= 90 };
/** Compte de stock d'une pièce : son id, ou 'none' si elle n'en a pas (ou si le compte n'existe plus). */
const stkOf = p => (app.hasComptes() && p.stk && app.comptes().some(c => c.id === p.stk)) ? p.stk : 'none';
app.advMatch = p => (!adv.cat || p.cat === adv.cat) && (!adv.genre || p.genre === adv.genre) && (!adv.taille || p.taille === adv.taille) && (!adv.marque || p.marque === adv.marque) && (!adv.bac || p.bac === adv.bac)
  && (!adv.age || AGEB[adv.age](age(p))) && (!adv.photo || (adv.photo === 'sans' ? !p.photo : !!p.photo)) && (!adv.stk || stkOf(p) === adv.stk);
const advSave = () => { const o = Object.assign({}, adv); delete o.st; LSs('stockAdv', o); };
function openStockFilters() {
  const S = () => app.P.filter(p => !sold(p));
  adv.st = app.filt;
  openFilters({
    title: t('Filtres du stock'), state: adv,
    groups: () => {
      const L = S();
      return [
        { k: 'st', l: t('Statut'), o: ['Tous', 'Disponible', 'Apub', 'Enligne', 'Pas Disponible', 'Incomplet'].map(k => [k, t(app.FLAB[k] || STAT[k]), L.filter(p => app.matchFiltK(p, k)).length]) },
        { k: 'cat', l: t('Catégorie'), o: facet(L, p => p.cat).map(([v, n]) => [v, tv(v), n]) },
        { k: 'genre', l: t('Genre'), o: facet(L, p => p.genre).map(([v, n]) => [v, tv(v), n]) },
        { k: 'taille', l: t('Taille'), o: facet(L, p => p.taille).map(([v, n]) => [v, v, n]) },
        { k: 'marque', l: t('Marque'), o: facet(L, p => p.marque).map(([v, n]) => [v, v, n]) },
        { k: 'bac', l: t('Bac'), o: facet(L, p => p.bac).map(([v, n]) => [v, v, n]) },
        { k: 'age', l: t('En stock depuis'), o: [['30', t('Moins de 30 jours')], ['90', t('30 à 90 jours')], ['91', t('Plus de 90 jours')]] },
        ...(app.hasComptes() ? [
          { k: 'stk', l: t('Compte'), o: [...app.comptes().map(c => [c.id, c.n, L.filter(p => stkOf(p) === c.id).length]), ['none', t('Sans compte'), L.filter(p => stkOf(p) === 'none').length]].filter(o => o[2] > 0 || o[0] !== 'none') },
          { k: 'grp', l: t('Organiser'), o: [['stk', t('Regrouper par compte')]] },
        ] : []),
        { k: 'photo', l: t('Photo'), o: [['sans', t('Sans photo')], ['avec', t('Avec photo')]] },
        { k: 'tri', l: t('Trier par'), o: [['old', t('Plus anciennes d\'abord')], ['achatD', t('Prix d\'achat, du plus cher')], ['achatA', t('Prix d\'achat, du moins cher')], ['pub', t('En ligne depuis le plus longtemps')]] },
      ].filter(g => g.o.length);
    },
    changed: () => { app.filt = adv.st || 'Tous'; app.lim = 60; advSave(); renderList(); },
    count: () => S().filter(p => app.matchFilt(p)).length,
    clear: () => { ADVK.concat('tri').forEach(k => { adv[k] = ''; }); adv.st = 'Tous'; },
  });
}

/* ---------- vue Stock ---------- */
export const STAT={Disponible:'En stock',Vendu:'Vendus','Pas Disponible':'Indispo'};
const tagOf=p=>p.statut==='Vendu'?'<span class="tag v">'+t('Vendu')+'</span>':p.statut==='Pas Disponible'?'<span class="tag x">'+t('Indispo')+'</span>':'<span class="tag">'+t('Stock')+'</span>';
function renderList(){
 /* l'onglet Stock ne montre que le stock : les pièces vendues sont dans l'onglet Vente */
 if(app.filt==='Vendu')app.filt='Tous';
 const stock=app.P.filter(p=>!sold(p)),nAdv=activeCount(adv,ADVK)+(app.filt!=='Tous'?1:0);
 /* seuls « Tous » et « Filtres » restent à l'écran (plus « Sélection », ajoutée par selection.js) : statut, catégorie, marque… sont dans la fenêtre Filtres */
 $('flt').innerHTML=`<button class="chip sm${nAdv?'':' on'}" type="button" data-flt="Tous">${t('Tous')} · ${stock.length}</button>`+`<button type="button" class="chip sm fbtn${nAdv?' on':''}" data-fadv="1">${filterLabel(nAdv)}</button><span class="vt"><button type="button" data-lm="grid" aria-label="${t('Grille')}"${lmode==='grid'?' class="on"':''}><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg></button><button type="button" data-lm="list" aria-label="${t('Liste')}"${lmode==='list'?' class="on"':''}><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></span>`;
 $('lst').className=lmode==='grid'?'grid':'';
 if(!app.P.length){$('lst').innerHTML=`<div class="card empty"><b>${app.loaded?t('Ton stock est vide'):t('Chargement…')}</b>${app.loaded?'<br>'+t('Ajoute ta première pièce depuis l\'onglet Ajouter, importe ta sauvegarde (onglet Export), ou charge quelques exemples.')+'<br><button class="btn" id="exb" type="button">'+t('Charger des exemples')+'</button>':''}</div>`;if($('exb'))$('exb').onclick=app.loadExamples;return}
 const q=$('q').value.trim().toLowerCase();
 const toks=app.searchToks(q),sco=new Map();let ps=stock.filter(p=>{if(!app.matchFilt(p))return false;if(!toks.length)return true;const s=app.searchScore(p,toks);if(s<0)return false;sco.set(p.id,s);return true});
 const TRI={old:(a,b)=>(a.entree||'').localeCompare(b.entree||''),achatD:(a,b)=>(b.achat||0)-(a.achat||0),achatA:(a,b)=>(a.achat||0)-(b.achat||0),pub:(a,b)=>(a.pub||'9').localeCompare(b.pub||'9')}[adv.tri];
 const stkOrder=app.hasComptes()?[...app.comptes().map(c=>c.id),'none']:[],byStk=adv.grp==='stk'&&stkOrder.length;
 ps.sort((a,b)=>(byStk?stkOrder.indexOf(stkOf(a))-stkOrder.indexOf(stkOf(b)):0)||(toks.length?sco.get(b.id)-sco.get(a.id):0)||(TRI?TRI(a,b):0)||(app.filt==='Vendu'?(b.dv||'').localeCompare(a.dv||''):0)||(b.entree||'').localeCompare(a.entree||'')||(b.cree||0)-(a.cree||0)||idn(b.id)-idn(a.id));
 const tot=ps.length,full=ps;ps=ps.slice(0,app.lim);
 /* titre de groupe quand le stock est rangé par compte */
 const hd=i=>{if(!byStk)return'';const k=stkOf(ps[i]);if(i&&stkOf(ps[i-1])===k)return'';return`<h3 class="stkh">${esc(k==='none'?t('Sans compte'):(app.comptes().find(c=>c.id===k)||{}).n||'')} · ${full.filter(x=>stkOf(x)===k).length}</h3>`};
 /* ligne « N résultats » avec un bouton pour effacer la recherche */
 const srh=q?`<div class="hint srh" style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 4px"><span>${t(tot>1?'{n} résultats pour « {q} »':'{n} résultat pour « {q} »',{n:tot,q:esc($('q').value.trim())})}</span><button type="button" class="lnk" id="q_clr">${t('Effacer')}</button></div>`:'';
 const act=activeChips(Object.assign({},adv,{st:app.filt!=='Tous'?app.filt:''}),['st'].concat(ADVK),{st:v=>t(app.FLAB[v]||STAT[v]),cat:v=>tv(v),genre:v=>tv(v),taille:v=>t('Taille {s}',{s:v}),bac:v=>t('Bac {b}',{b:v}),age:v=>({30:t('Moins de 30 jours'),90:t('30 à 90 jours'),91:t('Plus de 90 jours')})[v],photo:v=>v==='sans'?t('Sans photo'):t('Avec photo'),stk:v=>v==='none'?t('Sans compte'):((app.comptes().find(c=>c.id===v)||{}).n||v),grp:()=>t('Regroupé par compte')});
 $('lst').innerHTML=act+srh+(ps.length?ps.map((p,i)=>hd(i)+(p=>{if(lmode==='grid')return app.pieceTile(p,app.qSel===p.id);if(avail(p))return app.pieceRow(p,app.qSel===p.id);const a=age(p),pr=sold(p)?`<div class="p ${profit(p)>=0?'g':'b'}">${profit(p)>=0?'+':''}${eur(profit(p))}<small>${t('vendu {p}',{p:eur(p.pv)})}</small></div>`:`<div class="p">${isnum(p.achat)?eur(p.achat):''}<small>${avail(p)?dj(a):''}</small></div>`;
  return`<button type="button" class="li" data-id="${esc(p.id)}">${p.photo?phImg(p.photo,'th'):`<div class="th">${catSvg(p)}</div>`}<div class="m"><b>${esc(title(p))}${p.ex?'<span class="ex">'+t('exemple')+'</span>':''}</b><small>${esc([p.taille,tv(p.cat),tv(p.genre)].filter(Boolean).join(' · '))} ${tagOf(p)}</small></div>${pr}</button>`})(p)).join('')+(tot>app.lim?`<button type="button" class="btn sec" id="more">${t('Afficher plus ({n})',{n:tot-app.lim})}</button>`:''):'<div class="empty">'+t('Aucune pièce.')+'</div>');
 hydrate();
}
let lmode=LSg('lmode','grid');
export const PASTEL={Bleu:['#CFE0FF','#2B5CFF'],Noir:['#E3E5EA','#4b5568'],Gris:['#E3E5EA','#4b5568'],Blanc:['#F1F1F1','#6b6f78'],Rouge:['#FFD9D6','#b3261e'],Orange:['#FFE3D2','#c2551f'],Vert:['#D9F2E6','#256b4a'],Rose:['#F9DDEB','#b3366b'],Violet:['#E6DDF7','#5b3fa8'],Jaune:['#FFF1BF','#8a6a00'],Beige:['#F0E6D6','#7a6040'],Marron:['#EBDDD0','#6b4423']};
const PASTEL0=[['#CFE0FF','#2B5CFF'],['#E3E5EA','#4b5568'],['#FFE3D2','#c2551f'],['#D9F2E6','#256b4a']];
export const pastel=p=>PASTEL[(p.coul||[])[0]]||PASTEL0[[...(p.cat||'x')].reduce((a,c)=>a+c.charCodeAt(0),0)%PASTEL0.length];
/* icône du vêtement selon la catégorie (utilisée quand il n'y a pas de photo) */
const ICONS={
 tshirt:'<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
 polo:'<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3-2 3h-2z"/><path d="M12 6.5V11"/><path d="M10 3.2 12 6.5l2-3.3"/>',
 chemise:'<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3"/><path d="M8 3l4 4 4-4"/><path d="M12 7v14"/><path d="M12 11h.01M12 15h.01M12 19h.01"/>',
 sweat:'<path d="M9 3 5 5 2 14l3.2 1L6 11.5V21h12v-9.5l.8 3.5 3.2-1-3-9-4-2"/><path d="M9 3c.5 3.5 5.5 3.5 6 0"/><path d="M9.5 16h5"/>',
 veste:'<path d="M8 3 3 5.5 2 20h5V9"/><path d="M16 3l5 2.5L22 20h-5V9"/><path d="M8 3l4 4 4-4"/><path d="M7 9h10v12H7z"/><path d="M12 7v14"/>',
 pantalon:'<path d="M7 3h10l1.5 18h-5L12 10l-1.5 11h-5z"/><path d="M7 6.5h10"/>',
 short:'<path d="M6 5h12l1.5 12h-6L12 10.5 10.5 17h-6z"/><path d="M6 8.5h12"/>',
 maillot:'<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3"/><path d="M9.5 3.3 12 7l2.5-3.7"/><path d="M12 12v4"/>',
 robe:'<path d="M9 3l1 5-3 13h10l-3-13 1-5"/><path d="M10 8h4"/>',
 chaussures:'<path d="M3 16c0-2.3 1.2-3.4 3-3.4l2-4.2 3 2 2 1c3 .6 6 2 7 4.200V18H3z"/><path d="M3 18h18"/>',
 sac:'<path d="M5 8h14l1 13H4z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
 cintre:'<path d="M12 7a2.5 2.5 0 1 0-2.5-2.5"/><path d="M12 7v2L3 16.500h18L12 9"/>'};
function iconKey(p){const c=app.nrm(p.cat),s=app.nrm(p.sub);
 if(/sac/.test(s)||/sac|accessoire/.test(c))return'sac';if(/chaussure|basket|sneaker|botte/.test(c))return'chaussures';
 if(/tshirt|tee/.test(c))return'tshirt';if(/polo/.test(c))return'polo';if(/chemise/.test(c)||/cardigan/.test(s))return'chemise';
 if(/sweat|pull|hoodie/.test(c))return'sweat';if(/veste|manteau|blouson|doudoune/.test(c))return'veste';
 if(/pantalon|jean|jogging/.test(c))return'pantalon';if(/short/.test(c))return'short';if(/maillot/.test(c))return'maillot';
 if(/robe|jupe/.test(c))return'robe';if(/pyjama/.test(s))return'tshirt';return'cintre'}
export const catSvg=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[iconKey(p)]}</svg>`;
export const fmtP=v=>Number.isInteger(v)?v+' €':app.fN(v)+' €';

$('flt').onclick=e=>{if(e.target.closest('[data-fadv]'))return openStockFilters();const m=e.target.closest('[data-lm]');if(m){lmode=m.dataset.lm;LSs('lmode',lmode);app.qSel=null;app.renderList();return}const b=e.target.closest('[data-flt]');if(b){app.filt=b.dataset.flt;if(app.filt==='Tous'){ADVK.concat('tri').forEach(k=>{adv[k]=''});advSave()}app.lim=60;app.renderList()}};
$('q').oninput=()=>{app.lim=60;app.renderList()};
$('lst').onclick=e=>{const fc=e.target.closest('[data-fclr]');if(fc){if(fc.dataset.fclr==='*'){ADVK.forEach(k=>{adv[k]=''});app.filt='Tous'}else if(fc.dataset.fclr==='st')app.filt='Tous';else adv[fc.dataset.fclr]='';advSave();app.lim=60;renderList();return}if(e.target.closest('#q_clr')){$('q').value='';app.lim=60;app.renderList();return}if(e.target.closest('#more')){app.lim+=60;app.renderList();return}if(app.sellClick(e,app.renderList))return;const b=e.target.closest('[data-id]');if(b)app.openSheet(b.dataset.id)};
