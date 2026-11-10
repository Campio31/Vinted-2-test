import { app } from '../state.js';
import { $ } from './core.js';

app.renderAll = renderAll;

/* ---------- navigation ---------- */
export const TITLES={add:'Ajouter',quick:'Live',sales:'Vente',list:'Stock',dash:'Bilan',tools:'Outils',set:'Réglages'};
/* en mode clair, le fond de l'onglet Ajouter prend la couleur du potentiel de vente (vert, orange ou rouge) */
let potLvl='';
export function setPotBg(l){potLvl=l==='n'?'':l;if(app.view==='add'&&potLvl)document.body.dataset.pot=potLvl;else delete document.body.dataset.pot}
export function go(v){app.qSel=null;$('lst').innerHTML='';app.view=v;if(v==='add'&&potLvl)document.body.dataset.pot=potLvl;else delete document.body.dataset.pot;document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));{const r=$('rptb');if(r)r.hidden=v!=='dash'}$('ttl').textContent=t(TITLES[v]);window.scrollTo(0,0);app.renderAll();if(v==='quick'&&!matchMedia('(pointer:coarse)').matches)setTimeout(()=>$('ls').focus(),50);if(app.onView)app.onView(v)}
$('nav').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.v)};
function renderAll(){app.kickExtra();app.scheduleBadges();app.renderKpi();const nb=app.colisList().length,bg=$('nbg');bg.hidden=!nb;bg.textContent=nb;if(app.view==='quick')app.renderVendre();if(app.view==='sales')app.renderSales();if(app.view==='tools')app.renderTools();if(app.view==='list')app.renderList();if(app.view==='dash')app.renderDash();if(app.view==='set')app.renderSet()}
