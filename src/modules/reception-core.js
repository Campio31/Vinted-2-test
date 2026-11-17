/* ---------- Réceptionner un carton : le moteur (pur, sans écran) ----------
   Spécification « Max — Parcours de travail », mode Réception. Une réception décrit un carton reçu : quantités attendues et constatées par grade, écarts,
   et où vont les pièces (brouillons de fiches, ballot pour un live, à isoler, à traiter). Elle ne crée pas de catalogue parallèle : les fiches sont des fiches Max ordinaires.
   Règles tenues ici : un champ vide veut dire « non renseigné », jamais zéro ; une pièce a un seul état physique (brouillons + ballot + isolées + à traiter = reçues) ;
   les écarts sont descriptifs et ne touchent pas deux fois au stock ; la validation est rejouable (identifiants de fiches stables). */

export const GRADES = ['A', 'B', 'C'];
export const SLOT_KEYS = ['A', 'B', 'C', 'V'];                 /* V = « à vérifier » : reçue, pas manquante */
export const TARGETS = ['draft', 'ballot', 'quarantine', 'unprocessed'];
export const ISSUE_TYPES = ['missing', 'extra', 'grade', 'defect', 'item', 'other'];
const isN = x => typeof x === 'number' && isFinite(x);
const int = v => { if (v === '' || v == null) return null; const n = Math.floor(+String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : null; };
export const cl = o => JSON.parse(JSON.stringify(o));
export const emptyStore = () => ({ v: 1, items: [], seq: 1 });

/** Nouveau brouillon de réception. `o.ballot` : nom du ballot existant ou nouveau. */
export function newReception(store, o) {
  const s = cl(store), n = s.seq++, id = 'rc' + n + '-' + Math.random().toString(36).slice(2, 6);
  const r = Object.assign({ id, state: 'draft', step: 1, rev: 0, ballot: '', supplier: '', receivedAt: '', orderRef: '', costCents: null, expectedTotal: null, expected: { A: null, B: null, C: null },
    closeWait: false, mode: 'count', counts: { A: null, B: null, C: null, V: null }, closedTotal: null, unverified: false, issues: [], alloc: {}, opId: null, done: [], created: [], history: [] }, o || {});
  s.items.unshift(r); return { store: s, id };
}
export const find = (store, id) => store.items.find(x => x.id === id) || null;
/** Modifie un brouillon (jamais une réception confirmée) : `patch` est fusionné ; la révision augmente. Un patch fondé sur une révision périmée est refusé. */
export function patch(store, id, rev, p) {
  const s = cl(store), r = find(s, id); if (!r) return { store, error: 'inconnue' };
  if (r.state !== 'draft') return { store, error: 'verrouillee' };
  if (rev != null && rev !== r.rev) return { store, error: 'revision' };
  Object.keys(p).forEach(k => { r[k] = p[k]; }); r.rev++; return { store: s, error: null };
}

/* ---------- quantités ---------- */
/** Total reçu ; null = non vérifié / non renseigné (jamais 0 par défaut). */
export function receivedTotal(r) {
  if (r.mode === 'closed') return r.unverified ? null : (isN(r.closedTotal) ? r.closedTotal : null);
  const v = SLOT_KEYS.map(k => r.counts[k]).filter(isN); return v.length ? v.reduce((a, b) => a + b, 0) : null;
}
export const receivedOf = (r, k) => (r.mode === 'closed' ? 0 : (isN(r.counts[k]) ? r.counts[k] : 0));
const expKnown = r => GRADES.some(g => isN(r.expected[g]));
/** Total attendu : celui saisi, sinon la somme des grades attendus, sinon null. */
export function expectedTotalOf(r) { if (isN(r.expectedTotal)) return r.expectedTotal; const v = GRADES.map(g => r.expected[g]).filter(isN); return v.length ? v.reduce((a, b) => a + b, 0) : null; }
/** Écarts d'un carton. `before` = déjà reçu sur la même commande lors de livraisons confirmées antérieures (nombre).
   Ex. 50 A attendues, 42 A + 6 B reçues : 48 reçues, 2 manquantes (si l'attente est close), 6 déclassées. Jamais « 8 manquantes ». */
export function gaps(r, before) {
  const rec = receivedTotal(r), exp = expectedTotalOf(r), b = isN(before) ? before : 0, out = { received: rec, expected: exp, missing: null, over: null, downgraded: null, remaining: null, known: rec != null && exp != null };
  if (rec == null || exp == null) return out;
  const total = b + rec;
  if (expKnown(r) && r.mode === 'count' && b === 0) {
    let def = 0, exc = 0; GRADES.forEach(g => { const e = isN(r.expected[g]) ? r.expected[g] : 0, c = receivedOf(r, g); if (c < e) def += e - c; else exc += c - e; });
    out.downgraded = Math.min(def, exc); const m = def - out.downgraded, o = exc - out.downgraded;
    out.pendingMissing = m; out.over = o;
  } else { out.downgraded = 0; out.pendingMissing = Math.max(0, exp - total); out.over = Math.max(0, total - exp); }
  out.remaining = Math.max(0, exp - total);
  out.missing = r.closeWait ? out.pendingMissing : 0;            /* « manquantes » seulement quand le vendeur clôt l'attente */
  if (!r.closeWait && out.pendingMissing > 0) out.remaining = out.pendingMissing;
  return out;
}

/* ---------- ventilation ---------- */
const al = (r, k) => Object.assign({ draft: null, ballot: null, quarantine: null }, r.alloc && r.alloc[k]);
/** Par grade : reçues, brouillons, ballot, isolées, reste à traiter. En mode fermé : une seule ligne « T » (ballot non trié). */
export function allocation(r) {
  if (r.mode === 'closed') {
    const a = al(r, 'T'), tot = receivedTotal(r), used = (a.draft || 0) + (a.ballot || 0) + (a.quarantine || 0);
    return { rows: [{ k: 'T', received: tot, draft: 0, ballot: tot == null ? null : (isN(a.ballot) ? a.ballot : tot - (a.quarantine || 0)), quarantine: a.quarantine || 0, unprocessed: tot == null ? null : Math.max(0, tot - (isN(a.ballot) ? a.ballot : tot - (a.quarantine || 0)) - (a.quarantine || 0)) }], total: { draft: 0, ballot: null, quarantine: a.quarantine || 0, unprocessed: null }, used };
  }
  const rows = SLOT_KEYS.map(k => { const rc = receivedOf(r, k), a = al(r, k), d = a.draft || 0, b = a.ballot || 0, q = a.quarantine || 0; return { k, received: rc, draft: d, ballot: b, quarantine: q, unprocessed: rc - d - b - q }; });
  const total = { draft: 0, ballot: 0, quarantine: 0, unprocessed: 0 }; rows.forEach(x => TARGETS.forEach(t => { total[t] += x[t]; }));
  return { rows, total };
}
/** Contrôles avant validation. Renvoie une liste de { code, … } ; vide = on peut valider. */
export function validate(r) {
  const e = [];
  if (!String(r.ballot || '').trim()) e.push({ code: 'ballot_manquant' });
  if (r.mode === 'closed') {
    const a = al(r, 'T'), tot = receivedTotal(r);
    if (a.draft) e.push({ code: 'brouillons_sans_tri' });
    if (tot != null && (a.ballot || 0) + (a.quarantine || 0) > tot) e.push({ code: 'ventilation_depasse', k: 'T' });
    if (r.unverified && a.quarantine) e.push({ code: 'quantite_inconnue_et_isolees' });
    return e;
  }
  if (receivedTotal(r) == null) e.push({ code: 'rien_compte' });
  allocation(r).rows.forEach(x => { if (x.unprocessed < 0) e.push({ code: 'ventilation_depasse', k: x.k, over: -x.unprocessed }); });
  return e;
}
/** Places à transformer en fiches : une par pièce envoyée vers « Créer les brouillons », dans l'ordre des grades. Identifiant stable. */
export function slots(r) {
  if (r.mode === 'closed') return [];
  const out = []; SLOT_KEYS.forEach(k => { const n = al(r, k).draft || 0; for (let i = 0; i < n; i++) out.push({ slot: k + '-' + i, grade: k === 'V' ? null : k, check: k === 'V', pieceId: 'rc-' + r.id + '-' + k + '-' + i }); });
  return out;
}
/** Part de coût par pièce, en euros arrondis au centime. Répartition indicative, pas un second achat. Sans coût ou sans total fiable : null (non renseigné). */
export function unitCost(r, ctx) {
  if (!isN(r.costCents)) return null;
  const total = ctx && isN(ctx.denominator) ? ctx.denominator : receivedTotal(r); if (!total) return null;
  return Math.round(r.costCents / total) / 100;
}
/** Fiche brouillon pour une place. `cost` : part de coût (euros) ou null. */
export function pieceFor(r, sl, cost, now) {
  const p = { id: sl.pieceId, statut: 'Pas Disponible', brouillon: 1, ballot: r.ballot, entree: r.receivedAt || undefined, cree: now || 0, rec: { id: r.id, slot: sl.slot } };
  if (r.supplier) p.prov = r.supplier; if (sl.grade) p.grade = sl.grade; if (sl.check) p.averifier = 1; if (cost != null) p.achat = cost; return p;
}
/** Résumé de ce que la validation va créer (écran 5). */
export function recap(r) {
  const a = allocation(r), g = gaps(r, 0), sl = slots(r);
  return { drafts: sl.length, ballot: a.total.ballot, quarantine: a.total.quarantine, unprocessed: a.total.unprocessed, received: receivedTotal(r), missing: g.missing, downgraded: g.downgraded, over: g.over, remaining: g.remaining, issues: r.issues.length, unverified: r.mode === 'closed' && r.unverified };
}

/* ---------- validation rejouable ---------- */
/** Prépare la validation : verrouille le brouillon et fixe l'identifiant d'opération. Un second appel avec le même identifiant ne change rien. */
export function beginConfirm(store, id, opId) {
  const s = cl(store), r = find(s, id); if (!r) return { store, error: 'inconnue', r: null };
  if (r.state === 'confirmed') return { store, error: null, r, already: true };
  if (r.state === 'confirming' && r.opId !== opId) return { store, error: 'autre_operation', r };
  if (r.state === 'draft') { const err = validate(r); if (err.length) return { store, error: 'invalide', details: err, r }; r.state = 'confirming'; r.opId = opId; }
  return { store: s, error: null, r: find(s, id) };
}
/** Note les fiches déjà créées ; quand toutes le sont, la réception passe à « confirmed ». */
export function markCreated(store, id, pieceIds, existing) {
  const s = cl(store), r = find(s, id); if (!r) return store;
  const need = slots(r).map(x => x.pieceId), have = new Set([...(r.created || []), ...pieceIds, ...(existing || [])]);
  r.created = need.filter(x => have.has(x));
  if (r.created.length === need.length) { r.state = 'confirmed'; r.history.push({ at: r.receivedAt || '', e: 'validee', n: need.length }); }
  return s;
}
/** Cumul reçu par livraisons confirmées d'une même commande (même ballot et même référence), hors la réception `exceptId`. */
export function priorReceived(store, ballot, orderRef, exceptId) {
  return store.items.filter(x => x.state === 'confirmed' && x.id !== exceptId && x.ballot === ballot && (x.orderRef || '') === (orderRef || '')).reduce((a, x) => a + (receivedTotal(x) || 0), 0);
}
/** Récap fournisseur : texte brut copiable. Les champs inconnus sont écrits comme tels. */
export function supplierText(r, t) {
  const g = gaps(r, 0), U = t('non renseigné'), n = v => (v == null ? U : String(v)), L = [];
  L.push(t('Récapitulatif de réception') + ' · ' + (r.ballot || U)); L.push(t('Fournisseur') + ' : ' + (r.supplier || U)); L.push(t('Commande') + ' : ' + (r.orderRef || U) + ' · ' + t('reçue le') + ' ' + (r.receivedAt || U));
  L.push(t('Attendu') + ' : ' + n(g.expected) + ' · ' + t('reçu') + ' : ' + n(g.received));
  if (r.mode === 'count') SLOT_KEYS.forEach(k => { if (isN(r.counts[k]) || isN(r.expected[k])) L.push('  ' + (k === 'V' ? t('À vérifier') : t('Grade') + ' ' + k) + ' : ' + t('attendu') + ' ' + n(isN(r.expected[k]) ? r.expected[k] : null) + ' / ' + t('reçu') + ' ' + n(isN(r.counts[k]) ? r.counts[k] : null)); });
  if (g.missing) L.push(t('Manquantes') + ' : ' + g.missing); if (g.downgraded) L.push(t('Déclassées') + ' : ' + g.downgraded); if (g.over) L.push(t('En trop') + ' : ' + g.over);
  r.issues.forEach(i => L.push('- ' + t(ISSUE_LABEL[i.type] || 'Autre') + (isN(i.qty) ? ' ×' + i.qty : '') + (i.note ? ' : ' + i.note : '') + (i.photos && i.photos.length ? ' (' + i.photos.length + ' ' + t('photo(s)') + ')' : '')));
  return L.join('\n');
}
export const ISSUE_LABEL = { missing: 'Quantité manquante', extra: 'Quantité en trop', grade: 'Grade différent', defect: 'Défaut', item: 'Article différent', other: 'Autre' };
