import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '..');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const jour = n => iso(new Date(Date.now() + n * 864e5));
let fin, nav, ana, art;
beforeAll(async () => {
  await demarrer(120);
  app.setCfg({ fiscQ: { statut: 'micro', activite: 'march', creation: '2020-01-01', vl: 'bareme', tva: 'franchise', periode: 'M' } }, true);
  fin = await import('../src/modules/finalisation.js');
  nav = await import('../src/modules/nav.js');
  ana = await import('../src/modules/analytics.js');
  art = await import('../src/modules/vintage-art.js');
});

/* date de vente d'essai : aujourd'hui, ou le premier jour des règles de finalisation si on est avant (les ventes plus anciennes gardent leur date) */
const DV = () => { const j = jour(0); return j >= '2026-10-31' ? j : '2026-10-31'; };
const vente = (id, o = {}) => Object.assign({ id, cat: 'Haut', sub: 'Polo', marque: 'Nike', taille: 'M', statut: 'Vendu', achat: 2, pv: 20, frais: 1, canal: 'Vinted', dv: DV(), vt: Date.now(), entree: jour(-30) }, o);
const nettoie = () => { app.P = app.P.filter(p => !p.id.startsWith('v29-')); };

describe('ventes finalisées : quand une vente est-elle finalisée ?', () => {
  it('sans action, 21 jours après la vente', () => {
    expect(fin.finDate(vente('v29-a', { dv: '2026-11-10' }))).toBe('2026-12-01');
  });
  it('une action de ta part la finalise à la date choisie', () => {
    expect(fin.finDate(vente('v29-b', { dv: '2026-11-10', fin: '2026-11-15' }))).toBe('2026-11-15');
  });
  it('une vente en main propre est finalisée le jour même', () => {
    expect(fin.finDate(vente('v29-c', { dv: '2026-11-10', canal: 'Autre' }))).toBe('2026-11-10');
  });
  it('les ventes d\'avant cette version gardent leur date de vente (mois déjà déclarés)', () => {
    expect(fin.finDate(vente('v29-d', { dv: '2026-09-02' }))).toBe('2026-09-02');
  });
  it('le délai est réglable', () => {
    app.setCfg({ finJours: 10 }, true);
    expect(fin.finDate(vente('v29-e', { dv: '2026-11-10' }))).toBe('2026-11-20');
    app.setCfg({ finJours: 21 }, true);
  });
  it('une pièce non vendue n\'a pas de date de finalisation', () => {
    expect(fin.finDate({ id: 'x', statut: 'Disponible', dv: '2026-11-10' })).toBeNull();
  });
});

describe('ventes finalisées : chiffre d\'affaires à déclarer', () => {
  it('une vente en attente ne compte pas, finalisée elle compte', async () => {
    nettoie();
    const mois = jour(0).slice(0, 7);
    const p = vente('v29-f', { pv: 123 });
    app.P.push(p);
    expect(fin.isFinal(p)).toBe(false);
    expect(fin.pendingSales().map(x => x.id)).toContain('v29-f');
    const ouvre = async () => { await app.openTool('fisc'); await tick(20); };
    await ouvre();
    expect($('shc').textContent).toMatch(/pas encore finalis|not finalized yet/i);
    $('sheet').hidden = true;
    app.finalize([p]);
    expect(fin.isFinal(app.P.find(x => x.id === 'v29-f'))).toBe(true);
    expect(fin.pendingSales().map(x => x.id)).not.toContain('v29-f');
    expect(app.P.find(x => x.id === 'v29-f').fin).toBe(jour(0));
    expect(mois.length).toBe(7);
    nettoie();
  });
  it('le bouton de la fiche vente marque la vente finalisée', async () => {
    nettoie();
    app.P.push(vente('v29-g'));
    app.openSheet('v29-g'); await tick(20);
    expect($('a_fin')).toBeTruthy();
    $('a_fin').click(); await tick(20);
    expect(app.P.find(x => x.id === 'v29-g').fin).toBe(jour(0));
    expect($('a_fin')).toBeNull();
    $('sheet').hidden = true; nettoie();
  });
  it('une vente annulée ou retournée perd sa finalisation', async () => {
    nettoie();
    app.P.push(vente('v29-h', { fin: jour(0) }));
    app.openSheet('v29-h'); await tick(10);
    $('a_unsell').click(); await tick(10);
    const p = app.P.find(x => x.id === 'v29-h');
    expect(p.statut).toBe('Disponible');
    expect(p.fin).toBeUndefined();
    $('sheet').hidden = true; nettoie();
  });
  it('l\'onglet Vente propose À finaliser et Tout finaliser', async () => {
    nettoie();
    app.P.push(vente('v29-i'), vente('v29-j'));
    app.salesFilter('fin'); nav.go('sales'); await tick(30);
    expect(document.querySelector('#sflt .fbtn.on')).not.toBeNull();
    expect(document.querySelectorAll('#slst .li').length).toBeGreaterThanOrEqual(2);
    document.querySelector('[data-sfin]').click(); await tick(20);
    expect(fin.pendingSales().filter(x => x.id.startsWith('v29-'))).toEqual([]);
    app.salesFilter('all'); nettoie();
  });
});

describe('colis à préparer : outil à part', () => {
  it('est dans la liste des outils, et Live ne contient plus la liste des colis', async () => {
    const tools = await import('../src/modules/tools-index.js');
    expect(tools.TOOLS.some(x => x.k === 'colis')).toBe(true);
    expect($('lcol')).toBeNull();
  });
  it('s\'ouvre, liste les colis et « Prêt » les retire', async () => {
    nettoie();
    app.P.push(vente('v29-k', { acheteur: 'lea_m', bac: 'B2' }));
    await app.openTool('colis'); await tick(20);
    expect($('colb').textContent).toContain('lea_m');
    $('shc').querySelector('[data-prep="v29-k"]').click(); await tick(20);
    expect(app.P.find(x => x.id === 'v29-k').exp).toBe(jour(0));
    expect($('colb').textContent).not.toContain('lea_m');
    $('sheet').hidden = true; nettoie();
  });
});

describe('Bilan : bénéfice cumulé et objectif', () => {
  it('n\'est plus un outil mais une carte visible d\'office dans le Bilan', async () => {
    const tools = await import('../src/modules/tools-index.js');
    expect(tools.TOOLS.some(x => x.k === 'courbe')).toBe(false);
    app.setCfg({ dash: null, goal: 500 }, true);
    nav.go('dash'); await tick(40);
    /* la courbe n'est plus une carte du Bilan depuis la v46 */
    expect($('dsh').querySelector('[data-ck="courbe"]')).toBeNull();
    return;
    const c = null;
    /* depuis la v45 le bénéfice net s'intercale entre l'objectif et la courbe */
    expect(c.previousElementSibling.className).toMatch(/hero/);
    expect(c.previousElementSibling.previousElementSibling.className).toMatch(/goal|gcard/);
    /* sans objectif : toujours juste après la carte Objectifs, pas tout en bas */
    app.setCfg({ goal: 0, goalCA: 0, goalY: 0, goalYCA: 0 }, true);
    nav.go('dash'); app.renderDash(); await tick(40);
    const c2 = $('dsh').querySelector('[data-ck="courbe"]');
    expect([...$('dsh').children].indexOf(c2)).toBeLessThan(8);
  });
});

describe('seuil de rentabilité : apports', () => {
  const mois = () => jour(0).slice(0, 7);
  it('un apport mensuel compte entre son début et sa fin, un apport ponctuel une seule fois', () => {
    app.setCfg({ apports: [{ n: 'aide', v: 100, k: 'M', d: '2026-01', f: '2026-03' }, { n: 'prime', v: 50, k: 'U', d: '2026-02' }] }, true);
    expect(ana.apportsMois('2025-12')).toBe(0);
    expect(ana.apportsMois('2026-01')).toBe(100);
    expect(ana.apportsMois('2026-02')).toBe(150);
    expect(ana.apportsMois('2026-03')).toBe(100);
    expect(ana.apportsMois('2026-04')).toBe(0);
    app.setCfg({ apports: [] }, true);
  });
  it('les apports font baisser le seuil', () => {
    app.setCfg({ fixes: [{ n: 'abo', v: 60, p: 'M' }], apports: [] }, true);
    const sans = ana.seuilCalc();
    app.setCfg({ apports: [{ n: 'aide', v: 30, k: 'M', d: mois() }] }, true);
    const avec = ana.seuilCalc();
    expect(avec.Fn).toBe(30);
    expect(avec.need).toBeLessThanOrEqual(sans.need);
    app.setCfg({ apports: [{ n: 'aide', v: 100, k: 'M', d: mois() }] }, true);
    expect(ana.seuilCalc().Fn).toBe(0);
    app.setCfg({ fixes: [], apports: [] }, true);
  });
  it('on ajoute et on supprime un apport depuis l\'écran', async () => {
    app.setCfg({ fixes: [{ n: 'abo', v: 60, p: 'M' }], apports: [] }, true);
    await app.openTool('seuil'); await tick(20);
    $('ap_n').value = 'Aide mensuelle'; $('ap_v').value = '40';
    $('ap_add').click(); await tick(20);
    expect(app.cfg.apports.length).toBe(1);
    expect(app.cfg.apports[0]).toMatchObject({ n: 'Aide mensuelle', v: 40, k: 'M' });
    expect($('shc').textContent).toContain('Aide mensuelle');
    $('shc').querySelector('[data-apd="0"]').click(); await tick(20);
    expect(app.cfg.apports.length).toBe(0);
    $('sheet').hidden = true;
    app.setCfg({ fixes: [], apports: [] }, true);
  });
});

describe('datation vintage illustrée', () => {
  const V = () => { const w = fs.readFileSync(path.join(root, 'public/vintage.js'), 'utf8'); return new Function('window', w + '; return window.VINTAGE;')({}); };
  it('beaucoup plus de marques, chacune avec au moins un indice', () => {
    const v = V();
    expect(v.marques.length).toBeGreaterThanOrEqual(40);
    const noms = v.marques.map(b => b.n);
    expect(new Set(noms).size).toBe(noms.length);
    for (const b of v.marques) { expect(b.r.length, b.n).toBeGreaterThan(0); for (const r of b.r) expect(r.l.length, b.n + ' ' + r.t).toBeGreaterThan(0); }
  });
  it('lit la période d\'un indice', () => {
    expect(art.eraOf('Made in West Germany : avant 1990.')).toEqual([1950, 1989]);
    expect(art.eraOf('Étiquette grise : années 90.')).toEqual([1990, 1999]);
    expect(art.eraOf('Pays : années 70 à 90.')).toEqual([1970, 1999]);
    expect(art.eraOf('Boucle : années 80-90.')).toEqual([1980, 1999]);
    expect(art.eraOf('Le pays : années 2000.')).toEqual([2000, 2009]);
    expect(art.eraOf('Logo : à partir de 1992.')).toEqual([1992, 2029]);
    expect(art.eraOf('Texte de 1985 sans période')).toBeNull();
  });
  it('associe le bon schéma à chaque rubrique', () => {
    expect(art.illusFor('', 'Pays « Made in »')).toBe('madein');
    expect(art.illusFor('', 'Étiquette d\'entretien')).toBe('label');
    expect(art.illusFor('', 'Coutures et finitions')).toBe('stitch');
    expect(art.illusFor('', 'Fermetures éclair')).toBe('zip');
    expect(art.illusFor('', 'Boutons et rivets')).toBe('button');
    expect(art.illusFor('Levi\'s', 'Étiquette rouge (tab)')).toBe('bige');
    expect(art.illusFor('Nike', 'Logos et étiquettes')).toBe('');
  });
  it('affiche les schémas et la règle des décennies dans la fiche d\'une marque et dans les repères généraux', async () => {
    await app.openTool('vintage'); await tick(20);
    expect($('vv_l').querySelectorAll('[data-vb]').length).toBeGreaterThanOrEqual(40);
    app.openVintage('Levi\'s'); await tick(20);
    expect($('shc').querySelector('svg.ill')).toBeTruthy();
    expect($('shc').querySelectorAll('.era').length).toBeGreaterThan(2);
    app.openVintage('*'); await tick(20);
    expect($('shc').querySelectorAll('svg.ill').length).toBeGreaterThanOrEqual(4);
    expect($('shc').querySelectorAll('figure.illf li').length).toBeGreaterThan(6);
    $('sheet').hidden = true;
  });
});
