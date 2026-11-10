import { app } from '../state.js';
import { esc } from './core.js';
import { tx } from './storage.js';

/* ---------- photos ---------- */
export const phURL=new Map();
export async function phBlob(id){return tx('photos','readonly',s=>s.get(id)).then(r=>r&&r.blob)}
export async function hydrate(){await Promise.all([...document.querySelectorAll('img[data-ph]:not([src])')].map(async img=>{const id=img.dataset.ph;let u=phURL.get(id);
 if(!u){try{let b=await phBlob(id);
  if(!b&&app.cloud&&app.user&&app.online){const r=await app.sb.storage.from('photos').download(app.user.id+'/'+id+'.jpg');if(r.data){b=r.data;await tx('photos','readwrite',s=>s.put({id,blob:b}))}}
  if(b){u=URL.createObjectURL(b);phURL.set(id,u)}}catch(e){}}
 if(u)img.src=u}))}
export const phImg=(id,cls)=>`<img${cls?` class="${cls}"`:''} data-ph="${esc(id)}" alt="">`;
export async function savePhoto(file){
 let blob;
 try{blob=await app.compressBlob(file)}catch(e){blob=null}
 if(!blob){if(/^image\/(jpeg|png|webp|gif)$/.test(file.type))blob=file;else throw new Error('format d\'image non pris en charge')}
 const id='ph'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 await tx('photos','readwrite',s=>s.put({id,blob}));return id}
