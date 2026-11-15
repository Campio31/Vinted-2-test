import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

let V, T;
const $ = id => document.getElementById(id);
const clic = sel => { const b = document.querySelector(sel); expect(b, sel).toBeTruthy(); b.click(); };
beforeAll(async () => { await demarrer(60); T = await import('../src/modules/tools-index.js'); V = await import('../src/modules/live-view.js'); });
afterEach(() => { app.setCfg({ liveco: null }, true); $('sheet').hidden = true; });

describe('Live connecté : l\'outil', () => {
  it('l\'outil est dans la liste et s\'ouvre depuis le menu des outils', () => {
    expect(T.TOOLS.some(x => x.k === 'liveco')).toBe(true);
    app.openTool('liveco');
    expect($('sheet').hidden).toBe(false); expect($('shc').textContent).toContain(t('Live connecté'));
    expect([...$('shc').querySelectorAll('[data-lv="tab"]')].map(b => b.dataset.v)).toEqual(['conn', 'lives', 'ballots', 'match']);
  });
  it('les autres outils continuent de s\'ouvrir (le menu n\'est pas cassé)', () => {
    expect(() => app.openTool('tuto')).not.toThrow(); $('sheet').hidden = true;
  });
  it('sans connexion, l\'onglet Lives invite à charger la démonstration, sans toucher aux fiches', () => {
    V.openLiveco('lives'); expect($('shc').textContent).toContain(t('Aucun live pour l\'instant. Charge la démonstration ou connecte une boutique.'));
    expect(app.P.every(p => !('liveco' in p))).toBe(true);
  });
});

describe('Live connecté : démonstration, lives, ballots, à rapprocher', () => {
  it('la démonstration charge deux lives, un ballot, des références inconnues, et laisse le stock réel intact', () => {
    const avant = JSON.stringify(app.P.map(p => [p.id, p.statut, p.pv]));
    V.openLiveco('conn'); clic('[data-lv="demo"]');
    expect($('shc').querySelectorAll('[data-lv="session"]')).toHaveLength(2);
    expect(JSON.stringify(app.P.map(p => [p.id, p.statut, p.pv]))).toBe(avant);
    expect(app.cfg.liveco.accounts[0].provider).toBe('test');
  });
  it('le détail d\'un live montre brut, net, ventes et permet d\'associer un ballot', () => {
    V.openLiveco('conn'); clic('[data-lv="demo"]');
    const live = [...$('shc').querySelectorAll('[data-lv="session"]')].find(b => b.textContent.includes('10 novembre') || b.textContent.includes('10')); live.click();
    const s = $('shc'); expect(s.querySelector('.kpis')).toBeTruthy(); expect(s.querySelectorAll('select#lv_b option').length).toBeGreaterThan(0); expect(s.textContent).toContain(t('Associer un ballot'));
    clic('[data-lv="assoc"]'); expect(app.cfg.liveco.rules.some(r => r.isDefault)).toBe(true);
  });
  it('l\'onglet Ballots affiche la progression et permet d\'en créer un', () => {
    V.openLiveco('conn'); clic('[data-lv="demo"]'); clic('[data-lv="tab"][data-v="ballots"]');
    expect($('shc').textContent).toContain('Ballot de démonstration'); expect($('shc').textContent).toContain(t('Ce montant compare les ventes au coût d\'achat : ce n\'est pas ton bénéfice comptable.'));
    $('nb_l').value = 'Mon ballot'; $('nb_c').value = '120,50'; clic('[data-lv="newb"]');
    expect(app.cfg.liveco.ballots.map(b => b.label)).toContain('Mon ballot'); expect(app.cfg.liveco.ballots.find(b => b.label === 'Mon ballot').landedCost).toBe(12050);
  });
  it('« À rapprocher » : lier une référence inconnue débite le stock une seule fois', () => {
    V.openLiveco('conn'); clic('[data-lv="demo"]'); clic('[data-lv="tab"][data-v="match"]');
    const lier = document.querySelector('[data-lv="link"]'); expect(lier).toBeTruthy();
    const avant = app.cfg.liveco.variants['v-tee-l-noir'].onHand; document.querySelector(`#shc select[data-pick="${lier.dataset.i}"]`).value = 'v-tee-l-noir'; lier.click();
    expect(app.cfg.liveco.variants['v-tee-l-noir'].onHand).toBe(avant - 1);
    clic('[data-lv="tab"][data-v="match"]'); expect(document.querySelector('[data-lv="link"]')).toBeNull();
  });
  it('rejouer les notifications ne change aucun stock', () => {
    V.openLiveco('conn'); clic('[data-lv="demo"]'); clic('[data-lv="tab"][data-v="conn"]');
    const avant = JSON.stringify(app.cfg.liveco.variants); clic('[data-lv="replay"]'); expect(JSON.stringify(app.cfg.liveco.variants)).toBe(avant);
  });
  it('Connexions : TikTok annonce ses conditions, Whatnot reste masqué, la lecture seule est dite', () => {
    V.openLiveco('conn'); clic('[data-lv="tiktok"]'); expect($('lv_tt').hidden).toBe(false);
    expect($('shc').textContent).toContain(t('Whatnot n\'apparaît pas tant que son accès pour les applications tierces n\'est pas confirmé.')); expect([...$('shc').querySelectorAll('button')].some(b => /whatnot/i.test(b.textContent))).toBe(false);
    clic('[data-lv="demo"]'); clic('[data-lv="tab"][data-v="conn"]'); expect($('shc').textContent).toContain(t('Lecture seule : le stock se met à jour dans Syno, pas sur la plateforme.'));
  });
  it('supprimer la démonstration vide l\'état', () => {
    V.openLiveco('conn'); clic('[data-lv="demo"]'); clic('[data-lv="tab"][data-v="conn"]'); clic('[data-lv="undemo"]');
    expect(app.cfg.liveco.sessions).toHaveLength(0); expect(app.cfg.liveco.accounts).toHaveLength(0);
  });
});

describe('Live connecté : tout est traduit', () => {
  it('aucun texte oublié dans les quatre onglets, le détail d\'un live et la démonstration', () => {
    I18N.miss.clear(); V.openLiveco('conn'); clic('[data-lv="tiktok"]'); clic('[data-lv="demo"]');
    ['conn', 'lives', 'ballots', 'match'].forEach(k => { V.openLiveco(k); });
    V.openLiveco('lives'); document.querySelector('[data-lv="session"]').click(); document.querySelectorAll('[data-lv="session"]'); V.openLiveco('conn'); clic('[data-lv="replay"]');
    const manquants = [...I18N.miss].filter(k => !/^[\d\s€%.,:+−-]+$/.test(k)); expect(manquants).toEqual([]);
  });
});
