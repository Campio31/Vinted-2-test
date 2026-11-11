import { app } from '../state.js';
import { $, esc, eur, isnum, num, title } from './core.js';
import { catSvg, pastel } from './stock-view.js';
import { hydrate, phImg } from './photos.js';
import { COLORS } from './form.js';

/* ---------- Ajouter, sur ordinateur : la fiche se construit à droite pendant la saisie ---------- */
/* L'aperçu est caché sur téléphone (CSS) ; il est redessiné à chaque changement du formulaire. */
const ROWS = [
  ['cat', 'Catégorie'], ['sub', 'Type'], ['marque', 'Marque'], ['genre', 'Genre'], ['taille', 'Taille'], ['coul', 'Couleurs'], ['mat', 'Matière'], ['madein', 'Made in'],
  ['grade', 'Grade'], ['etat', 'État'], ['defauts', 'Défauts'], ['achat', 'Prix d\'achat'], ['conseil', 'Prix conseillé'], ['prov', 'Provenance'], ['envoi', 'Colis'], ['stk', 'Compte'], ['ballot', 'Ballot'], ['bac', 'Bac'], ['entree', 'Entrée'],
];
const val = (S, k) => {
  if (k === 'coul') return (S.coul || []).map(c => `<span class="fpc"><i style="background:${esc((COLORS[c] || ['#ccc'])[0])}"></i>${esc(t(c))}</span>`).join('');
  if (k === 'mat') return (S.mat || []).map(x => esc(tv(x))).join(', ');
  if (k === 'defauts') return /^neuf/i.test(S.etat || '') ? '' : (S.defauts || []).map(x => esc(tv(x))).join(', ');
  if (k === 'achat') return isnum(S.achat) || (S.achat !== '' && S.achat != null && !isNaN(num(S.achat))) ? esc(eur(num(S.achat))) : '';
  if (k === 'conseil') { try { const a = S.cat ? app.advice(S) : null; return a && a.ok && a.reco > 0 ? esc(eur(a.reco)) : ''; } catch (e) { return ''; } }
  if (k === 'grade') return S.grade ? `<span class="pill g-${esc(S.grade)}">${esc(S.grade)}</span>` : '';
  if (k === 'stk') return esc(((app.hasComptes() ? app.comptes() : []).find(c => c.id === S.stk) || {}).n || '');
  if (k === 'envoi') { const kg = S.poids || ''; return kg ? esc(kg + ' kg') + (app.cfg.shipOn && app.shipFor ? ' · ' + esc(eur(app.shipFor(S))) : '') : ''; }
  if (k === 'madein') return esc(S.madein || '');
  if (k === 'entree') return S.entree ? esc(S.entree) : '';
  if (k === 'cat' || k === 'sub' || k === 'genre' || k === 'prov' || k === 'etat') return esc(tv(S[k]));
  return esc(S[k] || '');
};
export function fichePrev(S) {
  const box = $('fprev'); if (!box) return;
  const [bg, fg] = pastel(S);
  const hide = k => (k === 'stk' && !app.hasComptes());
  const rows = ROWS.filter(([k]) => !hide(k)).map(([k, l]) => { const v = val(S, k); return { k, l, v }; });
  const need = rows.filter(r => !['conseil', 'defauts', 'ballot', 'bac', 'stk', 'entree', 'mat', 'madein', 'coul'].includes(r.k));
  const done = need.filter(r => r.v).length, pct = Math.round(done / need.length * 100);
  box.innerHTML = `<div class="fph"><span class="mono">${t('Aperçu de la fiche')}</span><span class="fpc2">${esc(S.code || S._code || '')}</span></div>
   <div class="fpbody"><div class="fpl"><div class="fpi" style="background:${bg};color:${fg}">${S.photo ? phImg(S.photo) : catSvg(S)}</div>
   <h3 class="fpt">${esc(title(S))}${S.taille ? ' · ' + esc(S.taille) : ''}</h3>
   <div class="fpm"><i style="width:${pct}%"></i></div><div class="hint">${t('{a} sur {b} infos principales remplies', { a: done, b: need.length })}</div></div>
   <dl class="kv">${rows.map(r => `<dt>${t(r.l)}</dt><dd${r.v ? '' : ' class="fpe"'}>${r.v || '—'}</dd>`).join('')}</dl></div>`;
  hydrate();
}
app.fichePrev = fichePrev;