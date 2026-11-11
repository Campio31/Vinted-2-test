# Syno : suivi de stock et de ventes (Vinted, TikTok Live)

Application installable (PWA) en JavaScript, sans framework. Le code est découpé en modules, construit avec Vite et vérifié automatiquement avant chaque publication.

## Version test et version publiée

Un second site (dépôt dont le nom finit par -test) sert à essayer chaque nouveauté avec des données séparées ; quand il te convient, tu publies les mêmes fichiers sur le site principal. Voir docs/TEST.md.

## Si tu veux publier sans rien installer

Lis `docs/PUBLIER.md` : tu envoies ces fichiers sur GitHub, et GitHub vérifie puis publie le site tout seul. Si la vérification échoue, **l'ancienne version reste en ligne**.

## Organisation

```
index.html            la page (le contenu des écrans)
public/               fichiers servis tels quels : config.js, i18n.js, vintage.js, vendor/, icons/, fonts/, sw.js
src/
  main.js             liste les modules dans l'ordre de chargement
  state.js            le « registre » app : l'état partagé (stock, réglages, vue…)
  monitoring.js       suivi des erreurs (Sentry)
  styles.css
  modules/            un fichier par fonction de l'appli (ex. group-sale.js, supplies-planning.js…)
tests/                tests automatiques (démarrage, tous les écrans, ventes, Sentry)
admin.html            page d'administration (voir docs/ADMIN.md), avec src/admin.js
docs/                 guides (synchronisation, notifications, Sentry, publication, administration)
supabase/             fonction serveur des rappels
```

### Comment les modules se parlent

* Un module **exporte** ce dont les autres ont besoin et **importe** ce qu'il utilise : `import { eur } from './core.js'`.
* Une valeur qui **change** (le stock `P`, les réglages `cfg`, l'onglet `view`…) se lit et s'écrit dans le registre : `app.P`, `app.cfg`.
* Une fonction qu'un autre module **enveloppe** (`save`, `renderDash`, `renderAll`, `openSheet`, `toast`, `setCfg`…) s'appelle aussi par le registre : `app.save(p)`. Pour l'étendre : `const avant = app.save; app.save = function (p) { …; return avant(p) }`.
* Les modules se chargent dans l'ordre de `src/main.js`. Un module ne doit utiliser **au chargement** que les modules placés avant lui ; dans une fonction, il peut appeler n'importe lequel (via `app`).

## Commandes

Il faut Node.js 22 ou plus (nodejs.org). Une fois :

```
npm install
```

| Commande | Effet |
|---|---|
| `npm run dev` | lance l'appli en local (adresse affichée) avec rechargement automatique |
| `npm run lint` | cherche un nom qui n'existe plus, un doublon, une valeur importée modifiée |
| `npm test` | démarre l'appli dans un faux navigateur et ouvre chaque écran, fait une vente groupée, etc. |
| `npm run build` | construit le site dans `dist/` |
| `npm run check` | les trois à la suite : à lancer avant d'envoyer |

## Ajouter une fonction

1. Crée `src/modules/ma-fonction.js` avec ses imports.
2. Ajoute `import './modules/ma-fonction.js';` dans `src/main.js`, après les modules dont elle dépend.
3. Pour un outil : ajoute une entrée à `TOOLS` et une ligne dans `openTool` (voir `tools-register.js`).
4. Ajoute son nom dans la liste de `tests/screens.test.js` pour qu'elle soit ouverte à chaque vérification.
5. `npm run check`.

## Suivi des erreurs

Voir `docs/SENTRY.md`. Sans clé DSN dans `public/config.js`, rien n'est chargé ni envoyé.