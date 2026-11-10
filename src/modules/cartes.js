import { app } from '../state.js';
import { esc, ok, sold } from './core.js';
import { CFG0 } from './settings-core.js';
import { BACKC, COL, backSVG, garmentSVG, packSVG } from './cartes-art.js';

/* ---------- Cartes à collectionner : Collection Hiver (43 cartes, direction « Papier Encré ») ---------- */
/* Des cartes à collectionner, pas un jeu : aucun point d'attaque ni de défense, aucun prix. Chaque carte est un vêtement ou une pièce de l'univers de Max.
   Sept raretés, des versions Super (fond noir) de Rare à Mythique, et un état (de Correct à Neuf) que suivent les marques d'usure.
   Packs « Cristal » : Givre (simple), Glacier (rare), Aurore (sublime). Tout est gardé dans les réglages (cfg.cartes), donc sur tous tes appareils. */
Object.assign(CFG0, { cartes: null });

export const RARETES = ['Commune', 'Peu commune', 'Rare', 'Épique', 'Légendaire', 'Mythique', 'Unique'];
export const TIRAGE = [0, 50000, 10000, 2500, 500, 100, 3];       /* tirage standard (0 = illimité) */
export const TIRAGE_SUPER = [0, 0, 1000, 250, 50, 10, 0];          /* tirage de la version Super (de Rare à Mythique) */
export const POINTS = [1, 2, 4, 7, 12, 20, 50];                     /* points de rareté */
export const ETATS = ['Correct', 'Bon', 'Très bon', 'Excellent', 'Neuf'];
const ETAT_W = [34, 30, 20, 13, 3];                                 /* Neuf est l'état le plus rare, dans chaque rareté */
const SUPER_P = 0.1;                                                /* 1 000 sur 10 000, 250 sur 2 500, 50 sur 500, 10 sur 100 */
/* chances d'obtenir chaque rareté dans un pack (Commune, Peu commune, Rare, Épique, Légendaire, Mythique). Les Uniques ne sortent jamais d'un pack. */
const ODDS = { base: [62, 28, 7.5, 2, 0.45, 0.05], rare: [0, 0, 78, 16, 5.2, 0.8], epic: [0, 0, 0, 70, 24, 6] };
/* d'après les packs dessinés : Givre 4 cartes ; Glacier 5 cartes dont 1 Rare garantie ; Aurore 5 cartes dont 1 Épique garantie et plus de chances de carte Super */
const PACK_N = { s: { n: 4, rare: 0, epic: 0, sup: SUPER_P }, p: { n: 4, rare: 1, epic: 0, sup: SUPER_P }, a: { n: 4, rare: 0, epic: 1, sup: 0.25 } };
const PITY = 4;                                                     /* 4 packs Givre sans Rare : le 5e en contient une */
export const SET_NAME = 'Collection Hiver';

const C = (r, name, type, mat, epoque, taille, coul, sil, pat, hist, o = {}) => Object.assign({ r, name, type, mat, epoque, taille, coul, sil, pat, hist }, o);
const RAW = [
  C(0, 'BONNET POMPON', 'Bonnet', 'Laine', 1994, 'U', 'Rouge', 'bonnet', 'uni', 'Tricoté par une grand-mère pour un petit-fils qui détestait avoir froid aux oreilles.', { opt: { pom: 1 } }),
  C(0, 'ÉCHARPE RAYÉE', 'Écharpe', 'Laine', 1988, 'U', 'Bleu', 'echarpe', 'hstripes', 'Elle a fait trois hivers, deux écoles et un voyage en train sans jamais se perdre.'),
  C(0, 'PULL TORSADÉ', 'Pull', 'Maille', 1982, 'L', 'Écru', 'pull', 'cable', 'Chaque torsade a pris une soirée entière devant la télévision.'),
  C(0, 'JEAN BRUT', 'Jean', 'Denim', 1999, '40', 'Bleu', 'jean', 'denim', 'Jamais lavé la première année, pour que le bleu garde ses plis.'),
  C(0, 'GILET MATELASSÉ', 'Gilet', 'Polyester', 2004, 'M', 'Jaune', 'gilet', 'quilt', 'Le gilet des matins de marché, sans manches pour garder les mains libres.'),
  C(0, 'MOUFLES NORDIQUES', 'Moufles', 'Laine', 1979, 'U', 'Rouge', 'moufles', 'nordic', 'Rapportées d\'un séjour en Norvège, et jamais dépareillées depuis.'),
  C(0, 'CHEMISE FLANELLE', 'Chemise', 'Flanelle', 1991, 'M', 'Rouge', 'chemise', 'check', 'Portée ouverte sur un t-shirt, comme dans tous les garages de la rue.'),
  C(0, 'BOTTES DE PLUIE', 'Bottes', 'Caoutchouc', 1986, '38', 'Vert', 'bottes', 'uni', 'Toujours une flaque pour justifier l\'achat.'),
  C(0, 'SAC CABAS', 'Sac', 'Toile', 1996, 'U', 'Beige', 'cabas', 'uni', 'Il a porté le pain, les livres, puis un chat un jour de déménagement.'),
  C(0, 'JUPE ÉCOSSAISE', 'Jupe', 'Laine', 1975, '38', 'Vert', 'jupe', 'check', 'Un tartan choisi pour le plaisir de tourner dans la cour.'),
  C(1, 'PULL JACQUARD', 'Pull', 'Laine', 1983, 'L', 'Vert', 'pull', 'jacquard', 'Motif dessiné à la main, un losange à la fois, sur du papier quadrillé.'),
  C(1, 'PARKA ORANGE', 'Parka', 'Nylon', 1992, 'M', 'Orange', 'parka', 'uni', 'Visible à cent mètres dans la neige, ce qui était le but.'),
  C(1, 'MANTEAU CAMEL', 'Manteau', 'Laine', 1971, '40', 'Camel', 'manteau', 'uni', 'Le manteau des rendez-vous importants et des gares sous la pluie.'),
  C(1, 'CARDIGAN BOUTONNÉ', 'Cardigan', 'Laine', 1985, 'M', 'Moutarde', 'cardigan', 'uni', 'Un bouton dépareillé, recousu à la main, par fierté.'),
  C(1, 'ÉCHARPE TARTAN', 'Écharpe', 'Cachemire', 1980, 'U', 'Bordeaux', 'echarpe', 'check', 'Offerte un Noël, gardée pour les grandes occasions, donc très peu portée.'),
  C(1, 'BONNET NORVÈGE', 'Bonnet', 'Laine', 1987, 'U', 'Bleu', 'bonnet', 'nordic', 'Des flocons tricotés pour lutter contre un vrai blizzard.'),
  C(1, 'ROBE LAINAGE', 'Robe', 'Laine', 1969, '36', 'Bordeaux', 'robe', 'uni', 'Cousue sur mesure, avec la doublure plus soignée que le dessus.'),
  C(1, 'BASKETS MONTANTES', 'Baskets', 'Cuir', 1989, '42', 'Blanc', 'baskets', 'uni', 'Blanches le premier jour, légendaires le deuxième.'),
  C(1, 'PANTALON VELOURS', 'Pantalon', 'Velours', 1977, '38', 'Brun', 'pantalon', 'cord', 'Il fait « frrr » quand on marche : on le reconnaît avant de le voir.'),
  C(1, 'GANTS EN CUIR', 'Gants', 'Cuir', 1968, '7', 'Noir', 'gants', 'uni', 'Doublés de soie, assouplis par dix ans de volants.'),
  C(2, 'TRUCKER INDIGO', 'Veste', 'Denim brut', 1974, 'M', 'Indigo', 'veste', 'denim', 'Un denim assez raide pour tenir debout tout seul au début.'),
  C(2, 'DUFFLE-COAT MARINE', 'Manteau', 'Laine', 1966, '42', 'Marine', 'manteau', 'uni', 'Les boutons en bois s\'attrapent même avec des gants.', { opt: { toggles: 1 } }),
  C(2, 'PULL ISLANDAIS', 'Pull', 'Laine', 1978, 'L', 'Crème', 'pull', 'nordic', 'Tricoté avec la laine d\'un mouton qui n\'a jamais quitté son île.'),
  C(2, 'BOTTES FOURRÉES', 'Bottes', 'Cuir', 1981, '39', 'Brun', 'bottes', 'uni', 'Pour les trottoirs gelés et les cheminées allumées.', { opt: { fur: 1 } }),
  C(2, 'CAPE EN TWEED', 'Cape', 'Tweed', 1963, 'U', 'Gris', 'cape', 'tweed', 'On la porte comme une promesse de ne jamais être en retard.'),
  C(3, 'RUNNER \'86', 'Sneakers', 'Cuir & mesh', 1986, '42', 'Bleu', 'sneaker', 'uni', 'Chaussée pour un marathon, portée surtout pour aller chercher le pain.'),
  C(3, 'BLOUSON AVIATEUR', 'Blouson', 'Cuir', 1973, 'L', 'Brun', 'blouson', 'uni', 'Le col en mouton a vu plus de ciels que son propriétaire.'),
  C(3, 'MOON BOOTS', 'Bottes', 'Nylon', 1979, '37', 'Argent', 'moonboots', 'uni', 'Pensées pour marcher sur la Lune, utilisées pour marcher sur un parking enneigé.'),
  C(3, 'DOUDOUNE FLUO', 'Doudoune', 'Nylon', 1993, 'M', 'Rose', 'doudoune', 'quilt', 'Impossible de la perdre dans une foule, et c\'était sa fonction.'),
  C(3, 'PULL SKI 84', 'Pull', 'Acrylique', 1984, 'L', 'Jaune', 'pull', 'nordic', 'Porté aux sports d\'hiver par toute une famille, dans toutes les tailles.'),
  C(4, 'TRENCH 1954', 'Manteau', 'Gabardine', 1954, '38', 'Beige', 'manteau', 'uni', 'Cousu pour les grandes avenues, il a traversé les années sans prendre une ride.', { fin: 'or', opt: { belt: 1 } }),
  C(4, 'CAPE D\'OPÉRA', 'Cape', 'Velours', 1958, 'U', 'Noir', 'cape', 'uni', 'Elle n\'a connu que des soirs de première et des escaliers en marbre.', { fin: 'or' }),
  C(4, 'ROBE DE GALA', 'Robe', 'Satin', 1961, '36', 'Champagne', 'robe', 'uni', 'Portée une seule fois, mais dans le plus beau bal de la saison.', { fin: 'or' }),
  C(4, 'BOTTES CAVALIÈRES', 'Bottes', 'Cuir', 1957, '40', 'Cognac', 'bottesH', 'uni', 'Cirées chaque dimanche, comme un rituel plus ancien que la maison.', { fin: 'or' }),
  C(4, 'TOQUE ZIBELINE', 'Chapeau', 'Fourrure', 1960, 'U', 'Marron', 'toque', 'uni', 'Elle se transmet de mère en fille avec l\'ordre de ne jamais la prêter.', { fin: 'or' }),
  C(5, 'ROBE ÉTOILE', 'Robe du soir', 'Soie', 1962, '36', 'Nuit', 'robe', 'uni', 'Le tissu change de couleur selon l\'heure et le regard.', { fin: 'holo' }),
  C(5, 'MANTEAU AURORE', 'Manteau', 'Soie & laine', 1965, '40', 'Irisé', 'manteau', 'uni', 'On raconte qu\'il a été teint avec la première lumière du matin.', { fin: 'holo', opt: { belt: 1 } }),
  C(5, 'GANTS COMÈTE', 'Gants', 'Soie', 1959, '7', 'Argent', 'gants', 'uni', 'Légers comme une traînée de lumière dans un ciel d\'hiver.', { fin: 'holo' }),
  C(5, 'ÉCHARPE GALAXIE', 'Écharpe', 'Soie', 1971, 'U', 'Violet', 'echarpe', 'uni', 'Dans ses plis, on devine les constellations les soirs de grand froid.', { fin: 'holo' }),
  C(5, 'BONNET CONSTELLATION', 'Bonnet', 'Cachemire', 1968, 'U', 'Indigo', 'bonnet', 'uni', 'Chaque point brillant est une étoile retrouvée par sa propriétaire.', { fin: 'holo' }),
  C(6, 'LA PREMIÈRE', 'Blazer', 'Laine', 1978, '40', 'Ivoire', 'blazer', 'uni', 'Le tout premier article vendu sur Max. Il n\'existe qu\'en trois exemplaires.', { fin: 'or', e: 5, unique: 'first' }),
  C(6, 'LE CINTRE D\'OR', 'Objet', 'Laiton', 1950, '—', 'Or', 'cintre', 'uni', 'Le cintre de tous les cintres : il a porté la collection entière.', { fin: 'or', e: 5, unique: 'hundred' }),
  C(6, 'LE COLIS ZÉRO', 'Objet', 'Carton', 2019, '—', 'Kraft', 'colis', 'uni', 'Le premier colis expédié depuis Max, fermé avec trop de scotch.', { fin: 'or', e: 5, unique: 'parcel' }),
];
export const CARDS = RAW.map((c, i) => Object.assign(c, { id: 'h' + String(i + 1).padStart(2, '0'), num: i + 1, tot: RAW.length, set: SET_NAME }));
const byId = Object.fromEntries(CARDS.map(c => [c.id, c]));
export const cardById = id => byId[id];
export const RCOL = BACKC.slice(0, 7);

/* ---- état ---- */
const blank = () => ({ own: {}, s: 0, p: 0, a: 0, paid: [], pity: 0, sets: [] });
export const state = () => Object.assign(blank(), app.cfg.cartes || {});
const save = o => app.setCfg({ cartes: o });
const has = (s, id) => !!(s.own[id] && (s.own[id].n || s.own[id] > 0));
export const owned = () => { const s = state(); return CARDS.filter(c => has(s, c.id)).length; };
export const packsLeft = () => { const s = state(); return s.s + s.p + s.a; };

function rnd() { const a = new Uint32Array(1); (window.crypto || globalThis.crypto).getRandomValues(a); return a[0] / 4294967296; }
function pickIdx(w) { let x = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return 0; }
const cardOf = r => { const L = CARDS.filter(c => c.r === r); return L[Math.floor(rnd() * L.length)]; };
const draw = (odds, ps = SUPER_P) => { const c = cardOf(pickIdx(odds)), e = c.e || pickIdx(ETAT_W) + 1, sup = c.r >= 2 && c.r <= 5 && rnd() < ps; return { c, e, sup }; };

/** Offre un pack (s : Givre, p : Glacier, a : Aurore). `id` évite de l'offrir deux fois pour le même défi ou palier. */
export function grantPack(kind, id) {
  const s = state();
  if (id && s.paid.includes(id)) return false;
  s[kind] = (s[kind] || 0) + 1; if (id) s.paid = [...s.paid, id].slice(-500);
  save(s); return true;
}

/** Ouvre un pack : renvoie les cartes tirées [{c, e, sup, nouv}] et met la collection à jour. */
export function openPack(kind) {
  const s = state(), P = PACK_N[kind];
  if (!P || !(s[kind] > 0)) return null;
  s[kind]--;
  const L = [];
  for (let i = 0; i < P.n; i++) L.push(draw(ODDS.base, P.sup));
  for (let i = 0; i < P.rare; i++) L.push(draw(ODDS.rare, P.sup));
  for (let i = 0; i < P.epic; i++) L.push(draw(ODDS.epic, P.sup));
  if (kind === 's') { if (L.some(x => x.c.r >= 2)) s.pity = 0; else if (s.pity >= PITY) { L[2] = draw(ODDS.rare, P.sup); s.pity = 0; } else s.pity++; }
  L.sort((a, b) => a.c.r - b.c.r);                                  /* la plus rare en dernier : la révélation monte en puissance */
  const own = Object.assign({}, s.own), res = [];
  L.forEach(x => {
    const o = Object.assign({ n: 0, e: 0, s: 0 }, typeof own[x.c.id] === 'object' ? own[x.c.id] : {}), nouv = !o.n;
    own[x.c.id] = { n: o.n + 1, e: Math.max(o.e, x.e), s: o.s || (x.sup ? 1 : 0) };
    res.push(Object.assign({ nouv }, x));
  });
  s.own = own;
  const bonus = [];
  if (!s.sets.includes('hiver') && CARDS.every(c => has({ own }, c.id))) { s.sets = [...s.sets, 'hiver']; s.a++; bonus.push(SET_NAME); }
  save(s);
  return { res, bonus, kind };
}

/** Cartes Uniques : elles se gagnent par un geste, jamais dans un pack (première vente, premier colis, 100 ventes). */
export function checkUniques() {
  if (app.importing || !app.loaded) return [];
  const s = state(), R = app.P.filter(p => !p.ex), S = R.filter(sold), got = [];
  const cond = { first: S.length >= 1, parcel: S.some(p => ok(p.exp)), hundred: S.length >= 100 };
  const own = Object.assign({}, s.own);
  CARDS.filter(c => c.unique && cond[c.unique] && !has({ own }, c.id)).forEach(c => { own[c.id] = { n: 1, e: 5, s: 0 }; got.push(c); });
  if (got.length) { s.own = own; save(s); got.forEach(c => app.toast(t('Carte Unique obtenue : {n}', { n: c.name }), null, 6000)); }
  return got;
}

/* ---- affichage ---- */
let uid = 0;
const nn = n => String(n).padStart(2, '0');
const tir = (c, sup) => { const v = sup ? TIRAGE_SUPER[c.r] : TIRAGE[c.r]; return v ? v.toLocaleString(app.LOC) : t('ILLIMITÉ'); };
const spark = '<svg class="cgs" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 L14.5 9.5 L23 12 L14.5 14.5 L12 23 L9.5 14.5 L1 12 L9.5 9.5 Z"/></svg>';
/** Recto d'une carte (360 × 504, tout se met à l'échelle de sa largeur). */
export function cardFront(c, e = 5, sup = false) {
  const id = ++uid, dots = [1, 2, 3, 4, 5].map(i => `<i class="pt${i <= e ? ' on' : ''}"></i>`).join('');
  const fx = sup || c.r >= 5 || c.fin === 'holo' ? 3 : c.r >= 3 ? 2 : c.r >= 2 ? 1 : 0;      /* intensité des reflets */
  return `<div class="cdn r${c.r}${sup ? ' sup' : ''}${c.fin ? ' f-' + c.fin : ''} e${e} fx${fx}" style="--rc:${RCOL[c.r]}"><i class="gls"></i><i class="wr"></i><div class="cdh"><span class="crr">${esc(t(RARETES[c.r]).toUpperCase())} · ${POINTS[c.r]} ${t('pts')}</span><b class="cdt">${esc(c.name)}</b><small>${esc(c.type)} · ${esc(c.mat)}</small><span class="cdnn">${nn(c.num)} / ${c.tot}</span></div>
   <div class="cdd">${spark}${spark}${spark}${garmentSVG(c, id, e)}</div>
   <div class="cdf"><div><span>${t('ÉPOQUE')}</span><b>${c.epoque}</b></div><div><span>${t('TAILLE')}</span><b>${esc(c.taille)}</b></div><div><span>${t('COULEUR')}</span><b><i class="sw" style="background:${COL[c.coul] || '#ccc'}" title="${esc(c.coul)}"></i></b></div><div><span>${t('ÉTAT')}</span><b class="pts" title="${esc(t(ETATS[e - 1]))}">${dots}</b></div></div>
   <div class="cdi"><span>${t('SON HISTOIRE')}</span><em>${esc(c.hist)}</em></div><div class="cdb"><span>${t('COLLECTION HIVER').toUpperCase()}</span><span>${t('TIRAGE')} ${tir(c, sup)}</span></div>${sup ? `<span class="cdsup">${t('SUPER')}</span>` : ''}</div>`;
}
/** Une carte en tuile : recto si on la possède, sinon son dos en gris. down : face cachée (ouverture d'un pack). */
export function cardTile(c, o = {}) {
  const { e = 5, sup = false, n = 1, down = false, big = false, miss = false } = o;
  const uidb = ++uid;
  const chip = miss ? '' : `<span class="ces e${e}">${esc(t(ETATS[e - 1]))}</span>`;
  return `<button type="button" class="cdk${big ? ' big tilt' : ''}${down ? ' down' : ''}${miss ? ' miss' : ''}" ${down ? `data-flip="1" data-pz="${esc(c.id)},${e},${sup ? 1 : 0}"` : `data-card="${esc(c.id)}"`} aria-label="${esc(c.name + ' · ' + t(RARETES[c.r]))}">${miss ? `<span class="cdw">${backSVG(c.r, uidb)}<span class="cdnum">${nn(c.num)}</span></span>` : `<span class="cdw">${cardFront(c, e, sup)}${down ? backSVG(c.r, uidb, sup) : ''}</span>`}${chip}${n > 1 ? `<em class="cnx">×${n}</em>` : ''}</button>`;
}
/* fissures dessinées pendant la charge du pack (jamais visibles au repos) */
const CRACKS = '<svg class="crk" viewBox="0 0 300 500"><path d="M150 250 L126 204 L146 152 L120 96"/><path d="M150 250 L192 216 L216 160 L204 100"/><path d="M150 250 L108 286 L84 340 L104 396"/><path d="M150 250 L188 292 L176 344 L214 404"/><path d="M126 204 L84 190 L62 150"/><path d="M216 160 L252 150 L270 108"/><path d="M108 286 L64 272"/></svg>';
let shown = null, sel = '';
const PNAME = { s: ['Givre', 'Pack simple : 3 cartes'], p: ['Glacier', 'Pack rare : 4 cartes, une Rare ou mieux'], a: ['Aurore', 'Pack sublime : 5 cartes, deux Épiques ou mieux'] };
export function cartesBody() {
  const s = state(), got = owned();
  const bar = `<div class="gcard cartes-h"><div class="gh2"><span>${t(SET_NAME)}</span><span>${got} / ${CARDS.length}</span></div><div class="rl"><b class="gc-g" style="width:${(got / CARDS.length * 100).toFixed(1)}%"></b></div>
   <div class="packs">${['s', 'p', 'a'].map(k => `<div class="pkc"><div class="pkm">${packSVG(k, 'm' + k + (++uid))}</div><b>${s[k] || 0}</b><span>${t(PNAME[k][0])}</span><button type="button" class="btn sm${k === 'p' ? ' mint' : ''}" data-popen="${k}"${s[k] ? '' : ' disabled'}>${t('Ouvrir')}</button></div>`).join('')}</div>
   <div class="gl2">${t('Un défi de la semaine offre un pack Givre, un défi du mois un pack Glacier, un trophée Platine ou Diamant un pack Aurore. Les Uniques se gagnent par un geste, jamais dans un pack.')}</div></div>`;
  const open = shown ? `<div class="card popen"><h3>${shown.bonus.length ? t('Collection complète : un pack Aurore en cadeau') : t('Ton pack {n}', { n: t(PNAME[shown.kind][0]) })}</h3><div class="stg k-${shown.kind}" aria-hidden="true"><i class="rays"></i><div class="pkw">${packSVG(shown.kind, 'o' + (++uid))}${CRACKS}</div><i class="flash"></i></div><p class="sub" style="margin:4px 0 0">${t('Touche une carte pour la retourner, puis touche-la encore pour la voir en grand.')}</p><div class="prow n${shown.res.length}">${shown.res.map(x => cardTile(x.c, { e: x.e, sup: x.sup, down: true })).join('')}</div><div class="acts two"><button type="button" class="btn sec" data-pflip="1">${t('Tout révéler')}</button><button type="button" class="btn" data-pclose="1">${t('Ranger dans ma collection')}</button></div></div>` : '';
  const one = sel && byId[sel] ? (() => { const c = byId[sel], o = typeof s.own[c.id] === 'object' ? s.own[c.id] : null; return `<div class="card csel">${o ? cardTile(c, { e: o.e || 5, sup: !!o.s, n: o.n, big: true }) : `<div class="prow">${cardTile(c, { miss: true, big: true })}</div>`}<p class="sub" style="margin:8px 0 0">${o ? t('Tu as cette carte') + (o.n > 1 ? ' ×' + o.n : '') + (o.s ? ' · ' + t('version Super') : '') + ' · ' + t('meilleur état : {e}', { e: t(ETATS[(o.e || 5) - 1]) }) : c.unique ? t('Carte Unique : elle se gagne par un geste, jamais dans un pack.') : t('Il te manque cette carte.')}</p></div>`; })() : '';
  const groups = RARETES.map((rn, r) => { const L = CARDS.filter(c => c.r === r); if (!L.length) return ''; const k = L.filter(c => has(s, c.id)).length; return `<div class="card cset"><div class="gh2"><b>${t(rn)}</b><span>${k} / ${L.length}${k === L.length ? ' ✓' : ''}</span></div><div class="cgrid">${L.map(c => { const o = typeof s.own[c.id] === 'object' ? s.own[c.id] : null; return o ? cardTile(c, { e: o.e || 5, sup: !!o.s, n: o.n }) : cardTile(c, { miss: true }); }).join('')}</div></div>`; }).join('');
  return bar + open + one + groups;
}
/* retourne une carte du pack : le dos se met de chant, puis le recto se déplie */
function flip(k) {
  if (k.classList.contains('fo')) return;
  document.querySelectorAll('.popen .stg').forEach(x => x.classList.add('skip'));
  k.classList.add('fo');
  setTimeout(() => { k.classList.remove('down', 'fo'); k.classList.add('fl', 'tilt'); }, 190);
}
/* carte en grand, par-dessus l'écran : on la fait bouger du doigt */
function zoom(v) {
  const [id, e, s] = String(v || '').split(','), c = byId[id]; if (!c) return;
  const z = document.createElement('div'); z.className = 'czm';
  z.innerHTML = `<div class="czb">${cardTile(c, { e: +e || 5, sup: s === '1', big: true })}<p>${t('Fais bouger la carte du doigt pour voir les reflets.')}</p><button type="button" class="btn sec" data-cz="1">${t('Fermer')}</button></div>`;
  z.onclick = ev => { if (dragged) { dragged = false; return; } if (ev.target.closest('[data-cz]') || ev.target === z) z.remove(); };
  document.body.appendChild(z); cartesTilt(z);
}
let dragged = false;
/** Inclinaison en 3D : la carte suit le doigt (ou la souris), les reflets suivent l'inclinaison. */
export function cartesTilt(root) {
  if (!root || root._tilt) return; root._tilt = 1;
  let cur = null, x0 = 0, y0 = 0, down = false;
  const aim = (k, ev) => {
    const r = k.getBoundingClientRect(), px = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)), w = k.querySelector('.cdw'); if (!w) return;
    w.style.setProperty('--rx', ((.5 - py) * 34).toFixed(1) + 'deg'); w.style.setProperty('--ry', ((px - .5) * 34).toFixed(1) + 'deg');
    w.style.setProperty('--mx', (px * 100).toFixed(0) + '%'); w.style.setProperty('--my', (py * 100).toFixed(0) + '%');
    k.classList.add('tl');
  };
  const rest = k => { const w = k && k.querySelector('.cdw'); if (!w) return; ['--rx', '--ry', '--mx', '--my'].forEach(p => w.style.removeProperty(p)); k.classList.remove('tl'); };
  root.addEventListener('pointerdown', ev => { const k = ev.target.closest('.cdk.tilt:not(.down)'); if (!k) return; cur = k; down = true; x0 = ev.clientX; y0 = ev.clientY; aim(k, ev); });
  root.addEventListener('pointermove', ev => {
    const k = ev.target.closest('.cdk.tilt:not(.down)');
    if (down && cur) { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 8) dragged = true; aim(cur, ev); }
    else if (ev.pointerType === 'mouse' && k) { if (cur && cur !== k) rest(cur); cur = k; aim(k, ev); }
  });
  const end = () => { down = false; if (cur) rest(cur); cur = null; if (dragged) setTimeout(() => { dragged = false; }, 60); };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end); root.addEventListener('pointerleave', end);
}
/** Gère les touches de l'onglet Cartes ; renvoie true si l'écran doit être redessiné, false si non, null si ce n'est pas pour nous. */
export function cartesClick(e) {
  if (dragged) { dragged = false; return false; }                   /* un glissé n'est pas une touche */
  const o = e.target.closest('[data-popen]');
  if (o) { const r = openPack(o.dataset.popen); if (r) { shown = r; sel = ''; return true; } return false; }
  const f = e.target.closest('[data-flip]');
  if (f) { if (f.classList.contains('down')) flip(f); else zoom(f.dataset.pz); return false; }
  if (e.target.closest('[data-pflip]')) { [...document.querySelectorAll('.popen .cdk.down')].forEach((x, i) => setTimeout(() => flip(x), i * 140)); return false; }
  if (e.target.closest('[data-pclose]')) { shown = null; return true; }
  const c = e.target.closest('[data-card]');
  if (c) { sel = sel === c.dataset.card ? '' : c.dataset.card; return true; }
  return null;
}
