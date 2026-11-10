import { describe, it, expect, beforeAll, vi } from 'vitest';
import { demarrer } from './helpers.js';
import { app } from '../src/state.js';

const stats = {
  generated: '2026-10-29T10:00:00Z', users_total: 42, users_confirmed: 38, users_7d: 5, users_30d: 17,
  active_1d: 6, active_7d: 20, active_30d: 31,
  signups_by_day: Array.from({ length: 30 }, (_, i) => ({ d: '2026-10-' + String(i % 28 + 1).padStart(2, '0'), n: i % 3 })),
  active_by_day: Array.from({ length: 30 }, (_, i) => ({ d: '2026-10-' + String(i % 28 + 1).padStart(2, '0'), n: i })),
  top_features: [{ name: 'outil:planning', uses: 120, users: 12 }, { name: 'vue:dash', uses: 90, users: 20 }, { name: 'x<script>', uses: 1, users: 1 }],
};

describe('page admin : affichage', () => {
  it('montre les chiffres, les libellés lisibles et les deux cartes non branchées', async () => {
    const { tableau, libelle } = await import('../src/admin.js');
    const h = tableau(stats);
    expect(h).toContain('>42<');
    expect(h).toContain('38 e-mails confirmés');
    expect(h).toContain('Planning');
    expect(h).toContain('Écran Tableau de bord');
    expect(h.match(/Pas encore branché/g)).toHaveLength(2);
    expect(libelle('outil:inconnu')).toBe('Outil inconnu');
  });
  it('échappe les noms venus du serveur', async () => {
    const { tableau } = await import('../src/admin.js');
    expect(tableau(stats)).not.toContain('<script>');
  });
  it('tient sans aucune donnée', async () => {
    const { tableau } = await import('../src/admin.js');
    const h = tableau({});
    expect(h).toContain('Aucune mesure');
    expect(h).toContain('>0<');
  });
});

describe('mesures d\'usage', () => {
  beforeAll(async () => {
    await demarrer(5);
    app.cloud = true;
  });
  it('compte les écrans et outils ouverts, sans contenu', async () => {
    const { usageQueue, usageReset } = await import('../src/modules/usage.js');
    usageReset();
    document.querySelector('#nav button[data-v="dash"]').click();
    app.openTool('planning');
    const q = usageQueue();
    const k = Object.keys(q).map(x => x.split('|')[1]);
    expect(k).toContain('vue:dash');
    expect(k).toContain('outil:planning');
    expect(JSON.stringify(q)).not.toMatch(/lea_m|tomtom|Lacoste/);
  });
  it('envoie par paquets quand connecté, puis vide la file', async () => {
    const { usageQueue, flushUsage } = await import('../src/modules/usage.js');
    const rpc = vi.fn(async () => ({ error: null }));
    app.sb = { rpc }; app.user = { id: 'u1' }; app.online = true;
    await flushUsage();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('track_usage');
    expect(rpc.mock.calls[0][1].p_events.length).toBeGreaterThan(0);
    expect(Object.keys(usageQueue())).toHaveLength(0);
  });
  it('garde la file si le serveur échoue', async () => {
    const { track, usageQueue, flushUsage } = await import('../src/modules/usage.js');
    track('outil:seuil');
    app.sb = { rpc: async () => ({ error: { code: '500', message: 'oups' } }) };
    await flushUsage();
    expect(Object.keys(usageQueue()).length).toBe(1);
  });
  it('n\'envoie rien si l\'utilisateur refuse', async () => {
    const { track, usageQueue, usageReset } = await import('../src/modules/usage.js');
    usageReset();
    app.cfg = Object.assign({}, app.cfg, { stats: false });
    track('outil:planning');
    expect(Object.keys(usageQueue())).toHaveLength(0);
    app.cfg = Object.assign({}, app.cfg, { stats: true });
  });
  it('n\'envoie rien hors connexion ou sans compte', async () => {
    const { track, usageQueue, flushUsage } = await import('../src/modules/usage.js');
    track('outil:fourn');
    const rpc = vi.fn(async () => ({ error: null }));
    app.sb = { rpc }; app.user = null;
    await flushUsage();
    app.user = { id: 'u1' }; app.online = false;
    await flushUsage();
    expect(rpc).not.toHaveBeenCalled();
    expect(Object.keys(usageQueue()).length).toBeGreaterThan(0);
  });
});
