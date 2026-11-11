/* Version test et version publiée : le même code, deux sites.
   Un site dont l'adresse se termine par « -test » (ex. .../Vinted-2-test/) passe en mode TEST, ou toute adresse si config.js contient env: 'test'.
   En mode TEST :
   - les données du navigateur (stock, réglages, connexion) sont rangées à part : elles ne se mélangent jamais avec celles de l'appli publiée ;
   - le serveur (Supabase), le suivi d'erreurs (Sentry) et les notifications (push) de la version publiée sont coupés,
     sauf si config.js contient un bloc test: { supabaseUrl, supabaseKey } pour un projet Supabase de test ;
   - un bandeau « VERSION TEST » est affiché.
   Sur le site publié, ce fichier ne change rien. */
window.stockEnvInit = function (w) {
  var C = w.STOCK_CONFIG = w.STOCK_CONFIG || {};
  var test = /-test(\/|$)/i.test(w.location.pathname) || C.env === 'test';
  /* ?demo=1 : la page de présentation montre l'appli dans un cadre, avec des pièces d'exemple et des données à part (jamais celles de l'utilisateur) */
  var demo = !test && /[?&]demo=1(&|$)/.test(w.location.search);
  w.STOCK_ENV = test ? 'test' : demo ? 'demo' : 'prod';
  if (!test && !demo) return w.STOCK_ENV;
  var P = test ? 'T_' : 'D_';
  try {
    var S = w.Storage && w.Storage.prototype;
    if (S) {
      var g = S.getItem, s = S.setItem, r = S.removeItem, c = S.clear;
      var isL = function (o) { return o === w.localStorage; };
      S.getItem = function (k) { return g.call(this, isL(this) ? P + k : k); };
      S.setItem = function (k, v) { return s.call(this, isL(this) ? P + k : k, v); };
      S.removeItem = function (k) { return r.call(this, isL(this) ? P + k : k); };
      S.clear = function () {
        if (!isL(this)) return c.call(this);
        var del = [], i, k;
        for (i = 0; i < this.length; i++) { k = this.key(i); if (k && k.indexOf(P) === 0) del.push(k); }
        for (i = 0; i < del.length; i++) r.call(this, del[i]);
      };
    }
    var F = w.IDBFactory && w.IDBFactory.prototype;
    if (F) {
      var o = F.open, d = F.deleteDatabase;
      F.open = function (n, v) { return v === undefined ? o.call(this, P + n) : o.call(this, P + n, v); };
      F.deleteDatabase = function (n) { return d.call(this, P + n); };
    }
  } catch (e) { /* stockage indisponible : le mode test continue sans isolation, la page le dira */ }
  if (test && C.test && typeof C.test === 'object') { for (var k2 in C.test) C[k2] = C.test[k2]; }
  else { C.supabaseUrl = ''; C.supabaseKey = ''; C.sentryDsn = ''; C.vapidPublicKey = ''; }
  var ui = function () {
    var d2 = w.document;
    d2.title = 'Syno TEST';
    d2.documentElement.dataset.env = 'test';
    var m = d2.querySelector('meta[name="apple-mobile-web-app-title"]'); if (m) m.setAttribute('content', 'Syno TEST');
    var st = d2.createElement('style');
    st.textContent = '#envb{position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99999;background:#E0A526;color:#111;font:700 12px/1.4 system-ui,sans-serif;padding:1px 12px;border-radius:0 0 10px 10px;pointer-events:none;letter-spacing:.3px}';
    d2.head.appendChild(st);
    var b = d2.createElement('div'); b.id = 'envb'; b.textContent = 'VERSION TEST'; d2.body.appendChild(b);
    /* installable à part : un second manifeste, avec un autre nom */
    try {
      var l = d2.querySelector('link[rel="manifest"]');
      if (l) {
        var base = new URL('.', w.location.href).href;
        var man = { name: 'Syno TEST', short_name: 'Syno TEST', lang: 'fr', start_url: base + 'index.html', scope: base, display: 'standalone', background_color: '#F1F2F4', theme_color: '#E0A526', icons: [{ src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: base + 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] };
        l.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(man));
      }
    } catch (e) { /* manifeste d'origine */ }
  };
  if (test) { if (w.document.readyState === 'loading') w.document.addEventListener('DOMContentLoaded', ui); else ui(); }
  return w.STOCK_ENV;
};
window.stockEnvInit(window);