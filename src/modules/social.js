import { app } from '../state.js';

app.logoMark = logoMark;

/* --- aides de dessin partagées (Wrapped, logo de la boutique) --- */
export const FDN="Archivo, 'Arial Black', Arial, sans-serif";
function logoMark(c,x,y,s){c.save();c.translate(x,y);c.scale(s/104,s/104);c.fillStyle='#111';c.beginPath();c.roundRect?c.roundRect(0,0,104,104,22):c.rect(0,0,104,104);c.fill();c.fillStyle='#F1F2F4';c.fillRect(12,68,80,18);c.fillStyle='#C9CBD0';c.fillRect(18,46,68,18);c.translate(62,24);c.rotate(-12*Math.PI/180);c.translate(-62,-24);c.fillStyle='#FF4A1C';c.fillRect(32,14,58,18);c.restore()}
export function wrapTxt(c,t,x,y,mw,lh,maxL){const ws=String(t).split(' ');let l='',n=0;for(const w of ws){const tt=l?l+' '+w:w;if(c.measureText(tt).width>mw&&l){c.fillText(l,x,y+n*lh);n++;l=w;if(maxL&&n>=maxL)return n}else l=tt}if(l){c.fillText(l,x,y+n*lh);n++}return n}
export function fitPx(x,t,s,mw,wt){x.font=(wt||800)+' '+s+'px '+FDN;while(x.measureText(t).width>mw&&s>40){s-=6;x.font=(wt||800)+' '+s+'px '+FDN}return s}
export function mkCanvas(w,h,bg){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.textBaseline='alphabetic';return[c,x]}
