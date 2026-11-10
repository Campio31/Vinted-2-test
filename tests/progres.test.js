import { describe, it, expect, beforeAll } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
let tools, P;
beforeAll(async () => {
  await demarrer(150);
  tools = await import('../src/modules/tools-index.js');
  P = await import('../src/modules/progress.js');
});

describe('Coach du lundi retiré', () => {
  it('n\'est plus dans la liste des outils', () => {
    expect(tools.TOOLS.some(x => x.k === 'coach')).toBe(false);
    expect(tools.TOOLS.some(x => x.k === 'trash')).toBe(false);
  });
});

describe('niveaux', () => {
  it('passent d\'un palier à l\'autre', () => {
    expect(P.levelOf(0).cur.n).toBe('Débutant');
    expect(P.levelOf(49).cur.n).toBe('Débutant');
    expect(P.levelOf(50).cur.n).toBe('Chineur');
    expect(P.levelOf(149).cur.n).toBe('Chineur');
    expect(P.levelOf(150).cur.n).toBe('Confirmé');
    const top = P.levelOf(5000);
    expect(top.cur.n).toBe('Légende');
    expect(top.next).toBeNull();
    expect(top.pct).toBe(1);
    expect(P.levelOf(100).left).toBe(50);
  });

  it('les points suivent la règle : publier 1, vendre 3, colis 1, défi 5, exemples exclus', () => {
    const R = app.P.filter(p => !p.ex);
    const x = P.xpData();
    expect(x.xp).toBe(R.filter(p => p.pub).length + 3 * R.filter(p => p.statut === 'Vendu').length + R.filter(p => p.statut === 'Vendu' && p.exp).length + 5 * x.med);
    const avant = P.xpData().xp;
    const p = app.P.find(q => q.statut === 'Vendu');
    p.ex = true;
    expect(P.xpData().xp).toBe(avant - 3 - (p.pub ? 1 : 0) - (p.exp ? 1 : 0));
    delete p.ex;
  });

  it('un message félicite quand le niveau monte, pas au premier calcul', async () => {
    localStorage.removeItem('lvlSeen');
    P.checkLevel();
    expect(localStorage.getItem('lvlSeen')).not.toBeNull();
    localStorage.setItem('lvlSeen', '-1');
    $('toast').hidden = true;
    P.checkLevel();
    expect($('toast').hidden).toBe(false);
    expect($('toast').textContent).toMatch(/Niveau|Level/);
  });
});

describe('Défis, cartes, trophées et classement : un seul écran', () => {
  it('l\'outil est unique et les anciens points d\'entrée mènent au même écran', async () => {
    const k = tools.TOOLS.map(x => x.k);
    expect(k).toContain('trophees');
    expect(k).not.toContain('defis');
    for (const key of ['trophees', 'defis']) {
      await app.openTool(key);
      expect($('shc').querySelectorAll('[data-ptab]').length).toBeGreaterThanOrEqual(4);
    }
  });

  it('quatre onglets : Défis, Cartes, Trophées, Classement', async () => {
    await app.openTool('defis');
    expect([...$('shc').querySelectorAll('.ptabs [data-ptab]')].map(b => b.dataset.ptab)).toEqual(['now', 'cartes', 'trophees', 'classement']);
    expect($('shc').textContent).toMatch(/points/);
    expect($('shc').querySelector('.med')).toBeNull();
    $('shc').querySelector('[data-ptab="cartes"]').click();
    expect($('shc').querySelectorAll('.cdk').length).toBe(43);
    $('shc').querySelector('[data-ptab="trophees"]').click();
    expect($('shc').querySelectorAll('.tro').length).toBe(10);
    $('shc').querySelector('[data-ptab="classement"]').click();
    expect($('shc').textContent).toMatch(/classement|ranking/i);
    $('shc').querySelector('[data-ptab="now"]').click();
  });

  it('les défis se créent tout seuls : 3+3 au mois, 1+2 à la semaine, sans défi saisi à la main', async () => {
    app.setCfg({ defis: [] });
    const D = await import('../src/modules/challenges.js');
    D.ensureDefis();
    const M = D.defisOf('month'), W = D.defisOf('week');
    expect(M.filter(d => d.src === 'common')).toHaveLength(3);
    expect(M.filter(d => d.src === 'perso')).toHaveLength(3);
    expect(W.filter(d => d.src === 'common')).toHaveLength(1);
    expect(W.filter(d => d.src === 'perso')).toHaveLength(2);
    expect(new Set(M.filter(d => d.src === 'perso').map(d => d.type)).size).toBe(3);
    D.ensureDefis();
    expect(app.cfg.defis).toHaveLength(9);
    P.openProgress('now');
    expect($('shc').querySelectorAll('.dfi')).toHaveLength(9);
    expect($('shc').querySelector('[data-dacc],[data-ddel],#df_ok')).toBeNull();
  });

  it('les défis communs sont les mêmes pour tout le monde, les personnels dépendent de tes ventes', async () => {
    const D = await import('../src/modules/challenges.js');
    const a = D.generate('month', '2026-11-10').filter(d => d.src === 'common').map(d => d.type + d.target);
    const b = D.generate('month', '2026-11-25').filter(d => d.src === 'common').map(d => d.type + d.target);
    expect(a).toEqual(b);
    const faible = D.personal('week', { pub: 0, add: 0, sold: 0, ca: 0, colis: 0 }, 2);
    const fort = D.personal('week', { pub: 60, add: 20, sold: 20, ca: 900, colis: 15 }, 2);
    expect(fort[0].target).toBeGreaterThan(faible[0].target);
  });

  it('un défi réussi offre un pack, une seule fois, et le pack Givre s\'ouvre en 4 cartes', async () => {
    const D = await import('../src/modules/challenges.js'), K = await import('../src/modules/cartes.js');
    const m = new Date().toISOString().slice(0, 7);
    app.P.push({ id: 'prg-add', cat: 'Tshirt', marque: 'Test', statut: 'Disponible', entree: new Date().toISOString().slice(0, 10) });
    const d = { id: 'test:add', scope: 'week', src: 'common', type: 'add', target: 1, m, from: '2000-01-01', to: '2999-12-31' };
    app.setCfg({ defis: [d], cartes: null });
    D.ensureDefis();
    expect(K.state().s).toBe(1);
    D.ensureDefis();
    expect(K.state().s).toBe(1);
    const x = P.xpData().xp;
    expect(app.cfg.defis.find(q => q.id === 'test:add').done).toBeTruthy();
    expect(x).toBeGreaterThanOrEqual(5);
    const r = K.openPack('s');
    expect(r.res).toHaveLength(4);
    expect(K.state().s).toBe(0);
    expect(K.owned()).toBeGreaterThan(0);
    expect(K.openPack('s')).toBeNull();
    app.P = app.P.filter(p => p.id !== 'prg-add');
  });

  it('Givre donne 4 cartes, Glacier 5 dont une Rare ou mieux, Aurore 5 dont une Épique ou mieux, et les Uniques ne sortent jamais d\'un pack', async () => {
    const K = await import('../src/modules/cartes.js');
    app.setCfg({ cartes: { own: {}, s: 0, p: 40, a: 40, paid: [], pity: 0, sets: [] } });
    for (let i = 0; i < 40; i++) {
      const g = K.openPack('p'); expect(g.res).toHaveLength(5); expect(g.res.some(x => x.c.r >= 2)).toBe(true);
      const a = K.openPack('a'); expect(a.res).toHaveLength(5); expect(a.res.filter(x => x.c.r >= 3).length).toBeGreaterThanOrEqual(1);
      expect([...g.res, ...a.res].every(x => x.c.r < 6)).toBe(true);
    }
    app.setCfg({ cartes: null });
  });

  it('la Collection Hiver : 43 cartes, 7 raretés avec la bonne répartition, Uniques toujours Neuves', async () => {
    const K = await import('../src/modules/cartes.js');
    expect(K.CARDS).toHaveLength(43);
    expect(K.RARETES).toHaveLength(7);
    expect([0, 1, 2, 3, 4, 5, 6].map(r => K.CARDS.filter(c => c.r === r).length)).toEqual([10, 10, 5, 5, 5, 5, 3]);
    expect(new Set(K.CARDS.map(c => c.id)).size).toBe(43);
    expect(K.CARDS.filter(c => c.r === 6).every(c => c.e === 5 && c.unique)).toBe(true);
    expect(K.CARDS.every(c => c.hist && c.epoque && c.taille && c.coul && c.sil)).toBe(true);
    expect(K.TIRAGE).toEqual([0, 50000, 10000, 2500, 500, 100, 3]);
    expect(K.TIRAGE_SUPER).toEqual([0, 0, 1000, 250, 50, 10, 0]);
  });

  it('une carte se dessine en entier : en-tête, illustration, fiche, histoire, pied, état et version Super', async () => {
    const K = await import('../src/modules/cartes.js');
    const c = K.CARDS[0], h = document.createElement('div');
    h.innerHTML = K.cardFront(c, 2, false) + K.cardFront(K.CARDS.find(x => x.r === 3), 5, true);
    const front = h.querySelector('.cdn');
    for (const s of ['.cdh', '.cdd svg.cga', '.cdf', '.cdi', '.cdb']) expect(front.querySelector(s), s).toBeTruthy();
    expect(front.textContent).toContain('01 / 43');
    expect(front.querySelectorAll('.pt.on')).toHaveLength(2);
    expect(h.querySelector('.cdn.sup .cdsup')).toBeTruthy();
    expect(front.textContent).not.toMatch(/€/);
  });

  it('le logo, les huit dos et les trois packs fournis sont utilisés, avec des identifiants propres à chaque affichage', async () => {
    const A = await import('../src/modules/cartes-art.js');
    expect(A.SHEEP).toContain('class="cgl"');
    expect(A.SHEEP).toContain('Logo Max');
    for (let r = 0; r <= 6; r++) { const b = A.backSVG(r, 'x' + r); expect(b, 'dos ' + r).toContain('class="cgbk"'); expect(b).toContain('viewBox="0 0 352 496"'); }
    expect(A.backSVG(3, 'a', true)).not.toBe(A.backSVG(3, 'a', false));
    for (const k of ['s', 'p', 'a']) { const s = A.packSVG(k, 'p1'), s2 = A.packSVG(k, 'p2'); expect(s).toContain('class="pks"'); expect(s).toContain('viewBox="0 0 300 500"'); expect(s).not.toBe(s2); const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]); ids.forEach(i => { expect(i.endsWith('-p1')).toBe(true); expect(s).not.toContain('url(#' + i.replace(/-p1$/, '') + ')'); }); }
  });
  it('chaque carte a son illustration dessinée (43 fichiers), sans fond qui cacherait le disque, avec marques d\'usure selon l\'état', async () => {
    const K = await import('../src/modules/cartes.js'), A = await import('../src/modules/cartes-art.js');
    for (const c of K.CARDS) {
      const svg = A.garmentSVG(c, 1, 5);
      expect(svg, c.name).toContain('class="cga"');
      expect(svg, c.name).toContain('viewBox="0 0 316 194"');
      expect(svg, c.name).not.toContain('<rect width="316" height="194" fill="#f3ead7"/>');
      expect(svg, c.name).not.toContain('translate(58 10)');
    }
    const neuf = A.garmentSVG(K.CARDS[0], 1, 5), use = A.garmentSVG(K.CARDS[0], 1, 1);
    expect(use.length).toBeGreaterThan(neuf.length);
  });
  it('les Uniques se gagnent par un geste : première vente, colis expédié', async () => {
    const K = await import('../src/modules/cartes.js');
    app.setCfg({ cartes: null });
    app.P = app.P.filter(p => !p.ex);
    const v = app.P.find(p => p.statut === 'Vendu');
    const got = K.checkUniques();
    expect(got.map(c => c.unique)).toContain('first');
    expect(K.state().own[got[0].id]).toMatchObject({ n: 1, e: 5 });
    expect(K.checkUniques()).toHaveLength(0);
    void v;
    app.setCfg({ cartes: null });
  });
  it('l\'onglet Cartes ouvre un pack à l\'écran', async () => {
    const K = await import('../src/modules/cartes.js');
    app.setCfg({ cartes: { own: {}, dust: 0, s: 1, p: 0, paid: [], pity: 0, sets: [] } });
    P.openProgress('cartes');
    $('shc').querySelector('[data-popen="s"]').click();
    expect($('shc').querySelectorAll('.popen .cdk.down')).toHaveLength(4);
    const one = $('shc').querySelector('.popen .cdk.down'); one.click();
    await new Promise(r => setTimeout(r, 300));
    expect(one.classList.contains('down')).toBe(false);
    expect(one.classList.contains('tilt')).toBe(true);
    expect($('shc').querySelectorAll('.popen .cdk.down')).toHaveLength(3);
    expect($('shc').querySelector('.popen .cdn .gls')).not.toBeNull();
    expect($('shc').querySelector('.popen .cdn.e1, .popen .cdn.e2, .popen .cdn.e3, .popen .cdn.e4, .popen .cdn.e5')).not.toBeNull();
    $('shc').querySelector('[data-pflip]').click();
    await new Promise(r => setTimeout(r, 900));
    expect($('shc').querySelectorAll('.popen .cdk.down')).toHaveLength(0);
    $('shc').querySelector('[data-pclose]').click();
    expect($('shc').querySelector('.popen')).toBeNull();
    expect(K.owned()).toBeGreaterThan(0);
    app.setCfg({ cartes: null });
  });

  it('les trophées ont cinq paliers et les paliers se calculent d\'après les ventes', async () => {
    const T = await import('../src/modules/trophees.js');
    expect(T.TIERS).toEqual(['Bronze', 'Argent', 'Or', 'Platine', 'Diamant']);
    for (const c of T.CATS) expect(c.th).toHaveLength(5);
    const v = T.trophyData().find(c => c.k === 'ventes');
    expect(v.tier).toBe(v.th.filter(x => v.val >= x).length);
    expect(T.trophyTiers()).toBeGreaterThan(0);
  });

  it('les points du mois du classement suivent la règle', async () => {
    const R = await import('../src/modules/rang.js');
    const m = '2099-01';
    const base = { cat: 'Tshirt', marque: 'Z', statut: 'Disponible' };
    app.P.push(Object.assign({}, base, { id: 'rg1', pub: m + '-02' }), Object.assign({}, base, { id: 'rg2', statut: 'Vendu', pv: 5, dv: m + '-03', exp: m + '-04' }));
    expect(R.ptsMonth(m)).toBe(1 + 3 + 1 - 0);
    app.P = app.P.filter(p => !p.id.startsWith('rg'));
  });

  it('le classement se rejoint avec un pseudo et une région, et se quitte', async () => {
    app.setCfg({ rang: null });
    P.openProgress('classement');
    $('rg_ps').value = 'Camille'; $('rg_rg').value = 'Bretagne';
    $('shc').querySelector('[data-rg="join"]').click(); await new Promise(r => setTimeout(r, 20));
    expect(app.cfg.rang).toMatchObject({ on: true, pseudo: 'Camille', region: 'Bretagne' });
    expect($('shc').textContent).toContain('Camille');
    $('shc').querySelector('[data-rg="leave"]').click(); await new Promise(r => setTimeout(r, 20));
    expect(app.cfg.rang.on).toBe(false);
  });
});
