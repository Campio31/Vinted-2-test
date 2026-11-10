import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pkg from './package.json' with { type: 'json' };

const RELEASE = `max@${pkg.version}${process.env.GITHUB_SHA ? '+' + process.env.GITHUB_SHA.slice(0, 7) : ''}`;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)).map(f => e.name + '/' + f) : [e.name]));

/* Après le build : écrit dans sw.js la liste exacte des fichiers à garder hors-ligne et une version qui change quand un fichier change. */
const swPrecache = () => ({
  name: 'sw-precache',
  apply: 'build',
  closeBundle() {
    const dist = 'dist';
    if (!fs.existsSync(path.join(dist, 'sw.js'))) return;
    /* le code Sentry (assets/sentry-*.js) n'est pas gardé d'avance : il n'est utile que si un DSN est renseigné, il sera mis en cache à la première utilisation */
    const files = walk(dist).filter(f => f !== 'sw.js' && !f.endsWith('.map') && !/^assets\/sentry-/.test(f)).sort();
    const h = createHash('sha1');
    files.forEach(f => h.update(f).update(fs.readFileSync(path.join(dist, f))));
    const version = `stock-v${pkg.version}-${h.digest('hex').slice(0, 8)}`;
    let sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    sw = sw.replace(/const VERSION = .*;/, `const VERSION = '${version}';`).replace(/const FILES = \[[\s\S]*?\];/, `const FILES = ${JSON.stringify(['./', ...files.map(f => './' + f)])};`);
    fs.writeFileSync(path.join(dist, 'sw.js'), sw);
  },
});

export default defineConfig(async () => {
  const plugins = [swPrecache()];
  /* Cartes des sources envoyées à Sentry (messages d'erreur lisibles) : seulement si les secrets GitHub sont renseignés. */
  const withMaps = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
  if (withMaps) {
    const { sentryVitePlugin } = await import('@sentry/vite-plugin');
    plugins.push(sentryVitePlugin({ org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN, release: { name: RELEASE }, sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] } }));
  }
  return {
    base: './',
    plugins,
    define: { __RELEASE__: JSON.stringify(RELEASE) },
    build: { outDir: 'dist', sourcemap: withMaps ? 'hidden' : false, target: 'es2020', rollupOptions: { input: { main: 'index.html', admin: 'admin.html' }, output: { manualChunks: id => (id.includes('@sentry') ? 'sentry' : undefined) } } },
    test: { environment: 'jsdom', include: ['tests/**/*.test.js'], setupFiles: ['tests/setup.js'] },
  };
});
