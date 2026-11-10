import { app } from '../state.js';
import { $, LSg, LSs, esc, fd } from './core.js';
import { copyText } from './listing.js';
import { sheetHead, showSheet } from './tools-index.js';
import { fold } from './search.js';
import { VER } from './proofs.js';

app.openNews = openNews;
app.openAide = openAide;
app.openIdee = openIdee;

/* --- 9. nouveautés, aide, idées --- */
export const CHANGELOG=[
 {v:'v23',d:'2026-10-29',t:['Appli disponible en français, anglais, italien, espagnol et allemand : choisis ta langue dans Réglages','Dates, nombres et annonces Vinted adaptés à la langue choisie']},
 {v:'v20',d:'2026-10-29',t:['Dossier de preuves par vente : photos du colis, poids, vidéo courte, horodatés avec empreinte numérique','Visuels pour TikTok et Instagram : carrousel d\'arrivage et stories avec prix','Wrapped du mois et de l\'année, à partager en story','Calendrier commercial, rappels du jour et notifications','Défis du mois','Import depuis Excel, CSV et exports Vinted','Liste chargée au fil du défilement, recherche plus rapide, suivi de l\'espace photos']},
 {v:'v19',d:'2026-10-28',t:['Bouton Publié, filtres À publier et En ligne','Cartes du stock allégées','Bilan en sections repliables','Corbeille de 30 jours et historique par pièce','Dépenses, trésorerie et bilan mensuel en PDF']},
 {v:'v17',d:'2026-10-27',t:['Analyse par ballot, calendrier des ventes, analyse des retours','Recherche plus tolérante','Compression automatique des photos']}];
function openNews(){showSheet(sheetHead(t('Nouveautés'))+CHANGELOG.map(c=>`<div class="card"><div style="display:flex;justify-content:space-between"><b>${t('Version {v}',{v:esc(c.v.slice(1))})}</b><span class="hint" style="margin:0">${fd(c.d)}</span></div><ul class="nws">${c.t.map(x=>`<li>${esc(t(x))}</li>`).join('')}</ul></div>`).join('')+'<div class="acts"><button type="button" class="btn sec" data-tool="idee">'+t('Proposer une idée')+'</button></div>')}
export function checkNews(){const s=LSg('seenVer','');if(!s){LSs('seenVer',VER);return}if(s!==VER){LSs('seenVer',VER);setTimeout(openNews,600)}}
export const FAQ=[['Ajouter une pièce','Onglet Ajouter : choisis la catégorie, les groupes suivants s\'ouvrent un à un. Le code se génère tout seul. Appuie sur Ajouter à la fin.'],
 ['Marquer une pièce en ligne','Touche Publié sur la carte (ou glisse la carte vers la gauche). La date de publication est enregistrée : elle sert aux séries, aux filtres À publier et En ligne et au coach.'],
 ['Enregistrer une vente','Touche Vendu sur la carte, vérifie le prix, la plateforme et les frais, puis valide. Pendant un live, utilise l\'onglet Live. Glisser vers la droite ouvre aussi la vente.'],
 ['Modifier une vente ou enregistrer un retour','Ouvre la fiche de la pièce vendue : Modifier la vente, Enregistrer un retour (avec son motif) ou Annuler la vente.'],
 ['Retrouver une pièce supprimée','Outils, Corbeille : les pièces supprimées restent 30 jours sur l\'appareil où tu les as supprimées.'],
 ['Dossier de preuves','Sur la fiche d\'une pièce vendue, ouvre Dossier de preuves. Ajoute une photo du colis emballé, son poids et une vidéo courte avant de le déposer. En cas de litige, imprime le dossier : chaque fichier est horodaté avec une empreinte numérique.'],
 ['Synchroniser mes appareils','Réglages, connexion : connecte-toi avec le même compte sur chaque appareil. La pastille en haut montre l\'état. Les vidéos de preuves restent sur l\'appareil.'],
 ['Sauvegarder mes données','Réglages, Sauvegarde JSON. Une copie automatique se fait chaque semaine si tu l\'actives. Garde un fichier JSON de temps en temps hors de ton téléphone.'],
 ['Importer mes anciennes données','Outils, Importer des pièces : Excel, CSV, export Vinted ou ta sauvegarde JSON. Tu vérifies les colonnes avant d\'importer.'],
 ['Plafond micro-entrepreneur et URSSAF','Outils, Ligne fiscale. Les plafonds et taux par défaut sont à vérifier sur autoentrepreneur.urssaf.fr. Ce sont des estimations, pas un conseil fiscal.'],
 ['Prévision de trésorerie','Elle est dans le Bilan, calculée toute seule : tes ventes encaissées, moins achats et dépenses, puis une projection au rythme des 30 derniers jours. Touche la carte pour indiquer ton solde réel si tu veux partir de ton vrai compte.'],
 ['Alléger mes photos','Tout est automatique : les nouvelles photos sont réduites à l\'ajout, et Max allège peu à peu celles que tu avais déjà, en tâche de fond. La formule gratuite de Supabase offre 1 Go de fichiers.'],
 ['Installer l\'appli','iPhone : ouvre le site dans Safari, Partager, Sur l\'écran d\'accueil. Android : menu du navigateur, Installer l\'application. Ordinateur : icône d\'installation dans la barre d\'adresse.'],
 ['Mettre à jour','Un bandeau « Nouvelle version disponible » apparaît : touche Mettre à jour. Sinon ferme et rouvre l\'appli.']];
function openAide(){showSheet(sheetHead(t('Centre d\'aide'))+`<input type="search" id="ai_q" placeholder="${t('Chercher dans l\'aide')}" autocomplete="off"><div id="ai_l" style="margin-top:12px"></div><div class="acts two"><button type="button" class="btn sec" data-tool="news">${t('Nouveautés')}</button><button type="button" class="btn sec" data-tool="idee">${t('Proposer une idée')}</button></div>`+`<details class="card hist" style="margin-top:12px"><summary>${t('Raccourcis clavier et glisser')}</summary><div style="margin-top:8px">${app.shortcutsHTML()}</div></details>`);
 const draw=()=>{const q=fold($('ai_q').value),L=FAQ.map(([a,b])=>[t(a),t(b)]).filter(([a,b])=>!q||q.split(' ').every(w=>fold(a+' '+b).includes(w.length>4?w.slice(0,w.length-2):w)));$('ai_l').innerHTML=L.map(([a,b])=>`<details class="card hist"><summary>${esc(a)}</summary><p style="margin:8px 0 0;font-size:14px">${esc(b)}</p></details>`).join('')||'<div class="empty" style="padding:14px 8px">'+t('Rien ne correspond. Essaie un autre mot, ou propose une idée.')+'</div>'};draw();$('ai_q').oninput=draw}
function openIdee(){let kind='Idée';const draw=()=>{showSheet(sheetHead(t('Proposer une idée'))+`<div class="card"><div class="chips" id="id_k" style="margin-bottom:12px">${['Idée','Bug','Question'].map(k=>`<button type="button" class="chip sm${kind===k?' on':''}" data-ik="${k}">${t(k)}</button>`).join('')}</div><div class="fld"><label class="l" for="id_t">${t('Ton message')}</label><textarea id="id_t" rows="6" placeholder="${t('Décris ce que tu voudrais, ou ce qui ne marche pas.')}"></textarea></div><div class="acts"><button type="button" class="btn mint" id="id_go">${t('Envoyer')}</button></div><div class="hint">${t('Le message s\'ouvre dans ta messagerie ou dans le menu de partage de ton téléphone, prêt à envoyer.')}</div></div>`);
  $('shc').onclick=async e=>{const k=e.target.closest('[data-ik]');if(k){const t=$('id_t').value;kind=k.dataset.ik;draw();$('id_t').value=t;return}
   if(e.target.closest('#id_go')){const t=$('id_t').value.trim();if(!t)return app.toast(window.t('Écris ton message'));const msg='['+kind+'] Max '+VER+'\n\n'+t,to=(window.STOCK_CONFIG||{}).feedbackEmail;LSs('ideas',[...LSg('ideas',[]),{t:Date.now(),k:kind,m:t}].slice(-30));
    if(to){location.href='mailto:'+to+'?subject='+encodeURIComponent(window.t('{k} pour Max',{k:window.t(kind)}))+'&body='+encodeURIComponent(msg)}else if(navigator.share){try{await navigator.share({title:window.t('{k} pour Max',{k:window.t(kind)}),text:msg})}catch(er){}}else copyText(msg,window.t('Message'))}}};draw()}
