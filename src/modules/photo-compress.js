import { app } from '../state.js';
import { $ } from './core.js';
import { tx } from './storage.js';
import { phBlob, phURL } from './photos.js';
import { queueMany } from './sync.js';
import { sheetHead, showSheet } from './tools-index.js';

app.compressBlob = compressBlob;

/* --- photos : compression automatique --- */
export async function compressBlob(src,max,q){max=max||900;q=q||.72;const bmp=await createImageBitmap(src),k=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*k));c.height=Math.max(1,Math.round(bmp.height*k));c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);if(bmp.close)bmp.close();
 const b=await new Promise(r=>c.toBlob(r,'image/jpeg',q));if(!b)throw new Error(t('compression impossible'));return b}
async function photoStats(){const ids=[...new Set(app.P.map(p=>p.photo).filter(Boolean))];let n=0,bytes=0,big=0;
 for(const id of ids){try{const b=await phBlob(id);if(b){n++;bytes+=b.size;if(b.size>130000)big++}}catch(e){}}return{n,bytes,big,ids}}
const fmtMo=b=>(b/1048576).toFixed(1).replace('.',app.DS)+' '+t('Mo');
