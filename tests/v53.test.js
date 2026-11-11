import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const $ = id => document.getElementById(id);
let C, core, SC;
const td = () => new Date().toISOString().slice(0, 10);
const ago = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const dispo = () => app.P.find(p => p.statut === 'Disponible' && !p.crm && !p.crmx);
const vendu = () => app.P.find(p => p.statut === 'Vendu');
const patch = (p, o) => { app.save(Object.assign({}, p, o)); return app.P.find(x => x.id === p.id); };
beforeAll(async () => {
  await demarrer(120);
  C = await import('../src/modules/crm.js');
  core = await import('../src/modules/core.js');
  SC = await import('../src/modules/settings-core.js');
});
afterEach(() => { $('sheet').hidden = true; app.setCfg({ crm: {} }, true); });

describe('v53 CRM : étapes personnalisables et déplacements', () => {
  it('six étapes de départ ; renommer, masquer et ajouter', () => {
    expect(C.stages().map(s => s[0])).toEqual(['brouillon', 'ligne', 'offre', 'envoyer', 'expedie', 'finalise']);
    app.setCfg({ crm: { names: { ligne: 'Publié' }, hide: ['brouillon'], x: [{ id: 'xlit', n: 'Litige' }] } }, true);
    const L = C.stages();
    expect(L.find(s => s[0] === 'ligne')[1]).toBe('Publié');
    expect(L.find(s => s[0] === 'brouillon')).toBeUndefined();
    expect(L[L.length - 1][0]).toBe('xlit');
  });
  it('une pièce entre dans une étape perso et en ressort', () => {
    app.setCfg({ crm: { x: [{ id: 'xlit', n: 'Litige' }] } }, true);
    const p = dispo(); expect(p).toBeTruthy();
    expect(C.moveTo(p.id, 'xlit', { silent: true })).toBeTruthy();
    expect(C.stageOf(app.P.find(x => x.id === p.id))).toBe('xlit');
    const back = C.baseStage(app.P.find(x => x.id === p.id));
    expect(C.moveTo(p.id, back, { silent: true })).toBeTruthy();
    expect(app.P.find(x => x.id === p.id).crmx).toBeUndefined();
  });
  it('déplacement groupé : pas de fenêtre, les cas impossibles sont ignorés', () => {
    const p = dispo();
    expect(C.moveTo(p.id, 'offre', { silent: true, bulk: true })).toBeNull();
    expect($('sheet').hidden).toBe(true);
    const r = C.moveTo(p.id, 'ligne', { silent: true, bulk: true }); expect(r).toBeTruthy();
    expect(core.ok(app.P.find(x => x.id === p.id).pub)).toBe(true);
  });
  it('finaliser remplit la date et le prix depuis l\'offre, puis programme la demande d\'avis', () => {
    const p0 = vendu(); expect(p0).toBeTruthy();
    const q = Object.assign({}, p0, { acheteur: 'zoe_t53', offre: { a: 'zoe_t53', m: 42 } }); delete q.dv; delete q.pv; delete q.fin; q.exp = ago(2);
    app.save(q);
    expect(C.moveTo(q.id, 'finalise', { silent: true })).toBeTruthy();
    const r = app.P.find(x => x.id === q.id);
    expect(r.dv).toBe(td()); expect(r.pv).toBe(42); expect(r.fin).toBe(td());
    const c = C.contacts().find(x => x.nom === 'zoe_t53');
    expect(c.rt).toBe('avis'); expect(c.relance).toBe(core.addDays(td(), C.cadence().avis));
  });
});

describe('v53 CRM : réservations, colis, acheteurs', () => {
  it('une réservation ancienne expire, se remet en ligne et compte une annulation', () => {
    const p = patch(dispo(), { crm: 'offre', pub: ago(10), offre: { a: 'max_t53', m: 20, d: ago(5) } });
    expect(C.expired(p)).toBe(true);
    expect(C.crmTodo().expirees.map(x => x.id)).toContain(p.id);
    expect(C.putBackExpired()).toBeGreaterThan(0);
    const r = app.P.find(x => x.id === p.id); expect(r.crm).toBeUndefined();
    app.setCfg({ crm: { c: {} } }, true);
  });
  it('un colis expédié depuis longtemps est signalé et le suivi a un lien', () => {
    const p = patch(vendu(), { exp: ago(12) }); delete p.fin;
    app.save(Object.assign({}, p, { fin: undefined }));
    expect(C.cadence().slow).toBe(7);
    expect(C.trackUrl('col', 'AB 123')).toContain('laposte.fr');
    expect(C.trackUrl('mr', '999')).toContain('mondialrelay');
    expect(C.trackUrl('vgo', '999')).toBe('');
    expect(C.trackUrl('col', '')).toBe('');
  });
  it('score de fiabilité : les annulations coûtent, la liste noire vaut zéro', () => {
    expect(C.score({ n: 3, annul: 0, bl: false })).toBeGreaterThan(C.score({ n: 3, annul: 2, bl: false }));
    expect(C.score({ n: 5, annul: 0, bl: true })).toBe(0);
    expect(C.scoreLabel(80)).toBe('Fiable'); expect(C.scoreLabel(10)).toBe('À surveiller');
  });
  it('doublons proposés et fusion en une seule fiche', () => {
    const [a, b] = app.P.filter(p => p.statut === 'Vendu').slice(0, 2);
    app.save(Object.assign({}, a, { acheteur: 'julie_t53' })); app.save(Object.assign({}, b, { acheteur: 'julie_t53x' }));
    const before = C.contacts().length, D = C.dupes();
    expect(D.length).toBeGreaterThan(0);
    const [keep, drop] = D[0]; C.mergeContacts(keep.k, drop.k);
    expect(C.contacts().length).toBe(before - 1);
    expect(C.contacts().find(c => c.k === keep.k).achats.length).toBeGreaterThanOrEqual(2);
  });
  it('liste noire reconnue d\'après le pseudo', () => {
    const p = vendu(); app.save(Object.assign({}, p, { acheteur: 'bad_t53' }));
    const k = C.contacts().find(c => c.nom === 'bad_t53').k;
    app.setCfg({ crm: { c: { [k]: { bl: true } } } }, true);
    expect(C.isBlocked('@Bad_T53')).toBe(true);
    expect(C.isBlocked('quelquun_d_autre')).toBe(false);
  });
});

describe('v53 CRM : messages, exports, chiffres', () => {
  it('modèles : variables remplacées, modèle perso prioritaire', () => {
    const c = { nom: 'lea', achats: [], offres: [] }, p = vendu();
    expect(C.message('envoi', c, p)).toContain('@lea');
    expect(C.message('envoi', c, p)).not.toContain('{piece}');
    app.setCfg({ crm: { tpl: { avis: 'Coucou {pseudo} pour {piece}' } } }, true);
    expect(C.message('avis', c, p)).toMatch(/^Coucou @lea pour /);
  });
  it('export CSV : en-tête, séparateur et guillemets', () => {
    const p = vendu(); app.save(Object.assign({}, p, { acheteur: 'csv;t53' }));
    const s = C.csvBuyers(); expect(s.charCodeAt(0)).toBe(0xfeff);
    expect(s).toContain('"csv;t53"');
    expect(s.split('\r\n').length).toBeGreaterThan(1);
    expect(typeof C.csvLog()).toBe('string');
  });
  it('chiffres : par étape, taux de vente et délais cohérents', () => {
    const s = C.crmStats();
    expect(s.perStage).toHaveLength(C.stages().length);
    expect(s.rate).toBeGreaterThanOrEqual(0); expect(s.rate).toBeLessThanOrEqual(100);
    expect(s.nSold).toBeGreaterThan(0);
    expect(Array.isArray(s.top)).toBe(true);
  });
  it('journal filtrable par texte et par période', () => {
    const p = dispo(); app.save(Object.assign({}, p, { h: [...(p.h || []), { t: Date.now(), e: 'Test unique zzq53' }] }));
    expect(C.activity(50, 'zzq53', 'all').length).toBe(1);
    expect(C.activity(50, 'zzq53', '7').length).toBe(1);
    expect(C.activity(50, 'introuvable-xyz', 'all').length).toBe(0);
  });
});

describe('v53 CRM : écran', () => {
  it('une colonne par étape, sélection groupée, chiffres et réglages', () => {
    app.setCfg({ crm: { x: [{ id: 'xlit', n: 'Litige' }] } }, true);
    app.setStockMode('crm'); app.crmSub('pipe');
    expect(document.querySelectorAll('#crm .cxcol').length).toBe(C.stages().length);
    document.querySelector('#crm [data-cxsel]').click();
    expect($('crm').querySelector('.cxbar')).toBeTruthy();
    document.querySelector('#crm .cxc').click();
    expect($('crm').querySelectorAll('.cxc.sel').length).toBe(1);
    document.querySelector('#crm [data-cxsel]').click();
    expect($('crm').querySelector('.cxbar')).toBeNull();
    app.crmSub('stats'); expect($('crm').querySelector('.kpis')).toBeTruthy();
    app.crmSub('log'); expect($('crm_lq')).toBeTruthy();
    app.crmSub('buyers'); expect($('crm').querySelector('[data-csv="buyers"]')).toBeTruthy();
    app.crmSub('pipe'); document.querySelector('#crm [data-cxset]').click();
    expect($('cs_ok')).toBeTruthy(); expect($('cs_t_avis')).toBeTruthy(); expect($('cs_d_offre')).toBeTruthy();
    app.setStockMode('stock');
  });
  it('les réglages du CRM sont envoyés avec le compte (synchronisation)', () => {
    app.setCfg({ crm: { dOffre: 4 } }, true);
    expect(SC.syncCfg().crm.dOffre).toBe(4);
    expect(C.cadence().offre).toBe(4);
  });
});
