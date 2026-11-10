import { app } from '../state.js';
import { $, LSg, LSs, age, avail, clean, days, fd, isnum, ok, profit, sold, today } from './core.js';
import { setSync, tx } from './storage.js';
import { phBlob } from './photos.js';
import { STAT } from './stock-view.js';
import { stats } from './dashboard.js';
import { CFG0, DEVICE_KEYS, syncCfg } from './settings-core.js';
import { renderBk } from './backup.js';
import { renderCfg } from './settings-costs.js';

app.renderSet = renderSet;
app.saveFile = saveFile;
app.exportJSON = exportJSON;
app.importText = importText;

/* ---------- export / import ---------- */
export function renderSet(){app.renderSync();app.renderAccount();app.renderLang();app.renderTheme();renderCfg();if(app.renderComptes)app.renderComptes();if(app.renderConfort)app.renderConfort();if(app.renderRules)app.renderRules();if(app.renderHelp)app.renderHelp();renderBk();const n=app.P.length,lb=LSg('lastBackup','');$('xs').textContent=(n?t('{n} dans les fichiers.',{n:tn(n,'pièce','pièces')}):t('Aucune pièce à exporter pour le moment.'))+(lb?' '+t('Dernière sauvegarde JSON : {d}.',{d:fd(lb)}):' '+t('Aucune sauvegarde JSON faite pour l\'instant : les données sont stockées uniquement sur cet appareil.'));}
async function saveFile(name,data,type){
 const blob=data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});
 try{const f=new File([blob],name,{type:blob.type});if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return true}}catch(e){if(e&&e.name==='AbortError')return false}
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);app.toast(t('Fichier téléchargé : {f}',{f:name}));return true}
function sheet(head,rows,types,widths){const ws=XLSX.utils.aoa_to_sheet([head].concat(rows),{cellDates:true});ws['!cols']=widths.map(w=>({wch:w}));
 rows.forEach((r,i)=>types.forEach((t,c)=>{const k=ws[XLSX.utils.encode_cell({r:i+1,c})];if(k){if(t==='e')k.z='#,##0.00 "€"';if(t==='d')k.z='dd/mm/yyyy'}}));return ws}
const D=s=>ok(s)?new Date(s+'T12:00:00'):'';
function xlsx(){
 const st=app.P.filter(x=>!sold(x)).sort((a,b)=>(a.code||'').localeCompare(b.code||'')),so=app.P.filter(sold).sort((a,b)=>(a.dv||'').localeCompare(b.dv||''));
 const wb=XLSX.utils.book_new();
 const w1=sheet(['Code','Statut','Catégorie','Type','Marque','Modèle','Taille','Genre','Grade','État','Provenance','Ballot','Date d\'entrée','Jours en stock','Prix d\'achat','Note'].map(h=>t(h)),st.map(x=>[x.code||'',t(STAT[x.statut]||x.statut),tv(x.cat||''),tv(x.sub||''),x.marque||'',x.modele||'',x.taille||'',tv(x.genre||''),x.grade||'',tv(x.etat||''),tv(x.prov||''),x.ballot||'',D(x.entree),ok(x.entree)?age(x):'',x.achat==null?'':x.achat,x.note||'']),['s','s','s','s','s','s','s','s','s','s','s','s','d','n','e','s'],[16,10,12,14,16,10,8,9,7,22,12,14,12,12,12,30]);
 const n1=st.length+2;w1['N'+n1]={t:'s',v:t('Total')};w1['O'+n1]={t:'n',f:`SUM(O2:O${n1-1})`,v:st.reduce((a,x)=>a+(x.achat||0),0),z:'#,##0.00 "€"'};w1['!ref']=`A1:P${n1}`;
 const w2=sheet(['Code','Catégorie','Type','Marque','Taille','Provenance','Date d\'entrée','Prix d\'achat','Date de vente','Plateforme','Prix de vente','Frais','Bénéfice net','Délai (jours)'].map(h=>t(h)),so.map(x=>[x.code||'',tv(x.cat||''),tv(x.sub||''),x.marque||'',x.taille||'',tv(x.prov||''),D(x.entree),x.achat||0,D(x.dv),tv(x.canal||'Vinted'),x.pv||0,x.frais||0,'','']),['s','s','s','s','s','s','d','e','d','s','e','e','e','n'],[16,12,14,16,8,12,12,12,12,13,12,10,13,12]);
 so.forEach((x,i)=>{const r=i+2;w2['M'+r]={t:'n',f:`K${r}-H${r}-L${r}`,v:profit(x),z:'#,##0.00 "€"'};if(ok(x.dv)&&ok(x.entree))w2['N'+r]={t:'n',f:`I${r}-G${r}`,v:days(x.entree,x.dv)}});
 const n2=so.length+2,S=stats(so);w2['G'+n2]={t:'s',v:t('Total')};[['H',S.cost],['K',S.ca],['L',S.fr],['M',S.ben]].forEach(([c,v])=>w2[c+n2]={t:'n',f:`SUM(${c}2:${c}${n2-1})`,v,z:'#,##0.00 "€"'});w2['!ref']=`A1:N${n2}`;
 const stC=st.filter(avail).reduce((a,x)=>a+(x.achat||0),0);
 const rs=[[t('Indicateur'),t('Valeur')],[t('Pièces vendues'),S.n],[t('Chiffre d\'affaires'),S.ca],[t('Coût d\'achat des pièces vendues'),S.cost],[t('Frais de vente'),S.fr],[t('Bénéfice net'),S.ben],[t('Marge nette'),S.marge],[t('Panier moyen'),S.panier],[t('Délai avant la vente (jours)'),+S.delai.toFixed(1)],[t('Pièces en stock'),app.P.filter(avail).length],[t('Argent immobilisé dans le stock'),stC],[],[t('Par mois'),t('Ventes'),t('Chiffre d\'affaires'),t('Bénéfice net')]];
 const mm={};so.forEach(x=>{const m=(x.dv||'').slice(0,7);const g=mm[m]=mm[m]||{n:0,ca:0,b:0};g.n++;g.ca+=x.pv||0;g.b+=profit(x)});Object.keys(mm).sort().forEach(m=>rs.push([m,mm[m].n,mm[m].ca,mm[m].b]));
 const w3=XLSX.utils.aoa_to_sheet(rs);w3['!cols']=[{wch:36},{wch:14},{wch:20},{wch:16}];
 [3,4,5,6,8,11].forEach(r=>{const k=w3['B'+r];if(k)k.z='#,##0.00 "€"'});if(w3['B7'])w3['B7'].z='0.0%';for(let r=14;r<=rs.length;r++){['C','D'].forEach(c=>{if(w3[c+r])w3[c+r].z='#,##0.00 "€"'})}
 XLSX.utils.book_append_sheet(wb,w1,t('Stock'));XLSX.utils.book_append_sheet(wb,w2,t('Ventes'));XLSX.utils.book_append_sheet(wb,w3,t('Résumé'));
 return XLSX.write(wb,{type:'array',bookType:'xlsx'})}
$('xx').onclick=()=>{if(!app.P.length)return app.toast(t('Aucune pièce à exporter'));if(typeof XLSX==='undefined')return app.toast(t('Le module Excel n\'a pas pu se charger'));saveFile('stock-et-ventes-'+today()+'.xlsx',new Blob([xlsx()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))};
const toDataURL=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
async function exportJSON(){if(!app.P.length)return app.toast(t('Aucune pièce à sauvegarder'));$('xs').textContent=t('Préparation de la sauvegarde…');
 const photos={};for(const p of [...app.P,...app.DEP]){if(p.photo&&!photos[p.photo]){try{const b=await phBlob(p.photo);if(b)photos[p.photo]=await toDataURL(b)}catch(e){}}}
 const ok_=await saveFile('sauvegarde_'+today()+'.json',JSON.stringify({pieces:app.P.map(p=>{const q=Object.assign({},p);delete q.ex;return q}),settings:syncCfg(),depenses:app.DEP,photos},null,1),'application/json');
 if(ok_){LSs('lastBackup',today())}renderSet()}
$('xj').onclick=exportJSON;
export async function bulkPut(l,s,photos){app.importing=true;
 for(const id in photos){try{let b=await (await fetch(photos[id])).blob();if(b.size>130000){try{const nb=await app.compressBlob(b);if(nb.size<b.size)b=nb}catch(e){}}await tx('photos','readwrite',st=>st.put({id,blob:b}))}catch(e){}}
 l.forEach(x=>{const i=app.P.findIndex(y=>y.id===x.id);if(i<0)app.P.push(x);else app.P[i]=x});
 app.renderAll();setSync('pend');
 try{await tx('pieces','readwrite',st=>{l.forEach(x=>st.put(x))});await app.queueMany(l.map(x=>x.id),Object.keys(photos));setSync('ok')}catch(e){setSync('err');throw e}finally{app.importing=false}
 app.renderAll()}
/* Une sauvegarde contient aussi les réglages (objectifs, coûts, plateformes…) : on les remet, sauf ceux propres à l'appareil.
   Une valeur vide dans la sauvegarde n'efface jamais un réglage déjà rempli ici. */
const vide=v=>v==null||v===''||v===0||(Array.isArray(v)&&!v.length)||(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length);
export function restoreSettings(j){const st=j&&!Array.isArray(j)?j.settings:null;if(!st||typeof st!=='object'||Array.isArray(st))return 0;
 const o={};Object.keys(CFG0).forEach(k=>{if(k==='_ts'||DEVICE_KEYS.includes(k)||st[k]===undefined)return;if(vide(st[k])&&!vide(app.cfg[k]))return;o[k]=st[k]});
 if(!Object.keys(o).length)return 0;app.setCfg(o);app.scheduleRender();return Object.keys(o).length}
export async function importText(txt){const s=$('is');let j;try{j=JSON.parse(txt)}catch(e){s.textContent=t('Ce texte n\'est pas un JSON valide. Vérifie les virgules et les guillemets.');return}
 const rows=Array.isArray(j)?j:Array.isArray(j&&j.pieces)?j.pieces:Array.isArray(j&&j.items)?j.items:null;if(!rows){s.textContent=t('Je cherche une liste « pieces » dans ce fichier.');return}
 const photos=(j&&!Array.isArray(j)&&j.photos&&typeof j.photos==='object')?j.photos:{};
 const l=rows.filter(p=>p&&typeof p==='object'&&p.id&&(p.cat||p.marque)).map(p=>{const q=clean(p);if(q.photo&&!photos[q.photo])delete q.photo;q.id=String(q.id).replace(/[^A-Za-z0-9_.~:@+-]/g,'_').slice(0,100);if(!['Disponible','Vendu','Pas Disponible'].includes(q.statut))q.statut='Disponible';if(q.statut==='Vendu'&&!isnum(q.pv))q.statut='Pas Disponible';return q});
 if(!l.length){s.textContent=t('Aucune pièce valide (il faut un identifiant et une catégorie ou une marque).');return}
 s.textContent=t('Import en cours…');
 try{await bulkPut(l,s,photos)}catch(err){s.textContent=t('Import interrompu : {e}. Relance-le, les pièces déjà enregistrées seront simplement remplacées.',{e:err&&err.message||t('erreur')});return}
 if(j&&Array.isArray(j.depenses))for(const d of j.depenses){if(d&&d.id&&app.isDep(d.id))app.depSave(d)}
 const restored=restoreSettings(j);
 const ign=rows.length-l.length,n=l.length;s.textContent=tn(n,'pièce importée','pièces importées')+(ign?' · '+tn(ign,'ligne ignorée','lignes ignorées'):'')+(restored?' · '+t('réglages et objectifs restaurés'):'')+'.';app.toast(tn(n,'pièce importée','pièces importées'));$('impt').value=''}
$('impo').onclick=()=>app.openTool('importo');
$('impb').onclick=()=>{const t=$('impt').value.trim();if(!t){$('is').textContent=window.t('Colle d\'abord ton JSON, ou choisis un fichier.');return}importText(t)};
$('imp').onchange=async e=>{const f=e.target.files[0];if(!f)return;await importText(await f.text());e.target.value=''};
$('impm').onclick=()=>saveFile('modele-import-stock.json',JSON.stringify({pieces:[{id:'i0001',code:'ShSpoSt0A-001',cat:'Short',sub:'Sport',marque:'Starter',taille:'M',genre:'Homme',grade:'A',achat:4.5,prov:'Pawpick',coul:['Bleu'],mat:['Polyester'],etat:'RAS',entree:'2026-08-23',statut:'Disponible'},{id:'i0002',cat:'Tshirt',sub:'T-Imprimé',marque:'Pokémon',taille:'L',genre:'Homme',grade:'A',achat:2.49,prov:'Providence',entree:'2026-08-24',statut:'Vendu',pv:8,dv:'2026-09-07',canal:'Vinted'}],settings:{}},null,1),'application/json');
