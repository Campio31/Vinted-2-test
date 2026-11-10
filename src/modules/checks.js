import { app } from '../state.js';
import { eur, fd, ok } from './core.js';

app.guardSale = guardSale;

/* ===== 5. Contrôles à la saisie ===== */
let ackKey='',ackAt=0;
function saleWarns(p,x,fr,dv){const w=[],cost=(p.achat||0)+(fr||0);if(x===0)w.push(t('prix à 0 €'));else if(x<cost)w.push(t('vendu {a}, sous ton coût de {b} (achat et frais)',{a:eur(x),b:eur(cost)}));
 if(ok(dv)){const from=ok(p.pub)?p.pub:null;if(from&&dv<from)w.push(t('la date de vente ({a}) précède la date de publication ({b})',{a:fd(dv),b:fd(from)}));else if(ok(p.entree)&&dv<p.entree)w.push(t('la date de vente précède la date d\'entrée ({a})',{a:fd(p.entree)}))}return w}
function guardSale(p,x,fr,dv){const w=saleWarns(p,x,fr,dv);if(!w.length)return true;const k=p.id+'|'+x+'|'+fr+'|'+dv;if(ackKey===k&&Date.now()-ackAt<20000)return true;ackKey=k;ackAt=Date.now();app.toast(t('Attention : {w}. Valide encore pour confirmer.',{w:w.join(' ; ')}),null,6500);return false}
export function codeClash(code,id){return code?app.P.find(p=>p.code===code&&p.id!==id):null}
