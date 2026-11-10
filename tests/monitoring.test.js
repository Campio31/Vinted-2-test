import { describe, it, expect, vi, beforeEach } from 'vitest';

const sentry = { init: vi.fn(), setTag: vi.fn(), captureException: vi.fn(), withScope: vi.fn(cb => cb({ setTag: vi.fn() })) };
vi.mock('@sentry/browser', () => sentry);

beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

describe('suivi des erreurs (Sentry)', () => {
  it("n'envoie rien et ne charge rien tant qu'aucun DSN n'est renseigné", async () => {
    window.STOCK_CONFIG = { sentryDsn: '' };
    const { initMonitoring, report } = await import('../src/monitoring.js');
    await initMonitoring();
    report(new Error('x'));
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('démarre avec le DSN, signale les erreurs attrapées et retire les données personnelles', async () => {
    window.STOCK_CONFIG = { sentryDsn: 'https://cle@o1.ingest.sentry.io/2' };
    const { initMonitoring, report } = await import('../src/monitoring.js');
    report(new Error('avant le démarrage'), { ou: 'test' }); // gardée en attente
    await initMonitoring();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const o = sentry.init.mock.calls[0][0];
    expect(o.dsn).toBe('https://cle@o1.ingest.sentry.io/2');
    expect(o.sendDefaultPii).toBe(false);
    expect(sentry.captureException).toHaveBeenCalledTimes(1); // l'erreur en attente est partie
    report(new Error('après'));
    expect(sentry.captureException).toHaveBeenCalledTimes(2);
    // données retirées avant l'envoi
    const ev = o.beforeSend({ user: { email: 'a@b.c' }, request: { url: 'https://x/?pseudo=lea#f', cookies: 'c', headers: { a: 1 } } });
    expect(ev.user).toBeUndefined();
    expect(ev.request.cookies).toBeUndefined();
    expect(ev.request.url).toBe('https://x/');
    // pas de clics ni de saisies (ils contiennent des pseudos et des prix)
    expect(o.beforeBreadcrumb({ category: 'ui.click' })).toBeNull();
    expect(o.beforeBreadcrumb({ category: 'fetch' })).not.toBeNull();
  });

  it('ignore les erreurs de réseau normales hors-ligne', async () => {
    window.STOCK_CONFIG = { sentryDsn: 'https://cle@o1.ingest.sentry.io/2' };
    const { initMonitoring } = await import('../src/monitoring.js');
    await initMonitoring();
    const ign = sentry.init.mock.calls[0][0].ignoreErrors;
    expect(ign.some(r => r.test('TypeError: Failed to fetch'))).toBe(true);
  });
});