import { app } from '../state.js';
import { andJoin, eur, lc } from './core.js';
import { DB, DH } from './form.js';
import { nrm } from './advice.js';

app.vTitle = vTitle;
app.vDesc = vDesc;
app.vCategory = vCategory;
app.copyText = copyText;

/* ---------- annonce Vinted ---------- */
const CATLBL={Tshirt:'T-shirt',Sweat:'Sweat',Chemise:'Chemise',Pantalon:'Pantalon',Veste:'Veste',Short:'Short',Polo:'Polo',Maillot:'Maillot',RobeJupe:'Robe ou jupe',Autres:'Vêtement'};
const TYPELBL={'Tshirt|T-Imprimé':'T-shirt imprimé','Tshirt|T-Unis':'T-shirt uni','Tshirt|T-Rayures':'T-shirt rayé','Sweat|Rond Col Pull':'Pull col rond','Sweat|V Col Pull':'Pull col V','Sweat|Pull Col Rond':'Pull col rond','Sweat|Pull Col V':'Pull col V','Sweat|Sweat à capuche':'Sweat à capuche','Sweat|Pull demi-zip':'Pull demi-zip','Sweat|Pull Col Roulé':'Pull col roulé','Sweat|Survetements':'Survêtement','Sweat|Veste':'Veste zippée','Pantalon|Droite':'Pantalon droit','Pantalon|Slim':'Pantalon slim','Pantalon|Skinny':'Pantalon skinny','Pantalon|Super skinny':'Pantalon super skinny','Pantalon|Bootcut':'Pantalon bootcut','Veste|Blazers':'Blazer','Veste|Cabans':'Caban','Veste|Jeans':'Veste en jean','Veste|Chemise':'Veste chemise','Veste|Survetement':'Veste de survêtement','Chemise|C-Unis':'Chemise unie','Chemise|C-Carreaux':'Chemise à carreaux','Chemise|C-Rayures':'Chemise rayée','Chemise|C-Motifs':'Chemise à motifs','Chemise|C-Tie&Dye':'Chemise tie and dye','Chemise|C-Jeans':'Chemise en jean','Polo|P-Unis':'Polo uni','Polo|P-Rayures':'Polo rayé','Polo|P-Motifs':'Polo à motifs','Maillot|Football':'Maillot de football','Maillot|Basket':'Maillot de basket','Short|Sport':'Short de sport','Short|Jeans':'Short en jean','RobeJupe|Longueur Genou':'Robe longueur genou','RobeJupe|Sweat':'Robe sweat'};
const VCAT={Tshirt:'T-shirts et débardeurs',Sweat:'Pulls et sweats',Chemise:'Chemises',Pantalon:'Pantalons',Veste:'Manteaux et vestes',Short:'Shorts',Polo:'T-shirts et polos',Maillot:'T-shirts et maillots de sport',RobeJupe:'Robes et jupes',Autres:'Autres vêtements'};
const typeLbl=p=>t(TYPELBL[p.cat+'|'+p.sub]||(p.sub&&['Blouson','Doudoune','Bomber','Parka','Polaire','Perfecto','Cardigan','Pyjama','Manteau long','Coupe-vent','Duffle-Coat','Blouson Teddy','Mini jupe','Robe de soirée','Sac à main'].includes(p.sub)?p.sub:(CATLBL[p.cat]||p.cat||'Vêtement')));
const brandOk=p=>p.marque&&!/^non (identifi|renseign)/i.test(p.marque)?p.marque:'';
const collabOk=p=>p.collab&&!/^aucun/i.test(p.collab)?p.collab:'';
const vCond=p=>t(/^neuf avec/i.test(p.etat||'')?'Neuf avec étiquette':/^neuf/i.test(p.etat||'')?'Neuf sans étiquette':/^(très bon état|bon état|satisfaisant)$/i.test(p.etat||'')?p.etat:p.grade==='A'?'Très bon état':p.grade==='B'?'Bon état':p.grade==='C'?'Satisfaisant':'Bon état');
app.vCond = vCond;
function vTitle(p){const type=typeLbl(p),m=brandOk(p),mod=p.modele||'',col=lc(tv((p.coul&&p.coul[0])||'')),tail=p.taille?t(' - Taille {s}',{s:p.taille}):'';
 const tries=[[type,m,mod,collabOk(p),col],[type,m,mod,'',col],[type,m,'','',col],[type,m,'','','']];
 for(const tr of tries){const s=tr.filter(Boolean).join(' ')+tail;if(s.length<=60)return s}
 return(type+' '+m+tail).slice(0,60)}
function vDesc(p){
 const type=typeLbl(p),m=brandOk(p),cols=(p.coul||[]).map(c=>lc(tv(c))),colTxt=andJoin(cols),genre={Homme:t('Homme'),Femme:t('Femme'),Enfant:t('Enfant'),'Les deux':t('Mixte')}[p.genre]||'';
 const l1=[type,m,p.modele,collabOk(p),colTxt].filter(Boolean).join(' ')+(p.taille?t(', taille {s}',{s:p.taille}):'')+'.';
 const stateTxt={A:t('Très bon état, aucun défaut visible.'),B:t('Bon état, légères traces d\'usure normales pour un article porté.'),C:t('État satisfaisant, des signes d\'usure sont visibles (voir les photos).')}[p.grade]||'';
 /* défauts précis cochés dans la fiche ; une ancienne fiche avec un défaut dans « état » est aussi reprise */
 const dl=[...(p.defauts||[]),...(p.etat&&!/^(ras|neuf.*|légères traces d'usure|très bon état|bon état|satisfaisant)$/i.test(p.etat)?[p.etat]:[])];
 const def=dl.length?t(dl.length>1?'Points à signaler : {d} (visibles sur les photos).':'Point à signaler : {d} (visible sur les photos).',{d:dl.map(x=>lc(tv(x))).join(', ')}):'';
 const det=[[t('Marque'),m],[t('Modèle'),p.modele],[t('Taille'),p.taille],[t('Genre'),genre],[t('Couleur'),cols.join(', ')],[t('Matière'),(p.mat||[]).map(tv).join(', ')],['Collab',collabOk(p)],[t('Fabriqué en'),cn(p.madein)]].filter(r=>r[1]);
 const dims=[...DH,...DB].filter(([k])=>p[k]).map(([k,l])=>'• '+t(l)+t(' : ')+String(p[k]).replace('.',app.DS)+' cm');
 const tag=s=>'#'+nrm(s).replace(/[^a-z0-9]+/g,'');
 const tags=[...new Set([m&&tag(m),tag(t(CATLBL[p.cat]||'')),genre&&tag(genre),t('#secondemain'),t('#friperie'),p.sub&&TYPELBL[p.cat+'|'+p.sub]&&tag(t(TYPELBL[p.cat+'|'+p.sub]))].filter(x=>x&&x.length>1))].join(' ');
 return[l1,[stateTxt,def].filter(Boolean).join(' '),t('Détails')+'\n'+det.map(r=>'• '+r[0]+t(' : ')+r[1]).join('\n'),dims.length?t('Mesures à plat')+'\n'+dims.join('\n'):'',t('Envoi soigné et rapide, suivi inclus. Lots possibles : ajoute plusieurs articles à tes favoris et écris-moi pour réduire les frais de port.'),tags].filter(Boolean).join('\n\n')}
function vCategory(p){const g=t(p.genre==='Femme'?'Femmes':p.genre==='Enfant'?'Enfants':'Hommes');return g+' › '+t('Vêtements')+' › '+t(VCAT[p.cat]||'Autres vêtements')}
export async function copyText(txt,label){try{await navigator.clipboard.writeText(txt);app.toast(t('{l} copié',{l:label}))}catch(e){const ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');app.toast(t('{l} copié',{l:label}))}catch(er){app.toast(t('Copie impossible : sélectionne le texte à la main'))}ta.remove()}}

/* ---------- annonce en un geste : Vinted, Leboncoin, TikTok Live ---------- */
export const PLATFORMS = [['vinted', 'Vinted', 60], ['lbc', 'Leboncoin', 70], ['tiktok', 'TikTok Live', 60]];
const startPrice = p => { try { if (p.pvise > 0) return p.pvise; const a = app.advice(p); if (!a.ok) return 0; const sp = app.startPlan ? app.startPlan(p) : null; return sp ? sp.start : a.reco; } catch (e) { return 0; } };
const hashtags = (p, extra) => {
  const m = brandOk(p), g = { Homme: t('Homme'), Femme: t('Femme'), Enfant: t('Enfant') }[p.genre] || '', tag = s => '#' + nrm(s).replace(/[^a-z0-9]+/g, '');
  return [...new Set([m && tag(m), tag(t(CATLBL[p.cat] || '')), g && tag(g), t('#secondemain'), t('#friperie'), ...(extra || [])].filter(x => x && x.length > 1))].join(' ');
};
/** Titre, description et hashtags d'une pièce pour une plateforme : 'vinted' (annonce complète), 'lbc' (Leboncoin, sobre) ou 'tiktok' (court, pour le live). */
export function annonceFor(p, pf = 'vinted') {
  if (pf === 'vinted') { const d = vDesc(p), parts = d.split('\n\n'), last = parts[parts.length - 1]; return { title: vTitle(p), desc: d, tags: /^#/.test(last) ? last : hashtags(p) }; }
  const type = typeLbl(p), m = brandOk(p), cols = andJoin((p.coul || []).map(c => lc(tv(c)))), pr = startPrice(p), prTxt = pr ? eur(pr) : '';
  const state = t('État : {c}', { c: vCond(p) }), dl = [...(p.defauts || []), ...(p.etat && !/^(ras|neuf.*|légères traces d'usure|très bon état|bon état|satisfaisant)$/i.test(p.etat) ? [p.etat] : [])];
  const def = dl.length ? t(dl.length > 1 ? 'Points à signaler : {d} (visibles sur les photos).' : 'Point à signaler : {d} (visible sur les photos).', { d: dl.map(x => lc(tv(x))).join(', ') }) : '';
  if (pf === 'lbc') {
    const title = [type, m, p.modele, p.taille ? t('Taille {s}', { s: p.taille }) : '', cols].filter(Boolean).join(' ').slice(0, 70);
    const l1 = [type, m, p.modele].filter(Boolean).join(' ') + (p.taille ? t(', taille {s}', { s: p.taille }) : '') + (cols ? ', ' + cols : '') + '.';
    const det = [[t('Marque'), m], [t('Taille'), p.taille], [t('Matière'), (p.mat || []).map(tv).join(', ')], [t('Fabriqué en'), cn(p.madein)]].filter(r => r[1]).map(r => '• ' + r[0] + t(' : ') + r[1]);
    const dims = [...DH, ...DB].filter(([k]) => p[k]).map(([k, l]) => '• ' + t(l) + t(' : ') + String(p[k]).replace('.', app.DS) + ' cm');
    return { title, desc: [l1, [state, def].filter(Boolean).join(' '), det.join('\n'), dims.length ? t('Mesures à plat') + '\n' + dims.join('\n') : '', prTxt ? t('Prix : {p}', { p: prTxt }) : '', t('Remise en main propre possible ou envoi soigné (frais de port à la charge de l\'acheteur).')].filter(Boolean).join('\n\n'), tags: '' };
  }
  const title = ['🔥', type, m, p.taille, prTxt && '· ' + prTxt].filter(Boolean).join(' ').slice(0, 60);
  const desc = [['🔥', type, m, p.taille ? t('taille {s}', { s: p.taille }) : '', cols].filter(Boolean).join(' '), t('Dispo en LIVE : écris « je prends » dans le chat !'), [state, prTxt].filter(Boolean).join(' · ') + (def ? '\n' + def : ''), t('Envoi rapide, lots possibles avec frais de port groupés.')].filter(Boolean).join('\n');
  return { title, desc, tags: hashtags(p, [t('#live'), t('#vintage')]) };
}
app.annonceFor = annonceFor;
app.PLATFORMS = PLATFORMS;