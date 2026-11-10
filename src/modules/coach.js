import { $, LSs, today } from './core.js';

/* ---------- bandeau d'annonce en haut de l'écran (utilisé par la ligne fiscale et le Wrapped) ---------- */
/* Le Coach du lundi a été retiré en v43 : il ne reste ici que le bandeau. */
export function showCb(txt,btn,fn){$('cb').firstElementChild.textContent=txt;$('cb_go').textContent=btn;$('cb_go').onclick=fn;$('cb').hidden=false}
$('cb_x').onclick=()=>{$('cb').hidden=true;LSs('coachDay',today())};
