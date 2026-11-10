import { app } from '../state.js';

/* sans page (fin d'un test, onglet fermé), une écriture qui se termine en retard ne plante pas */
export const $=id=>typeof document==='undefined'?null:document.getElementById(id);
/* langue : t() traduit un texte français (clé), tv() une valeur enregistrée, tn() gère le pluriel ; le français reste la langue de référence (voir i18n.js) */
app.LANG = detectLang();
app.LOC = undefined;
let eurF;
let eur0;
app.DS = ',';
export function fmtInit(){I18N.lang=app.LANG;app.LOC=I18N.LOCS[app.LANG];eurF=new Intl.NumberFormat(app.LOC,{style:'currency',currency:'EUR'});eur0=new Intl.NumberFormat(app.LOC,{style:'currency',currency:'EUR',maximumFractionDigits:0});app.DS=(1.5).toLocaleString(app.LOC).charAt(1);document.documentElement.lang=app.LANG}
fmtInit();
export const eur=v=>eurF.format(v||0),eurR=v=>eur0.format(v||0);
export const dj=n=>t('{n} j',{n:Math.round(n)});
export const andJoin=a=>a.length>1?a.slice(0,-1).join(', ')+' '+t('et')+' '+a[a.length-1]:(a[0]||'');
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isnum=x=>typeof x==='number'&&isFinite(x);
export const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:NaN};
export const pad=(n,k)=>String(n).padStart(k,'0');
export const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1,2)+'-'+pad(d.getDate(),2)};
export const ok=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
export const days=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
export const addDays=(d,n)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10);
export const fd=s=>ok(s)?new Date(s+'T12:00:00').toLocaleDateString(app.LOC,{day:'2-digit',month:'2-digit',year:'numeric'}):'';
export const LSg=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},LSs=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};

app.P = [];
app.view = 'add';
app.filt = 'Disponible';
app.period = 90;
app.lim = 60;
app.importing = false;
app.loaded = false;
app.addForm = null;
app.IDB = null;
export const sold=p=>p.statut==='Vendu',avail=p=>p.statut==='Disponible';
export const profit=p=>(p.pv||0)-(p.achat||0)-(p.frais||0);
export const age=p=>days(ok(p.entree)?p.entree:today(),today());
export const idn=id=>parseInt(String(id).replace(/\D/g,''),10)||0;
export const nextId=()=>'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
export const title=p=>[p.marque||t('Sans marque'),tv(p.sub||p.cat)].filter(Boolean).join(' · ');
export const lc=s=>app.LANG==='de'?s:String(s).toLowerCase();
export function clean(o){const r={};for(const k in o){if(k[0]==='_')continue;const v=o[k];if(v===''||v==null||(Array.isArray(v)&&!v.length)||(typeof v==='number'&&!isFinite(v)))continue;r[k]=v}return r}
