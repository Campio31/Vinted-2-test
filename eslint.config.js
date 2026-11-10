import globals from 'globals';

/* Ce que les scripts classiques (public/i18n.js, vendor/*.js, config.js, vintage.js) mettent à disposition. */
const classiques = Object.fromEntries(['I18N', 'K', 't', 'tn', 'tv', 'cn', 'cnFr', 'detectLang', 'XLSX', 'jsQR', 'qrcode', 'VINTAGE', '__RELEASE__'].map(n => [n, 'readonly']));

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...classiques } },
    rules: {
      /* ce qui casse l'appli : un nom qui n'existe plus, une valeur importée modifiée, un doublon */
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-import-assign': 'error',
      'no-const-assign': 'error',
      'no-func-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-else-if': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      /* confort : signalé sans bloquer */
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
