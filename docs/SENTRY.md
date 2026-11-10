# Être prévenu des erreurs avec Sentry

Sentry reçoit un message dès qu'un bug survient chez toi ou chez quelqu'un d'autre (écran qui plante, enregistrement impossible, synchronisation en échec) et t'envoie un e-mail. Gratuit pour un usage comme le tien (formule « Developer »).

**Tant que tu n'as pas collé de clé, rien n'est chargé ni envoyé.**

## 1. Créer le projet (5 minutes)

1. Va sur sentry.io, crée un compte. Choisis la région **Europe** quand elle est proposée (tes données restent en Europe).
2. **Create project**, plateforme **Browser JavaScript** (pas React). Donne-lui le nom « max ».
3. Sentry affiche une adresse qui ressemble à `https://abc123@o456.ingest.de.sentry.io/789` : c'est le **DSN**. Tu peux la retrouver dans **Settings, Projects, max, Client Keys (DSN)**.

## 2. Brancher l'appli

Ouvre `public/config.js` et colle le DSN entre les guillemets :

```js
sentryDsn: 'https://abc123@o456.ingest.de.sentry.io/789'
```

Envoie le fichier sur GitHub. Le DSN n'est pas un secret : il sert seulement à envoyer des erreurs vers ton projet.

## 3. Vérifier que ça marche

Ouvre l'appli avec `#test-sentry` à la fin de l'adresse (`https://campio31.github.io/Vinted-2/#test-sentry`). Une erreur « Test Sentry depuis Max » doit apparaître dans **Issues** en moins d'une minute.

## 4. Recevoir un e-mail

Dans **Alerts**, vérifie qu'une règle « Alert on every new issue » (ou « high priority issues ») existe pour le projet : elle est créée par défaut. Pour être prévenu aussi quand un bug **revient** après correction, ajoute une règle « Issue changes state from resolved to unresolved ».

## 5. (Facultatif) Messages d'erreur lisibles

Sans cette étape, les erreurs indiquent des positions dans un fichier compressé (`index-Dc86.js:1:48210`). Avec elle, elles indiquent le vrai fichier et la vraie ligne (`group-sale.js:42`).

1. Dans Sentry : **Settings, Organization Tokens**, crée un jeton. Copie-le.
2. Dans GitHub : **Settings, Secrets and variables, Actions** :
   * onglet **Secrets** : `SENTRY_AUTH_TOKEN` = le jeton ;
   * onglet **Variables** : `SENTRY_ORG` = le nom court de ton organisation (dans l'adresse de Sentry), `SENTRY_PROJECT` = `max`.
3. Au prochain envoi, GitHub transmet les cartes des sources à Sentry.

## Ce qui est envoyé, ce qui ne l'est pas

Envoyé : le message de l'erreur, la ligne de code, la version de l'appli, la langue, le navigateur et le système, et si l'appli est installée.

Jamais envoyé : ton e-mail ou ton identifiant, les cookies, les textes des écrans, les clics et les saisies (pseudos des acheteurs, prix, notes), le contenu de ton stock. Le code qui garantit cela est dans `src/monitoring.js` et il est testé (`tests/monitoring.test.js`).

Les erreurs de réseau quand tu es hors-ligne sont ignorées : c'est normal pour une appli installable.