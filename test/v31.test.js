import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';
import { today } from '../src/modules/core.js';

const $ = id => document.getElementById(id);
const tick = ms => new Promise(r => setTimeout(r, ms));
let nav, tools, gam, rap, fin;
beforeAll(async () => {
  await demarrer(150);
  app.setCfg({ fiscQ: { statut: 'micro', activite: 'march', creation: '2020-01-01', vl: 'bareme', tva: 'franchise', periode: 'M' } }, true);
  nav = await import('../src/modules/nav.js');
  tools = await import('../src/modules/tools-index.js');
  gam = await import('../src/modules/gamification.js');
  rap = await import('../src/modules/rapports.js');
  fin = await import('../src/modules/finalisation.js');
});
afterEach(() => { $('sheet').hidden = true; });

describe('Stock : fenêtre de filtres', () => {
  it('filtre par catégorie, affiche le filtre actif et s\'efface', async () => {
    nav.go('list'); app.filt = 'Tous'; app.renderList(); await tick(20);
    const tout = $('lst').querySelectorAll('.tl, .li, .qrow').length;
    $('flt').querySelector('[data-fadv]').click(); await tick(10);
    expect($('sheet').hidden).toBe(false);
    const cat = $('shc').querySelector('[data-fg="cat"]');
    expect(cat).toBeTruthy();
    cat.click(); await tick(20);
    expect($('lst').querySelector('.fact [data-fclr="cat"]')).toBeTruthy();
    const filtre = $('lst').querySelectorAll('.tl, .li, .qrow').length;
    expect(filtre).toBeGreaterThan(0);
    expect(filtre).toBeLessThanOrEqual(tout);
    expect(app.P.filter(p => p.statut !== 'Vendu' && app.matchFilt(p)).every(p => p.cat === cat.dataset.fv)).toBe(true);
    $('shc').querySelector('#fl_rs').click(); await tick(20);
    expect($('lst').querySelector('.fact')).toBeNull();
  });

  it('le statut du stock se choisit aussi dans la fenêtre', async () => {
    nav.go('list'); app.filt = 'Tous'; app.renderList();
    $('flt').querySelector('[data-fadv]').click(); await tick(10);
    $('shc').querySelector('[data-fg="st"][data-fv="Apub"]').click(); await tick(20);
    expect(app.filt).toBe('Apub');
    $('shc').querySelector('#fl_rs').click(); await tick(20);
    expect(app.filt).toBe('Tous');
  });
});

describe('Vente : fenêtre de filtres et indicateurs', () => {
  it('filtre par plateforme et période', async () => {
    nav.go('sales'); app.salesFilter('all'); await tick(30);
    expect($('ssum').querySelector('.sgt')).toBeTruthy();
    const tout = $('slst').querySelectorAll('.li').length;
    $('sflt').querySelector('[data-sfadv]').click(); await tick(10);
    const pf = [...$('shc').querySelectorAll('[data-fg="pf"]')];
    expect(pf.length).toBeGreaterThan(1);
    pf[0].click(); await tick(20);
    const n = $('slst').querySelectorAll('.li').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(tout);
    expect($('slst').querySelector('.fact [data-fclr="pf"]')).toBeTruthy();
    $('shc').querySelector('#fl_rs').click(); await tick(20);
    expect($('slst').querySelectorAll('.li').length).toBe(tout);
  });
});

describe('Bilan : toutes les cartes se replient', () => {
  it('Qualité des achats et Dernier live ont une flèche et se replient', async () => {
    app.setCfg({ dash: null });
    nav.go('dash'); app.renderDash(); await tick(20);
    for (const k of ['cohorte', 'live']) {
      const card = document.querySelector(`#dsh [data-ck="${k}"]`);
      const h = card.querySelector('h3[data-sec]');
      expect(h, k).toBeTruthy();
      const chip = document.querySelector(`#dsh [data-bp][data-bk="${k}"]`);
      expect(chip, k).toBeTruthy();
      chip.click();
      expect(card.classList.contains('bsel'), k).toBe(true);
    }
  });
});

describe('Réglages : cartes repliées, objectifs et export fusionnés', () => {
  it('tout est replié sauf le compte, et un titre déplie la carte', async () => {
    localStorage.removeItem('setOpen');
    nav.go('set'); app.renderSet(); await tick(30);
    for (const id of ['lgc', 'thc', 'cfgc', 'cptc', 'bkc', 'xic', 'abo']) expect($(id).classList.contains('shut'), id).toBe(true);
    expect($('acc').classList.contains('shut')).toBe(false);
    expect($('sy').classList.contains('shut')).toBe(false);
    $('cfgc').querySelector('h3').click();
    expect($('cfgc').classList.contains('shut')).toBe(false);
    $('cfgc').querySelector('h3').click();
    expect($('cfgc').classList.contains('shut')).toBe(true);
  });

  it('la carte Exemples a disparu et Exporter / Importer sont dans une seule carte', () => {
    expect($('exc')).toBeNull();
    for (const id of ['xx', 'xj', 'imp', 'impt', 'impb', 'impm', 'impo']) expect($('xic').contains($(id)), id).toBe(true);
    expect($('xic').querySelectorAll('h3').length).toBe(1);
  });

  it('Objectifs et coûts : quatre blocs, mêmes champs, frais d\'exemple', () => {
    app.setCfg({ emb: 0.5, port: 0, comV: 10, pf1: '', pf2: '' });
    nav.go('set'); app.renderSet();
    expect($('cfgc').querySelectorAll('.cg').length).toBe(4);
    for (const id of ['c_goal', 'c_goalY', 'c_emb', 'c_port', 'c_pf1', 'c_pf2', 'c_comV', 'c_comT', 'c_roi', 'c_minM']) expect($(id), id).toBeTruthy();
    expect($('cfgc').querySelector('.cprev').textContent).toMatch(/20/);
  });
});

describe('Scanner QR et étiquettes : un seul outil', () => {
  it('une seule entrée dans la liste, deux onglets, et la recherche par code', async () => {
    const k = tools.TOOLS.map(x => x.k);
    expect(k).toContain('qr');
    expect(k).not.toContain('scan');
    await app.openTool('qr'); await tick(20);
    expect($('qr_tabs').querySelectorAll('[data-qt]').length).toBe(2);
    $('qr_tabs').querySelector('[data-qt="scan"]').click();
    const p = app.P[0];
    $('qr_code').value = p.id;
    $('qr_find').click(); await tick(20);
    expect($('qr_code')).toBeNull();
    expect($('sheet').hidden).toBe(false);
    await app.openTool('qr');
    $('qr_tabs').querySelector('[data-qt="labels"]').click();
    expect($('qr_list')).toBeTruthy();
    expect($('qr_print')).toBeTruthy();
  });
});

describe('Série de publication : un jour de repos par semaine', () => {
  const avec = (jours, fn) => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T12:00:00'));
    const old = app.P; app.P = jours.map((d, i) => ({ id: 's' + i, pub: d, statut: 'Disponible' }));
    try { return fn(gam.streakInfo()); } finally { app.P = old; vi.useRealTimers(); }
  };
  it('un seul jour sans publier dans la semaine ne casse pas la série', () => {
    avec(['2026-11-04', '2026-11-02', '2026-11-01', '2026-10-30'], s => { expect(s.n).toBe(4); expect(s.best).toBe(4); });
  });
  it('un deuxième jour de repos dans la même semaine la casse', () => {
    avec(['2026-11-04', '2026-11-02', '2026-11-01', '2026-10-30', '2026-10-28'], s => expect(s.n).toBe(3));
  });
  it('deux jours de suite sans publier la cassent', () => {
    avec(['2026-11-04', '2026-11-01'], s => expect(s.n).toBe(1));
  });
  it('ne pas avoir encore publié aujourd\'hui ne casse rien', () => {
    avec(['2026-11-03', '2026-11-02'], s => { expect(s.n).toBe(2); expect(s.today).toBe(false); });
  });
  it('hier était le jour de repos : la série tient si on publie aujourd\'hui', () => {
    avec(['2026-11-02', '2026-11-01'], s => { expect(s.n).toBe(2); expect(s.pending).toBe(true); });
  });
});

describe('Rapports PDF : ventes du mois et rapport fiscal', () => {
  it('l\'outil est dans la liste, avec deux onglets', async () => {
    expect(tools.TOOLS.map(x => x.k)).toContain('rapport');
    await app.openTool('rapport'); await tick(20);
    expect($('shc').querySelector('[data-rt="ventes"]')).toBeTruthy();
    expect($('shc').querySelector('[data-rt="fisc"]')).toBeTruthy();
    expect($('rp_pdf')).toBeTruthy();
    $('shc').querySelector('[data-rt="fisc"]').click();
    expect($('rp_pdf_f')).toBeTruthy();
    expect($('shc').textContent).toContain(t('Rapport fiscal'));
  });

  it('le rapport fiscal compte les ventes finalisées de la période et sépare les comptes exclus', () => {
    const base = app.P.find(p => p.statut === 'Disponible');
    app.P.push(Object.assign({}, base, { id: 'v31-a', statut: 'Vendu', pv: 41, dv: '2026-09-15', canal: 'Vinted', frais: 1, vt: 1 }),
      Object.assign({}, base, { id: 'v31-b', statut: 'Vendu', pv: 59, dv: '2026-09-20', canal: 'Vinted', frais: 1, vt: 1 }));
    const r = rap.fiscSales('2026-09-01', '2026-09-30');
    const ids = r.inc.map(p => p.id);
    expect(ids).toContain('v31-a');
    expect(ids).toContain('v31-b');
    const html = rap.fiscalReportHTML({ key: '2026-09', label: 'septembre 2026', start: '2026-09-01', end: '2026-09-30', due: '2026-10-31' });
    expect(html).toContain('septembre 2026');
    const attendu = r.inc.reduce((a, p) => a + (p.pv || 0), 0);
    /* le séparateur décimal dépend de la langue : on compare les chiffres seuls, en centimes */
    expect(html.replace(/<[^>]+>/g, '').replace(/\D/g, '')).toContain(String(Math.round(attendu * 100)));
    expect(fin.finDate(app.P.find(p => p.id === 'v31-a'))).toBe('2026-09-15');
    app.P = app.P.filter(p => !p.id.startsWith('v31-'));
  });

  it('Ligne fiscale propose le rapport en PDF', async () => {
    await app.openTool('fisc'); await tick(20);
    expect($('fs_pdf')).toBeTruthy();
    $('fs_pdf').click(); await tick(20);
    expect($('rp_pdf_f')).toBeTruthy();
  });
});

describe('Commande vocale : tout faire à la voix', () => {
  const dire = async txt => { $('vc_t').value = txt; $('vc_go').click(); await tick(20); return ($('vc_out') || {}).textContent || ''; };
  const piece = (o = {}) => { const p = Object.assign({ id: 'v31-p' + Math.random().toString(36).slice(2, 6), cat: 'Tshirt', marque: 'Zzbrand', taille: 'M', coul: ['Bleu'], statut: 'Disponible', entree: '2026-10-01', achat: 3 }, o); app.P.push(p); return p; };
  const nettoyer = () => { app.P = app.P.filter(p => !p.id.startsWith('v31-')); };
  beforeAll(async () => { $('mic').click(); await tick(300); });
  afterEach(() => { nettoyer(); });

  it('va dans un écran', async () => {
    $('mic').click(); await tick(20);
    await dire('va au bilan');
    expect(app.view).toBe('dash');
    $('mic').click(); await tick(20);
    await dire('ouvre les ventes');
    expect(app.view).toBe('sales');
  });

  it('répond à une question chiffrée', async () => {
    $('mic').click(); await tick(20);
    const r = await dire('combien j\'ai gagné ce mois-ci');
    expect(r).toMatch(/Bénéfice/);
    const s = await dire('combien de pièces en stock');
    expect(s).toMatch(/en stock/);
  });

  it('note une dépense et l\'annule', async () => {
    $('mic').click(); await tick(20);
    const avant = app.DEP.length;
    const r = await dire('ajoute une dépense de 25 euros carburant');
    expect(r).toMatch(/25/);
    expect(app.DEP.length).toBe(avant + 1);
    expect(app.DEP[0]).toMatchObject({ montant: 25, cat: 'Carburant' });
    await dire('annule'); await tick(20);
    expect(app.DEP.length).toBe(avant);
  });

  it('publie, change le prix, range dans un bac, met indisponible', async () => {
    const p = piece();
    $('mic').click(); await tick(20);
    await dire('j\'ai publié le zzbrand bleu M');
    expect(app.P.find(x => x.id === p.id).pub).toBe(today());
    await dire('baisse le prix du zzbrand bleu M à 12 euros');
    expect(app.P.find(x => x.id === p.id).pvise).toBe(12);
    await dire('range le zzbrand bleu M dans le bac Z9');
    expect(app.P.find(x => x.id === p.id).bac).toBe('Z9');
    await dire('mets le zzbrand bleu M indisponible');
    expect(app.P.find(x => x.id === p.id).statut).toBe('Pas Disponible');
    await dire('remets le zzbrand bleu M en stock');
    expect(app.P.find(x => x.id === p.id).statut).toBe('Disponible');
  });

  it('préremplit le formulaire Ajouter', async () => {
    piece();
    $('mic').click(); await tick(20);
    await dire('ajoute un zzbrand bleu L à 4 euros');
    expect(app.view).toBe('add');
    expect(app.addForm.state).toMatchObject({ marque: 'Zzbrand', taille: 'L', achat: 4 });
  });

  it('ouvre un outil et le rapport fiscal', async () => {
    $('mic').click(); await tick(20);
    await dire('ouvre la ligne fiscale'); await tick(20);
    expect($('fs_p')).toBeTruthy();
    $('mic').click(); await tick(20);
    await dire('rapport fiscal'); await tick(20);
    expect($('rp_pdf_f')).toBeTruthy();
  });

  it('la vente à la voix marche toujours', async () => {
    const p = piece({ marque: 'Yyvente' });
    $('mic').click(); await tick(20);
    await dire('vendu yyvente bleu M 18 euros vinted');
    const v = app.P.find(x => x.id === p.id);
    expect(v.statut).toBe('Vendu');
    expect(v.pv).toBe(18);
  });
});
