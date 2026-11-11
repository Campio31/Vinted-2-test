# Version test : un site à part pour essayer, puis publier la même chose

L'idée : **le même code** est publié sur **deux sites**.

| | Site publié (celui de tes utilisateurs) | Site test (le tien) |
|---|---|---|
| Dépôt GitHub | `Vinted-2` | `Vinted-2-test` |
| Adresse | `https://campio31.github.io/Vinted-2/` | `https://campio31.github.io/Vinted-2-test/` |
| Rôle | ne bouge pas tant que tu n'as pas validé | tu y essaies chaque nouveauté |

Le mode test se déclenche tout seul quand l'adresse se termine par **`-test`**. Il n'y a rien à changer dans le code : le jour où tu es content, tu envoies **les mêmes fichiers** sur le dépôt `Vinted-2`.

## Ce que le mode test change (et ce que le site publié ne voit jamais)

* Les **données du navigateur sont séparées** : le stock, les réglages et la connexion du site test ne se mélangent pas avec ceux du site publié, même sur le même téléphone.
* Le **serveur de la version publiée est coupé** : pas de synchronisation Supabase, pas d'envoi d'erreurs à Sentry, pas de notifications push. Le site test fonctionne donc en local, sans compte, et ne peut pas abîmer les vraies données.
* Un bandeau jaune **VERSION TEST** est affiché en haut, et l'appli s'installe sous le nom **Syno TEST** (tu peux avoir les deux icônes sur ton téléphone).
* Le site publié n'est pas touché : `public/env.js` ne fait rien chez lui.

Tu peux quand même essayer la synchronisation sur le site test avec **un projet Supabase de test** (jamais le vrai) : dans le `config.js` du dépôt de test, ajoute

```js
test: { supabaseUrl: 'https://TON-PROJET-TEST.supabase.co', supabaseKey: 'sb_publishable_…' },
```

## Mise en place (une seule fois, environ 5 minutes)

1. Sur GitHub : **New repository**, nom exact **`Vinted-2-test`** (il doit finir par `-test`), public, sans README.
2. Envoie dedans le contenu de **`max-source.zip`** (décompresse, puis glisse tous les dossiers et fichiers du dossier `max-src`, y compris `.github`), comme pour le site publié. Garde ton `public/config.js` habituel.
3. **Settings → Pages → Build and deployment → Source : GitHub Actions.**
4. Attends la coche verte (onglet **Actions**), puis ouvre `https://campio31.github.io/Vinted-2-test/`.

## Au quotidien

1. Je te livre chaque modification (zip habituel).
2. Tu la glisses sur **`Vinted-2-test`**, tu attends la coche verte et tu essaies sur le site test.
3. Tu me dis ce qui va ou non, on recommence.

## Le jour de la publication

1. Quand le site test te convient, prends **le dernier `max-source.zip`**.
2. Envoie-le sur le dépôt **`Vinted-2`** (en gardant son `public/config.js`).
3. Attends la coche verte : le site publié est à jour. Aucun fichier à modifier, le bandeau test n'apparaît pas.

## À savoir

* Ne mets **jamais** le nom `-test` dans l'adresse du site publié.
* Le premier lancement du site test est vide : tu peux charger les **pièces d'exemple** de l'écran d'accueil pour essayer.
* Pour repartir de zéro sur le site test : **Réglages, Mon compte et mes données, effacer les données de l'appareil** (cela n'efface que celles du site test).
* Un domaine perso peut aussi servir de site test : ajoute `env: 'test',` dans le `config.js` de ce site.