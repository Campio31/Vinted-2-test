import { app } from '../state.js';
import { $, LSg, LSs, esc, eur, sold, title } from './core.js';
import { contacts, expired, inPipeline, moveTo, slowParcel, stageOf, stages } from './crm.js';
import { go } from './nav.js';
import { phBlob } from './photos.js';
import { PLACES, SIZE_LIMITS, STORE_STAGES, TYPES, addItem, dupItem, getPlan, placePieces, removeItem, resizePlan, rotateItem, setProps, sizeOf, template } from './plan3d.js';

/* ---------- Entrepôt 3D : ton stock vu comme un vrai lieu, que tu aménages toi-même ---------- */
/* Trois lieux (une pièce, une maison, un entrepôt) ; tu poses et déplaces les meubles comme dans la vraie vie. Chaque pièce est rangée sur le meuble de son bac
   ou dans la zone de son étape, avec sa photo sur le colis. Quand une pièce change d'étape, un personnage va la chercher et la porte.
   Le calcul (plan, rangement, chemins) est dans plan3d.js, le dessin dans scene3d.js (Three.js, chargé seulement à l'ouverture). */
/** Quartier des acheteurs : un immeuble par acheteur, plus il achète plus il est haut ; les meilleurs au centre. */
const TAG_COL = { fidele: 0x4aa56a, revenu: 0x3b82c4, nouveau: 0xd9c9a3, offre: 0xe8a33d, prospect: 0xb4b8bd };
export function layoutTown(C, o = {}) {
  const keep = o.keep || (() => true), td = o.today || new Date().toISOString().slice(0, 10), list = C.slice().sort((a, b) => b.ca - a.ca || b.n - a.n).slice(0, 80);
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length))), rows = Math.max(1, Math.ceil(list.length / cols)), cell = 7, cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r, Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2)]);
  cells.sort((a, b) => a[2] - b[2]);
  const buildings = [], pins = [];
  list.forEach((c, i) => {
    const [cx, cz] = cells[i], x = cx * cell + cell / 2, z = cz * cell + cell / 2, h = 1.8 + Math.min(c.n, 12) * 1.15, bad = c.bl || c.score < 40;
    const b = { k: c.k, nom: c.nom, x, z, w: 3.4, h, n: c.n, ca: c.ca, score: c.score, bl: c.bl, tag: c.tag, offres: c.offres.length, color: bad ? 0x8a5a5a : (TAG_COL[c.tag] || 0xb4b8bd), dim: !keep(c) };
    buildings.push(b);
    if (c.relance && c.relance <= td) pins.push({ kind: 'alert', x, y: h + 1.2, z, buyerKey: c.k, text: '!', label: '@' + c.nom });
    else if (c.bl) pins.push({ kind: 'alert', x, y: h + 1.2, z, buyerKey: c.k, text: '×', label: '@' + c.nom });
    else if (c.offres.length) pins.push({ kind: 'offre', x, y: h + 1.2, z, buyerKey: c.k, text: String(c.offres.length), label: '@' + c.nom });
  });
  return { buildings, pins, total: C.length, shown: list.length, cell, bounds: { minX: -1, maxX: cols * cell + 1, minZ: -1, maxZ: rows * cell + 1 } };
}


/* ---------- le panneau intégré au CRM : la vue de base ---------- */
/* Le CRM redessine son contenu souvent ; la scène 3D, elle, est créée une seule fois et simplement déplacée dans la nouvelle case (#wh_slot).
   Toucher une pièce ouvre sa fiche par-dessus : on la ferme et la 3D est exactement comme avant. */
let glOk = null;
export const canGL = () => { if (glOk === null) { try { const c = document.createElement('canvas'); glOk = !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { glOk = false; } } return glOk; };
const coarse = () => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };
const FS = { m: '', c: '', b: '', al: true, view: LSg('whView', 'wh'), edit: false, sel: '', full: false, q: LSg('whQ', coarse() ? 'low' : 'high') };
const S = { host: null, sc: null, loading: false, failed: false, sig: '' };
const crmCfg = () => app.cfg.crm || {};
const saveCrm = patch => app.setCfg({ crm: Object.assign({}, crmCfg(), patch) });
const placeNow = () => (PLACES[crmCfg().place] ? crmCfg().place : 'wh');
const uniqP = f => [...new Set(app.P.filter(inPipeline).map(f).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
const stageName = id => (stages().find(s => s[0] === id) || [id, id])[1];

/** Plan courant : celui que tu as enregistré, sinon le plan de départ (enregistré tout de suite, pour que les meubles gardent leur identité).
    Les bacs qui n'ont pas encore de meuble prennent les meubles libres, comme on range une nouvelle caisse dans une étagère vide. */
function currentPlan() {
  const place = placeNow(), bacs = uniqP(p => p.bac || p.ballot);
  let plan = getPlan(crmCfg(), place, bacs), changed = !((crmCfg().plans || {})[place]);
  if (!FS.edit) {
    const have = new Set(plan.items.filter(i => i.bac !== undefined).map(i => i.bac));
    bacs.filter(b => !have.has(b)).forEach(b => { const it = plan.items.find(i => TYPES[i.type].kind === 'store' && i.bac === undefined); if (it) { plan = setProps(plan, it.id, { bac: b }); changed = true; } });
  }
  if (changed) saveCrm({ plans: Object.assign({}, crmCfg().plans, { [place]: plan }) });
  return plan;
}
const keepP = p => { const q = FS.b.toLowerCase().replace(/^@/, ''); return (!FS.m || p.marque === FS.m) && (!FS.c || p.cat === FS.c) && (!q || [title(p), p.code, p.acheteur, (p.offre || {}).a, p.marque].join(' ').toLowerCase().includes(q)); };
const keepC = c => !FS.b || c.nom.toLowerCase().includes(FS.b.toLowerCase().replace(/^@/, ''));
const planSig = () => JSON.stringify(crmCfg().plans || {}).length + '|' + placeNow() + '|' + FS.edit;
const sigNow = () => signature(app.P) + '|' + FS.view + FS.m + FS.c + FS.b + FS.al + '|' + planSig() + (FS.view === 'town' ? JSON.stringify(crmCfg().c || {}).length : '');
export const signature = P => P.filter(inPipeline).map(p => p.id + ':' + stageOf(p) + ':' + (p.bac || p.ballot || '') + (expired(p) ? '!' : '')).join('|');

export function whPanel() {
  const wh = FS.view === 'wh', place = placeNow();
  return `<div id="wh_wrap" class="whw${FS.full ? ' whfs' : ''}"><div class="chips" style="margin-bottom:8px"><button type="button" class="chip sm${wh ? ' on' : ''}" data-whv="wh">${t('Lieu de stockage')}</button><button type="button" class="chip sm${wh ? '' : ' on'}" data-whv="town">${t('Quartier des acheteurs')}</button>${wh ? `<button type="button" class="chip sm${FS.al ? ' on' : ''}" id="wh_al">${t('Alertes')}</button>` : ''}<button type="button" class="chip sm" id="wh_rc">${t('Recentrer')}</button><button type="button" class="chip sm${FS.full ? ' on' : ''}" id="wh_fs">${t(FS.full ? 'Quitter le plein écran' : 'Plein écran')}</button><button type="button" class="chip sm" id="wh_q" data-q="${FS.q}">${t(FS.q === 'high' ? 'Graphismes : élevés' : 'Graphismes : légers')}</button></div>
   ${wh ? `<div class="chips" style="margin-bottom:8px">${Object.keys(PLACES).map(k => `<button type="button" class="chip sm${place === k ? ' on' : ''}" data-whp="${k}">${t(PLACES[k])}</button>`).join('')}<button type="button" class="chip sm${FS.edit ? ' on' : ''}" id="wh_ed">${t(FS.edit ? 'Terminer la modification' : 'Modifier le plan')}</button></div>` : ''}
   <div class="chips whc">${wh ? `<select id="wh_m" aria-label="${esc(t('Marque'))}"><option value="">${t('Toutes les marques')}</option>${uniqP(p => p.marque).map(x => `<option value="${esc(x)}"${FS.m === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
   <select id="wh_c" aria-label="${esc(t('Catégorie'))}"><option value="">${t('Toutes les catégories')}</option>${uniqP(p => p.cat).map(x => `<option value="${esc(x)}"${FS.c === x ? ' selected' : ''}>${esc(tv(x))}</option>`).join('')}</select>` : ''}
   <input type="search" id="wh_b" value="${esc(FS.b)}" placeholder="${esc(t(wh ? 'Chercher une pièce, un code, un acheteur' : 'Chercher un acheteur (@pseudo)'))}" autocomplete="off" autocapitalize="none"></div>
   <div id="wh_slot" class="wh3d"></div><div id="wh_m2" class="hint"></div>
   <div id="wh_edit">${wh ? editHTML() : ''}</div>
   <p class="hint">${t(wh ? (FS.edit ? 'Glisse un meuble pour le déplacer : il se cale sur la grille de 50 cm et refuse de passer à travers un autre meuble ou un mur.' : 'Touche un colis pour voir son nom, un second toucher ouvre la fiche. Maintiens un colis et glisse-le vers une zone ou un meuble pour le faire avancer : un personnage le porte.') : 'Un immeuble par acheteur : plus il achète, plus il est haut. Touche un immeuble pour ouvrir sa fiche.')}</p></div>`;
}
/** Barre d'édition : ajouter un meuble, et réglages du meuble choisi. */
function editHTML() {
  if (!FS.edit) return '';
  const plan = currentPlanSilent(), it = plan.items.find(i => i.id === FS.sel), K = it && TYPES[it.type].kind;
  const bacs = uniqP(p => p.bac || p.ballot), sz = sizeOf(placeNow(), plan);
  return `<div class="card cxdup"><div class="chips whc"><select id="wh_type" aria-label="${esc(t('Meuble'))}">${Object.keys(TYPES).map(k => `<option value="${k}">${esc(t(TYPES[k].n))}</option>`).join('')}</select><button type="button" class="chip sm" id="wh_add">${t('Ajouter')}</button></div>
   ${it ? `<div class="hint" style="margin:8px 0 4px"><b>${esc(t(TYPES[it.type].n))}</b></div>
   ${K === 'store' ? `<div class="fld"><label class="l" for="wh_bacin">${t('Bac rangé ici')}</label><input type="text" id="wh_bacin" list="wh_bacl" value="${esc(it.bac === undefined ? '' : it.bac)}" placeholder="${esc(t('(libre)'))}" autocomplete="off"><datalist id="wh_bacl">${bacs.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>` : ''}
   ${K === 'stage' ? `<div class="fld"><label class="l" for="wh_stg">${t('Étape')}</label><select id="wh_stg">${stages().filter(s => !STORE_STAGES.includes(s[0])).map(s => `<option value="${esc(s[0])}"${it.stage === s[0] ? ' selected' : ''}>${esc(s[1])}</option>`).join('')}</select></div>` : ''}
   <div class="chips" style="margin-top:6px"><button type="button" class="chip sm" id="wh_rot">${t('Tourner')}</button><button type="button" class="chip sm" id="wh_dup">${t('Dupliquer')}</button><button type="button" class="chip sm" id="wh_del">${t('Supprimer')}</button></div>` : `<div class="hint" style="margin-top:8px">${t('Touche un meuble pour le régler.')}</div>`}
   <div class="hint" style="margin:10px 0 4px"><b>${t('Taille du lieu')}</b> : ${sz.w} × ${sz.d} m</div><div class="chips"><button type="button" class="chip sm" data-whz="-w">${t('Largeur')} −</button><button type="button" class="chip sm" data-whz="+w">${t('Largeur')} +</button><button type="button" class="chip sm" data-whz="-d">${t('Profondeur')} −</button><button type="button" class="chip sm" data-whz="+d">${t('Profondeur')} +</button></div>
   <div class="chips" style="margin-top:8px"><button type="button" class="chip sm" id="wh_reset">${t('Remettre le plan de départ')}</button></div></div>`;
}
const currentPlanSilent = () => getPlan(crmCfg(), placeNow(), uniqP(p => p.bac || p.ballot));
const renderEdit = () => { const e = $('wh_edit'); if (e) e.innerHTML = FS.view === 'wh' ? editHTML() : ''; };

const infoOf = id => {
  const p = app.P.find(x => x.id === id); if (!p) return null; const st = stageOf(p), pr = sold(p) ? p.pv : p.pvise || (p.offre || {}).m || 0;
  return { title: title(p), size: p.taille ? t('Taille {s}', { s: p.taille }) : '', price: pr ? eur(pr) : '', stageLabel: stageName(st), code: p.code || '', cat: p.cat, catLabel: tv(p.cat), openLabel: t('Ouvrir la fiche') };
};
const loadImg = blob => new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
const photoFor = id => { const p = app.P.find(x => x.id === id); return p && p.photo ? phBlob(p.photo).then(loadImg).catch(() => null) : Promise.resolve(null); };

function refresh() {
  if (!S.sc) return; S.sig = sigNow();
  if (FS.view === 'town') { const d = layoutTown(contacts(), { keep: keepC }); S.sc.setTown(d); const m = $('wh_m2'); if (m) m.textContent = d.total > d.shown ? t('{n} acheteurs affichés sur {m}', { n: d.shown, m: d.total }) : ''; return; }
  const place = placeNow(), plan = currentPlan(), tpl = template(place, plan), quiet = !!S.quiet; S.quiet = false;
  const placed = placePieces(app.P, plan, { inPipeline, stageOf, expired, slowParcel, title, keep: keepP });
  if (!FS.al) placed.pins = placed.pins.filter(p => p.kind !== 'alert');
  S.sc.setPlace({ tpl, plan, placed, stageNames: Object.fromEntries(stages().map(s => [s[0], s[1]])), quiet });
  const a = app.P.filter(p => expired(p) || slowParcel(p)).length, m = $('wh_m2'), bits = [];
  if (placed.unplaced.length) bits.push(t('{n} pièce(s) sans emplacement : ajoute un meuble ou une zone pour elles.', { n: placed.unplaced.length }));
  if (placed.misplaced.length) bits.push(t('{n} pièce(s) rangées faute de meuble pour leur bac.', { n: placed.misplaced.length }));
  if (a) bits.push(t('{n} pièce(s) demandent ton attention (pins rouges).', { n: a }));
  if (m) m.textContent = bits.join(' ');
}
const fail = msg => { S.failed = true; S.loading = false; const s = $('wh_slot'); if (s) s.innerHTML = `<div class="hint" style="padding:16px">${esc(msg)} <button type="button" class="chip sm" data-crs="pipe">${t('Voir le pipeline')}</button></div>`; };
const commitPlan = plan => { if (!plan) return false; const place = placeNow(); S.quiet = true; saveCrm({ plans: Object.assign({}, crmCfg().plans, { [place]: plan }) }); refresh(); renderEdit(); return true; };
/** Place la scène dans la case du CRM (la crée au premier appel). */
export async function whMount(slot) {
  if (!slot) return;
  if (S.sc) { slot.appendChild(S.host); S.sc.resize(); S.sc.setEdit(FS.edit && FS.view === 'wh'); if (sigNow() !== S.sig) refresh(); return; }
  if (S.failed) return fail(t('La 3D n\'est pas disponible sur cet appareil.'));
  slot.innerHTML = `<div class="hint" style="padding:16px">${t('Chargement de la 3D…')}</div>`;
  if (S.loading) return; S.loading = true;
  let T, OC, X = {}; try { let RB, RE; [T, { OrbitControls: OC }, { RoundedBoxGeometry: RB }, { RoomEnvironment: RE }] = await Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js'), import('three/examples/jsm/geometries/RoundedBoxGeometry.js'), import('three/examples/jsm/environments/RoomEnvironment.js')]); X = { RB, RE }; try { const [{ GLTFLoader: GL }, SU] = await Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/utils/SkeletonUtils.js')]); X.GL = GL; X.SU = SU; } catch (e) { /* sans modèles importés : formes simples */ } } catch (e) { return fail(t('La 3D n\'a pas pu se charger : vérifie ta connexion puis réessaie.')); }
  const { createScene } = await import('./scene3d.js');
  S.host = document.createElement('div'); S.host.style.cssText = 'width:100%;height:100%';
  const cur = $('wh_slot'); if (!cur) { S.loading = false; return; } cur.innerHTML = ''; cur.appendChild(S.host);
  try {
    S.sc = createScene(T, OC, S.host, {
      info: infoOf, photoFor,
      onSelect: id => { FS.sel = id; renderEdit(); },
      onPlan: commitPlan,
      onPick: h => { if (h.box) return app.openSheet(h.box.id); if (h.building) return app.openContact(h.building); if (h.pin.pieceId) return app.openSheet(h.pin.pieceId); if (h.pin.buyerKey) return app.openContact(h.pin.buyerKey); if (h.pin.zoneId) app.toast(t('{n} pièce(s) : {z}', { n: h.pin.text, z: h.pin.label })); },
      quality: FS.q, extra: X,
      onDrop: (id, target) => {
        const p = app.P.find(x => x.id === id); if (!p) return; const it = currentPlanSilent().items.find(i => i.id === target), k = it && TYPES[it.type].kind;
        if (k === 'stage') moveTo(id, it.stage);
        else { if (it && it.bac !== undefined && it.bac !== (p.bac || '')) { const q = Object.assign({}, p); if (it.bac) q.bac = it.bac; else delete q.bac; app.save(q); } if (!STORE_STAGES.includes(stageOf(app.P.find(x => x.id === id)))) moveTo(id, 'ligne'); }
        refresh();
      },
    });
  } catch (e) { return fail(t('La 3D n\'est pas disponible sur cet appareil.')); }
  S.loading = false; S.sc.setQuality(FS.q); S.sc.setEdit(FS.edit && FS.view === 'wh'); refresh();
  setInterval(() => { if (S.host && S.host.isConnected && sigNow() !== S.sig) refresh(); }, 900);
}
let armed = 0;
/** Plein écran : la zone 3D (avec ses boutons) couvre tout l'écran ; on demande aussi le plein écran du navigateur quand il existe. */
function setFull(on) {
  FS.full = !!on; document.body.classList.toggle('whfs-on', FS.full);
  try { if (FS.full && document.documentElement.requestFullscreen) { const r = document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => {}); } else if (!FS.full && document.fullscreenElement && document.exitFullscreen) { const r = document.exitFullscreen(); if (r && r.catch) r.catch(() => {}); } } catch (e) { /* plein écran du navigateur indisponible : la version intégrée suffit */ }
  if (app.crmSub) app.crmSub('3d'); if (S.sc) setTimeout(() => S.sc.resize(), 60);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && FS.full) setFull(false); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && FS.full) setFull(false); });
document.addEventListener('click', e => {
  const c = e.target.closest && e.target.closest.bind(e.target); if (!c) return;
  if (c('#wh_fs')) return setFull(!FS.full);
  if (c('#wh_q')) { FS.q = FS.q === 'high' ? 'low' : 'high'; LSs('whQ', FS.q); if (S.sc) S.sc.setQuality(FS.q); const b = $('wh_q'); if (b) b.textContent = t(FS.q === 'high' ? 'Graphismes : élevés' : 'Graphismes : légers'); return; }
  const v = c('[data-whv]'); if (v && $('wh_slot')) { FS.view = v.dataset.whv; LSs('whView', FS.view); return app.crmSub && app.crmSub('3d'); }
  const pl = c('[data-whp]'); if (pl && $('wh_slot')) { FS.sel = ''; saveCrm({ place: pl.dataset.whp }); return app.crmSub && app.crmSub('3d'); }
  if (c('#wh_ed')) { FS.edit = !FS.edit; FS.sel = ''; return app.crmSub && app.crmSub('3d'); }
  if (c('#wh_al')) { FS.al = !FS.al; c('#wh_al').classList.toggle('on', FS.al); return refresh(); }
  if (c('#wh_rc') && S.sc) return S.sc.recenter();
  if (!$('wh_edit') || !FS.edit) return;
  const plan = currentPlanSilent(), tpl = template(placeNow(), plan);
  const zb = c('[data-whz]'); if (zb) { const [sg, ax] = [zb.dataset.whz[0], zb.dataset.whz[1]], dl = (sg === '+' ? 1 : -1) * SIZE_LIMITS.step, n = resizePlan(plan, placeNow(), ax === 'w' ? dl : 0, ax === 'd' ? dl : 0); if (!n) return app.toast(t('Impossible : un meuble ne tiendrait plus, ou le lieu serait trop petit ou trop grand.')); S.quiet = true; commitPlan(n); if (S.sc) S.sc.recenter(); return; }
  if (c('#wh_add')) { const r = addItem(plan, tpl, $('wh_type').value, undefined, undefined, TYPES[$('wh_type').value].kind === 'stage' && $('wh_type').value !== 'table' ? { stage: 'offre' } : {}); if (!r) return app.toast(t('Plus de place pour ce meuble.')); FS.sel = r.id; commitPlan(r.plan); if (S.sc) S.sc.select(r.id); return; }
  if (!FS.sel) return;
  if (c('#wh_rot')) { const n = rotateItem(plan, tpl, FS.sel); return n ? commitPlan(n) : app.toast(t('Il n\'y a pas la place de tourner ce meuble.')); }
  if (c('#wh_dup')) { const r = dupItem(plan, tpl, FS.sel); if (!r) return app.toast(t('Plus de place pour ce meuble.')); FS.sel = r.id; commitPlan(r.plan); if (S.sc) S.sc.select(r.id); return; }
  if (c('#wh_del')) { const id = FS.sel; FS.sel = ''; commitPlan(removeItem(plan, id)); if (S.sc) S.sc.select(''); return; }
  if (c('#wh_reset')) { if (Date.now() - armed < 4000) { const place = placeNow(), pl = Object.assign({}, crmCfg().plans); delete pl[place]; FS.sel = ''; S.quiet = true; saveCrm({ plans: pl }); armed = 0; refresh(); renderEdit(); return app.toast(t('Plan de départ remis')); } armed = Date.now(); app.toast(t('Touche encore pour effacer ton plan et revenir au plan de départ')); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'wh_m') { FS.m = e.target.value; refresh(); } else if (e.target.id === 'wh_c') { FS.c = e.target.value; refresh(); }
  else if (e.target.id === 'wh_stg' && FS.sel) commitPlan(setProps(currentPlanSilent(), FS.sel, { stage: e.target.value }));
  else if (e.target.id === 'wh_bacin' && FS.sel) { const v = e.target.value.trim(), q = {}; q.bac = v === '' ? undefined : v === t('Sans bac') ? '' : v; commitPlan(setProps(currentPlanSilent(), FS.sel, q)); }
});
document.addEventListener('input', e => { if (e.target.id === 'wh_b') { FS.b = e.target.value.trim(); refresh(); } });
/** « Entrepôt 3D » depuis ailleurs : ouvre le CRM sur la vue 3D. */
export function openWarehouse() { if (app.setStockMode) app.setStockMode('crm'); if (app.crmSub) app.crmSub('3d'); go('list'); }
app.openWarehouse = openWarehouse; app.whPanel = whPanel; app.whMount = whMount; app.whCan = canGL;
