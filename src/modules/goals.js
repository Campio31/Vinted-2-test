import { app } from '../state.js';
import { $, esc, eur, eurR, lc, sold, today } from './core.js';
import { go } from './nav.js';
import { stats } from './dashboard.js';

app.goalHTML = goalHTML;

/* ---------- objectifs mensuel et annuel (bénéfice net, chiffre d'affaires ou les deux) ---------- */
export const GKEY={net:{m:'goal',y:'goalY'},ca:{m:'goalCA',y:'goalYCA'}};
const GLAB={net:'Bénéfice net',ca:'Chiffre d\'affaires'};
const glab=k=>t(GLAB[k]);
export const goalKinds=()=>app.cfg.goalMode==='ca'?['ca']:app.cfg.goalMode==='both'?['net','ca']:['net'];
export function goalCalc(kind,per){const g=+app.cfg[GKEY[kind][per]]||0;if(!g)return null;
 const d=new Date(),y=d.getFullYear(),pre=per==='m'?today().slice(0,7):String(y);
 const S=stats(app.P.filter(x=>sold(x)&&(x.dv||'').startsWith(pre))),cur=kind==='net'?S.ben:S.ca;
 const total=per==='m'?new Date(y,d.getMonth()+1,0).getDate():((y%4===0&&y%100!==0)||y%400===0?366:365);
 const elapsed=per==='m'?d.getDate():Math.round((Date.UTC(y,d.getMonth(),d.getDate())-Date.UTC(y,0,0))/864e5);
 const left=total-elapsed,reste=Math.max(0,g-cur);
 /* projection : ce qui sera atteint à la fin de la période si le rythme actuel continue */
 const proj=cur/Math.max(1,elapsed)*total;
 return{kind,per,g,cur,pct:cur/g,exp:g*elapsed/total,left,reste,proj,projPct:proj/g,rate:per==='m'?reste/Math.max(1,left):reste/Math.max(1,left/30.44)}}
const goalColor=d=>d.cur>=d.g?'g':'o';
/** Ligne « au rythme actuel » : estimation de fin de période et écart avec l'objectif. */
export const projHTML=d=>{const ok=d.proj>=d.g;return `<div class="gl2 gpj"><i class="pjd" aria-hidden="true"></i><span><b class="gc-pj">${t(d.per==='m'?'Au rythme actuel : {p} à la fin du mois':'Au rythme actuel : {p} à la fin de l\'année',{p:eur(d.proj)})}</b> · ${ok?t('{n} % de l\'objectif, tu devrais l\'atteindre',{n:Math.round(d.projPct*100)}):t('{n} % de l\'objectif, il manquerait {m}',{n:Math.round(d.projPct*100),m:eur(d.g-d.proj)})}</span></div>`};
export const bigEur=v=>{const s=Math.abs(v).toFixed(2).split('.');return(v<0?'−':'')+Number(s[0]).toLocaleString(app.LOC)+'<small>'+app.DS+s[1]+' €</small>'};
/* la barre montre ce qui est fait (vert ou orange) puis, d'une autre couleur (violet), ce que le rythme actuel ajoutera d'ici la fin de la période */
const ruler=d=>{const c=Math.min(100,Math.max(0,d.pct*100)),p=Math.min(100,Math.max(c,d.projPct*100));
 return`<div class="rl">${d.cur<d.g&&p>c?`<i class="pj" style="left:${c.toFixed(1)}%;width:${(p-c).toFixed(1)}%"></i>`:''}<b class="gc-${goalColor(d)}" style="width:${c.toFixed(1)}%"></b></div>`};
/* objectifs en jauges demi-cercle : arc vert ou orange = fait, arc violet = projection au rythme actuel, aiguille sur l'avancement */
const arc = (a0, a1, r = 50) => { const P = a => [60 - r * Math.cos(Math.PI * a), 60 - r * Math.sin(Math.PI * a)], [x0, y0] = P(a0), [x1, y1] = P(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
export function gaugeHTML(d) {
  /* objectif dépassé : l'arc principal est plein, l'aiguille reste au bout, et un 2e tour doré (arc intérieur) montre le dépassement */
  const ov = Math.min(.999, Math.max(0, d.pct - 1)), c = Math.min(.999, Math.max(0, d.pct)), p = Math.min(.999, Math.max(c, d.projPct)), done = d.cur >= d.g;
  const nx = 60 - 38 * Math.cos(Math.PI * c), ny = 60 - 38 * Math.sin(Math.PI * c);
  const stat = done ? `<span class="gst up">${t('Objectif atteint, bravo !')}</span>${ov > 0 ? `<div class="gov">+${Math.round((d.pct - 1) * 100)} % ${t('au-dessus de l\'objectif')}</div>` : ''}` : `<span class="gst ${d.cur >= d.exp ? 'up' : 'dn'}">${t(d.cur >= d.exp ? 'en avance sur le rythme' : 'en retard sur le rythme')}</span>`;
  return `<div class="gau"><div class="gnm">${glab(d.kind)}</div>
   <svg viewBox="0 0 120 68" role="img" aria-label="${esc(t('{k} · objectif {g}', { k: lc(glab(d.kind)), g: eurR(d.g) }))}"><path d="${arc(0, .999)}" class="gtr"/>${!done && p > c ? `<path d="${arc(c, p)}" class="gpjarc"/>` : ''}${c > 0 ? `<path d="${arc(0, c)}" class="gfg gc-${goalColor(d)}"/>` : ''}${ov > 0 ? `<path d="${arc(0, ov, 38)}" class="gov2"/>` : ''}<line x1="60" y1="60" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="gnd"/><circle cx="60" cy="60" r="4" class="gnd0"/></svg>
   <div class="gpc gc-${goalColor(d)}">${Math.round(d.pct * 100)} %</div>
   <div class="gauv">${eurR(d.cur)} <small>${t('sur {g}', { g: eurR(d.g) })}</small></div>${stat}
   ${done ? '' : `<div class="gl2">${t('Reste {r}', { r: eur(d.reste) })} · ${t(d.per === 'm' ? '{x} par jour' : '{x} par mois', { x: eur(d.rate) })}</div>${projHTML(d)}`}</div>`;
}
function goalHTML(){const kinds=goalKinds(),out=[],now=new Date(),mois=now.toLocaleDateString(app.LOC,{month:'long'});
 [['m',t('Objectif {m}',{m:mois})],['y',t('Objectif {m}',{m:now.getFullYear()})]].forEach(([per,title])=>{const ds=kinds.map(k=>goalCalc(k,per)).filter(Boolean);if(!ds.length)return;
  out.push(`<div class="gcard gaus"><div class="gh2"><span>${esc(title)}</span><button type="button" data-goalset>${t('Modifier')}</button></div><div class="gaug${ds.length>1?' two':''}">${ds.map(gaugeHTML).join('')}</div></div>`)});
 return out.length?out.join(''):'<div class="card goal"><h3>'+t('Objectifs')+'</h3><p class="sub">'+t('Fixe un objectif mensuel ou annuel (bénéfice net, chiffre d\'affaires ou les deux) pour suivre ta progression.')+'</p><button type="button" class="btn sm" data-goalset>'+t('Définir mes objectifs')+'</button></div>'}export function goalMini(){let ds=goalKinds().map(k=>goalCalc(k,'m')).filter(Boolean);if(!ds.length)ds=goalKinds().map(k=>goalCalc(k,'y')).filter(Boolean);
 return ds.map(d=>`<button type="button" class="gmini" data-goalset><div class="gr"><span>${t(d.kind==='net'?(d.per==='m'?'bénéfice du mois':'bénéfice de l\'année'):(d.per==='m'?'chiffre d\'affaires du mois':'chiffre d\'affaires de l\'année'))}</span><b class="gp gc-${goalColor(d)}">${Math.round(d.pct*100)} %</b></div>${ruler(d)}<small>${t('{a} sur {b}',{a:eur(d.cur),b:eur(d.g)})}</small></button>`).join('')}
document.addEventListener('click',e=>{if(e.target.closest('[data-goalset]')){go('set');setTimeout(()=>{const c=$('cfgc');if(c)c.scrollIntoView({behavior:'smooth',block:'center'});const i=c&&c.querySelector('input');if(i)i.focus()},80)}});
