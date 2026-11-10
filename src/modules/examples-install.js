import { app } from '../state.js';
import { $, addDays, clean, nextId, today } from './core.js';
import { persist, tx } from './storage.js';
import { genCode } from './form.js';

app.loadExamples = loadExamples;

/* ---------- exemples ---------- */
function loadExamples(){
 const E=[['Pantalon','Droite',"Levis",'W30','Homme','A',6,'Frip',70,'v',26,24,'Vinted',2],['Sweat','Rond Col Pull','Nike','M','Homme','B',5,'Pawpick',66,'v',22,20,'TikTok Live',3],['Robe','Fleurie','Zara','S','Femme','A',4,'Frip',58,'v',18,16,'Vinted',0],['Veste','Blouson','Carhartt','L','Homme','B',22,'Frip',52],['Chaussures','Samba','Adidas','40','Homme','A',18,'Vide grenier',47,'v',55,35,'Vinted',4],['Polo','P-Unis','Ralph Lauren','L','Homme','A',5,'Pawpick',40],['Sweat','V Col Pull','Tommy','M','Homme','B',6,'Pawpick',34,'v',25,22,'TikTok Live',2],['Polo','P-Unis','Lacoste','M','Homme','B',7,'Frip',30],['Veste','Doudoune','The North Face','M','Homme','A',45,'Frip',26],['Sweat','Sweat à capuche','Champion','L','Homme','B',4,'Pawpick',20,'v',24,14,'TikTok Live',3],['Pantalon','Slim',"Levis",'W32','Homme','A',12,'Providence',14],['Chemise','C-Unis','Ralph Lauren','M','Homme','A',3,'Pawpick',9],['Tshirt','T-Imprimé','Pokémon','L','Homme','A',2.5,'Providence',6],['Short','Sport','Nike','M','Homme','A',4.5,'Pawpick',3]];
 E.forEach(e=>{const[cat,sub,marque,taille,genre,grade,achat,prov,ago,v,pv,dv,canal,frais]=e;const entree=addDays(today(),-ago);
  const p={id:nextId(),cat,sub,marque,taille,genre,grade,achat,prov,entree,statut:'Disponible',ex:true};p.code=genCode(p);
  if(v){p.statut='Vendu';p.pv=pv;p.dv=addDays(entree,Math.min(ago-1,dv));p.canal=canal;p.frais=frais}
  app.P.unshift(clean(p))});
 const added=app.P.slice(0,E.length);app.renderAll();persist(async()=>{await tx('pieces','readwrite',s=>{added.forEach(p=>s.put(p))});await app.queueMany(added.map(p=>p.id),[])});app.toast(t('Exemples chargés'))}

/* ---------- installation ---------- */
let deferred=null;
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(!standalone)$('inst').hidden=false});
$('instb').onclick=async()=>{if(!deferred)return;deferred.prompt();try{await deferred.userChoice}catch(e){}deferred=null;$('inst').hidden=true};
window.addEventListener('appinstalled',()=>{$('inst').hidden=true});
if(!standalone&&/iphone|ipad|ipod/i.test(navigator.userAgent)){$('inst').hidden=false;$('insth').textContent=t('Sur iPhone et iPad : touche le bouton Partager de Safari, puis « Sur l\'écran d\'accueil ».');$('instb').hidden=true}
