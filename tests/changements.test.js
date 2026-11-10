import { describe, it, expect, beforeAll } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
let nav, tools;
beforeAll(async () => {
  await demarrer(150);
  nav = await import('../src/modules/nav.js');
  tools = await import('../src/modules/tools-index.js');
});

describe('onglet Vente', () => {
  it('la barre du bas a Vente à la place de Live', () => {
    const v = [...document.querySelectorAll('#nav button')].map(b => b.dataset.v);
    expect(v).toContain('sales');
    expect(v).not.toContain('quick');
    expect(document.querySelector('#nav [data-v="sales"] .nl').textContent).toBe(t('Vente'));
  });

  it('liste toutes les ventes, les plus récentes d\'abord', () => {
    nav.go('sales');
    expect($('ttl').textContent).toBe(t('Vente'));
    const sold = app.P.filter(p => p.statut === 'Vendu');
    const rows = [...document.querySelectorAll('#slst .li')];
    expect(rows.length).toBe(Math.min(60, sold.length));
    expect(rows.every(r => app.P.find(p => p.id === r.dataset.id).statut === 'Vendu')).toBe(true);
    const dates = rows.map(r => app.P.find(p => p.id === r.dataset.id).dv);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect($('sflt').textContent).toContain(t('Toutes') + ' · ' + sold.length);
  });

  it('cherche par @pseudo, sans indicateur colis dans Vente', () => {
    nav.go('sales');
    $('sq').value = 'lea_m'; $('sq').dispatchEvent(new Event('input'));
    const rows = [...document.querySelectorAll('#slst .li')];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => app.P.find(p => p.id === r.dataset.id).acheteur === 'lea_m')).toBe(true);
    $('sq').value = ''; $('sq').dispatchEvent(new Event('input'));
    document.querySelector('[data-sfadv]').click();
    expect(document.querySelector('[data-fg="st"][data-fv="prep"]')).toBeNull();
    expect(document.querySelector('[data-sprep]')).toBeNull();
    document.getElementById('fl_ok').click();
    document.querySelector('[data-sf="all"]').click();
  });

  it('un clic sur une vente ouvre sa fiche', () => {
    nav.go('sales');
    document.querySelector('#slst .li').click();
    expect($('sheet').hidden).toBe(false);
    $('sheet').hidden = true;
  });
});

describe('onglet Stock', () => {
  it('ne montre que le stock : plus de filtre Vendu, aucune pièce vendue', () => {
    app.filt = 'Vendu';
    nav.go('list');
    expect(document.querySelector('#flt [data-flt="Vendu"]')).toBeNull();
    expect(app.filt).toBe('Tous');
    const ids = [...document.querySelectorAll('#lst [data-id]')].map(e => e.dataset.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(id => app.P.find(p => p.id === id).statut !== 'Vendu')).toBe(true);
    const tous = document.querySelector('#flt [data-flt="Tous"]').textContent;
    expect(tous).toContain('· ' + app.P.filter(p => p.statut !== 'Vendu').length);
  });
});

describe('Live dans les outils', () => {
  it('l\'outil Live ouvre l\'ancien écran, avec un retour vers Vente', async () => {
    expect(tools.TOOLS.map(x => x.k)).toContain('live');
    await app.openTool('live');
    expect(app.view).toBe('quick');
    expect($('v-quick').classList.contains('on')).toBe(true);
    $('lv_back').click();
    expect(app.view).toBe('sales');
  });
});

describe('outils retirés', () => {
  it('ballot, négociation, photos, trésorerie et visuels ne sont plus dans la liste (les rapports PDF sont revenus)', () => {
    const k = tools.TOOLS.map(x => x.k);
    for (const x of ['ballot', 'nego', 'photos', 'treso', 'visuels', 'scan']) expect(k).not.toContain(x);
    expect(k).toContain('rapport');
  });
});

describe('Bilan : calendrier, trésorerie et bilan mensuel', () => {
  it('le calendrier replié garde son titre visible pour pouvoir se redéplier', () => {
    nav.go('dash'); app.renderDash();
    const h = [...document.querySelectorAll('#dsh h3[data-sec]')].find(x => x.dataset.sec === 'Ventes');
    expect(h).toBeTruthy();
    const card = h.closest('.card');
    const holder = [...card.children].find(el => el.contains(h));
    expect(holder.classList.contains('hd')).toBe(true);
    /* v48 : un seul graphique par onglet, choisi avec les pastilles */
    expect(card.classList.contains('bsel0')).toBe(true);
    const chip = document.querySelector('#dsh [data-bp="a"][data-bk="Ventes"]');
    expect(chip).toBeTruthy();
    chip.click();
    expect(card.classList.contains('bsel')).toBe(true);
    expect(card.classList.contains('bnot')).toBe(false);
  });

  it('la trésorerie se calcule toute seule, sans solde de départ', async () => {
    const { tresoData } = await import('../src/modules/treasury.js');
    app.cfg = Object.assign({}, app.cfg, { cash: null, cashDate: '' });
    const c = tresoData();
    expect(c).not.toBeNull();
    expect(c.auto).toBe(true);
    expect(Number.isFinite(c.now)).toBe(true);
    app.renderDash();
    const tuile = document.querySelector('#dsh .btiles.bt-m [data-tool="treso"]');
    expect(tuile).toBeTruthy();
    expect(tuile.textContent).toContain(t('trésorerie'));
  });

  it('avec un solde indiqué, le calcul repart de ce solde', async () => {
    const { tresoData } = await import('../src/modules/treasury.js');
    const auto = tresoData().now;
    app.cfg = Object.assign({}, app.cfg, { cash: 1000, cashDate: new Date().toISOString().slice(0, 10) });
    const c = tresoData();
    expect(c.auto).toBe(false);
    expect(c.cash).toBe(1000);
    expect(c.now).not.toBe(auto);
    app.cfg = Object.assign({}, app.cfg, { cash: null, cashDate: '' });
  });

  it('le rapport PDF est un bouton en haut du Bilan, à côté des Réglages', async () => {
    nav.go('dash'); app.renderDash();
    expect(document.querySelector('#dsh [data-tool="rapport"]')).toBeNull();
    expect(document.getElementById('rptb').hidden).toBe(false);
    expect(document.getElementById('rptb').nextElementSibling.id).toBe('tl');
    await app.openTool('rapport');
    expect($('shc').textContent).toContain(t('Bilan mensuel'));
    $('sheet').hidden = true;
  });
});

describe('Ajouter : annuler la saisie', () => {
  it('le bouton est inactif sur un formulaire vide, actif dès qu\'on saisit, et annulable', () => {
    nav.go('add');
    app.addForm.reset({ entree: new Date().toISOString().slice(0, 10) });
    expect($('fclear').disabled).toBe(true);
    app.addForm.reset({ entree: '2026-10-30', marque: 'Nike', cat: 'Haut' });
    expect($('fclear').disabled).toBe(false);
    $('fclear').click();
    expect(app.addForm.state.marque).toBeUndefined();
    expect($('fclear').disabled).toBe(true);
    expect($('toast').textContent).toContain('Saisie effacée');
    $('tu').click();
    expect(app.addForm.state.marque).toBe('Nike');
  });
});

describe('photos allégées automatiquement', () => {
  it('repère les photos lourdes, ignore les vidéos, et ne retente pas une photo déjà essayée', async () => {
    const { tx } = await import('../src/modules/storage.js');
    const { heavyPhotoIds, autoCompress } = await import('../src/modules/performance.js');
    await tx('photos', 'readwrite', s => {
      s.put({ id: 'ph-lourde', blob: { size: 400000, type: 'image/jpeg' } });
      s.put({ id: 'ph-legere', blob: { size: 50000, type: 'image/jpeg' } });
      s.put({ id: 'ph-video', blob: { size: 9000000, type: 'video/mp4' } });
    });
    expect(await heavyPhotoIds()).toEqual(['ph-lourde']);
    const r = await autoCompress(5);
    expect(r.changed).toBe(0);
    expect(await heavyPhotoIds()).toEqual([]);
  });
});
