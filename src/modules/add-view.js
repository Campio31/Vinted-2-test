import { app } from '../state.js';
import { $, LSg, LSs, age, avail, eurR, nextId, ok, today } from './core.js';
import { genCode, mkForm } from './form.js';

/* ---------- vue Ajouter ---------- */
/* Le formulaire démarre toujours vide : aucune valeur n'est présélectionnée (seule la date d'entrée vaut aujourd'hui) */
function freshState(){return{entree:today()}}
/* Brouillon : la saisie en cours est gardée sur l'appareil (si le téléphone ferme l'appli pendant une photo, on la retrouve) */
const DRAFT='addDraft';let dT=null;
function saveDraft(){clearTimeout(dT);dT=setTimeout(()=>{const f=app.addForm;if(!f)return;if(f.dirty){const o={};Object.keys(f.state).forEach(k=>{if(k[0]!=='_')o[k]=f.state[k]});LSs(DRAFT,o)}else{try{localStorage.removeItem(DRAFT)}catch(e){}}},300)}
export function initAdd(){
 app.addForm=mkForm($('fadd'),freshState(),{mode:'add',onChange:saveDraft,onCancel(){
  const snap=Object.assign({},app.addForm.state);
  app.addForm.reset(freshState());
  app.toast(t('Saisie effacée'),()=>app.addForm.reset(snap));
  window.scrollTo({top:0,behavior:'smooth'});
 },onSubmit(S,dup){
  const p=Object.assign({},S,{id:nextId(),statut:'Disponible',cree:Date.now()});if(!p.entree)p.entree=today();
  p.code=genCode(p);if(p.collab==='')delete p.collab;
  const sv=app.save(p);
  app.toast(t('Ajouté ✓ · {n} en stock',{n:app.P.filter(avail).length}),()=>{app.remove(sv.id);app.toast(t('Annulé'))});
  app.addForm.reset(dup?Object.assign({},S,{photo:'',id:undefined,code:undefined}):freshState(S));
  window.scrollTo({top:0,behavior:'smooth'});
 }});
 restoreDraft();
}
/* à l'ouverture de l'appli : reprend la saisie interrompue */
export function restoreDraft(){
 const d=LSg(DRAFT,null);
 if(d&&typeof d==='object'&&!Array.isArray(d)){app.addForm.reset(Object.assign({},d,{entree:today()}),true);
  if(app.addForm.dirty)app.toast(t('Saisie reprise'),()=>app.addForm.reset(freshState()),6000);else app.addForm.reset(freshState())}
}
