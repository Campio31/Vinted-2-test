/* Suivi des erreurs avec Sentry.
   Inactif tant que `sentryDsn` est vide dans config.js : rien n'est chargé ni envoyé.
   Respect de la vie privée : pas d'identité, pas de cookies, pas de texte des écrans (pseudos, prix, notes). */

const IGNORED = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Failed to fetch|NetworkError|Load failed|network request failed/i, // hors-ligne : normal pour une appli installable
  /AbortError/i,
];

let sentry = null;
const waiting = [];

/* Ce que Sentry reçoit : on retire tout ce qui pourrait identifier une personne. */
function scrub(event) {
  delete event.user;
  if (event.request) { delete event.request.cookies; delete event.request.headers; delete event.request.data; if (event.request.url) event.request.url = event.request.url.split('?')[0].split('#')[0]; }
  return event;
}

export async function initMonitoring() {
  const dsn = (window.STOCK_CONFIG || {}).sentryDsn;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/browser');
    Sentry.init({
      dsn,
      release: __RELEASE__,
      environment: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'dev' : 'production',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      ignoreErrors: IGNORED,
      beforeSend: scrub,
      // pas de clics ni de saisies dans les traces : ils contiennent des textes de l'écran
      beforeBreadcrumb: b => (b.category === 'ui.click' || b.category === 'ui.input' || b.category === 'console' ? null : b),
    });
    Sentry.setTag('langue', (window.I18N && window.I18N.lang) || 'fr');
    Sentry.setTag('installee', String(matchMedia('(display-mode: standalone)').matches));
    sentry = Sentry;
    waiting.splice(0).forEach(([e, ctx]) => report(e, ctx));
    /* Pour vérifier que tout est branché : ouvre l'appli avec #test-sentry à la fin de l'adresse. */
    if (location.hash === '#test-sentry') setTimeout(() => { throw new Error('Test Sentry depuis Max : tout fonctionne'); }, 600);
  } catch (e) { /* le suivi ne doit jamais gêner l'appli */ }
}

/* Signale une erreur déjà attrapée par l'appli (enregistrement impossible, synchronisation en échec…). */
export function report(err, ctx) {
  const e = err instanceof Error ? err : new Error(String((err && err.message) || err));
  if (!sentry) { if (waiting.length < 20) waiting.push([e, ctx]); return; }
  sentry.withScope(scope => {
    if (ctx) Object.keys(ctx).forEach(k => scope.setTag(k, String(ctx[k])));
    sentry.captureException(e);
  });
}
