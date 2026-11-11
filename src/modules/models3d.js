/* Modèles 3D importés (packs Kenney, licence CC0 : voir public/models/CREDITS.txt).
   Tout est chargé à la demande, jamais d'avance : si un modèle ne charge pas (hors ligne, mode léger), la scène garde ses formes simples. */

export const BASE = './models/';

/** Meubles remplacés par un modèle. Les meubles de rangement (rack, étagère, penderie, commode, table) gardent leurs
    étages d'origine, car les colis y sont posés à des hauteurs précises. */
export const FURN = {
  sofa: m => ({ f: 'meubles/' + (m.w >= 2.6 ? 'loungeSofaLong' : 'loungeSofa'), fit: 'free' }),
  bed: m => ({ f: 'meubles/' + (Math.min(m.w, m.d) >= 1.5 ? 'bedDouble' : 'bedSingle'), fit: 'free' }),
  desk: () => ({ f: 'meubles/desk', fit: 'free' }),
  plant: () => ({ f: 'meubles/pottedPlant', fit: 'uniform' }),
};
/** it = meuble du plan, m = ses dimensions { w, d, h } en mètres (déjà tournées de 0). */
export const furnModel = (it, m) => (FURN[it.type] ? FURN[it.type](m) : null);

/** Accessoires posés au décor (sans gêner les déplacements : tapis à plat, lampes et poubelle contre les murs). */
export function propsFor(tpl) {
  const b = tpl.bounds, out = [];
  if (tpl.shell === 'wh') return out;
  (tpl.rooms || [{ x0: b.minX, x1: b.maxX, z0: b.minZ, z1: b.maxZ }]).forEach((r, i) => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    if (w >= 3 && d >= 3) out.push({ f: 'meubles/rugRectangle', x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: Math.min(3, w * 0.45), d: Math.min(2, d * 0.35), fit: 'free', flat: true });
    out.push({ f: 'meubles/lampRoundFloor', x: r.x0 + 0.45, z: r.z1 - 0.45, h: 1.5, fit: 'uniform' });
    if (i === 0) out.push({ f: 'meubles/trashcan', x: r.x1 - 0.4, z: r.z0 + 0.4, h: 0.55, fit: 'uniform' });
  });
  return out;
}

const hash = s => { let h = 0; String(s || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return h; };
const LOW = 'abcdefghijklmn'.split('').map(l => 'ville/building-' + l), TALL = 'abcde'.split('').map(l => 'ville/building-skyscraper-' + l);
/** Immeuble d'un acheteur : grand gabarit → gratte-ciel ; le modèle est choisi de façon stable d'après la clé de l'acheteur. */
export const buildingModel = bl => { const L = bl.h / Math.max(0.1, bl.w) > 3.4 ? TALL : LOW; return L[hash(bl.k || bl.nom) % L.length]; };

const CHARS = { prep: ['character-female-a', 'character-male-c', 'character-female-d'], quai: ['character-worker', 'character-male-e'], cariste: ['character-male-a'] };
/** Personnage d'un rôle (i = rang de l'agent, pour varier quand plusieurs ont le même rôle). */
export const charModel = (role, i) => { const L = CHARS[role] || CHARS.prep; return 'persos/' + L[(i || 0) % L.length]; };

/** Échelle pour faire tenir une boîte (bw,bh,bd) dans une cible : cible = { w, d, h } (h facultatif). */
export function fitScale(box, tgt, mode) {
  const sx = tgt.w ? tgt.w / box.w : 0, sz = tgt.d ? tgt.d / box.d : 0, sy = tgt.h ? tgt.h / box.h : 0;
  if (mode === 'free') { const u = sx && sz ? (sx + sz) / 2 : (sx || sz || sy || 1); return { x: sx || u, y: sy || u, z: sz || u }; }
  const u = sy || Math.min(...[sx, sz].filter(Boolean)) || 1; return { x: u, y: u, z: u };
}

/** Bibliothèque de modèles : chargement unique par fichier, copie propre à chaque usage (les squelettes se copient avec SkeletonUtils). */
export function createLibrary(T, GL, SU, base = BASE) {
  const loader = new GL(), cache = new Map();
  const prepare = root => root.traverse(o => {
    if (!o.isMesh) return; o.userData.shared = true; o.castShadow = true; o.receiveShadow = true;
    const fix = m => { if (!m || !m.isMeshBasicMaterial) return m; const s = new T.MeshStandardMaterial({ map: m.map, color: m.color, roughness: 0.88, metalness: 0, transparent: m.transparent, opacity: m.opacity }); if (s.map) s.map.colorSpace = T.SRGBColorSpace; return s; };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
  });
  const load = f => { let p = cache.get(f); if (!p) { p = new Promise((ok, ko) => loader.load(base + f + '.glb', ok, undefined, ko)).then(g => { prepare(g.scene); return g; }); p.catch(() => cache.delete(f)); cache.set(f, p); } return p; };
  /** Renvoie { obj, anims } : obj est un Group prêt à poser, posé au sol et centré sur x/z, mis à l'échelle de la cible. */
  const get = async (f, tgt, mode) => {
    const g = await load(f), obj = SU.clone(g.scene), box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3());
    if (tgt) { const s = fitScale({ w: size.x || 1, h: size.y || 1, d: size.z || 1 }, tgt, mode); obj.scale.set(s.x, s.y, s.z); }
    const b2 = new T.Box3().setFromObject(obj), c = b2.getCenter(new T.Vector3()), wrap = new T.Group(); obj.position.set(-c.x, -b2.min.y, -c.z); wrap.add(obj);
    return { obj: wrap, anims: g.animations || [], height: b2.max.y - b2.min.y };
  };
  return { load, get };
}
