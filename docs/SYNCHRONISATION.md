# Synchroniser le téléphone et le PC

L'application enregistre toujours sur l'appareil d'abord (elle marche donc sans connexion), puis envoie les modifications à ta base en ligne **Supabase**. Les autres appareils les reçoivent en direct, photos comprises. Compte gratuit suffisant pour ton usage.

Compte à prévoir : 20 minutes, une seule fois.

## 1. Créer la base

1. Crée un compte sur https://supabase.com, puis **New project**.
2. Choisis un nom, un mot de passe pour la base (garde-le), et une région en Europe (Paris ou Frankfurt).
3. Quand le projet est prêt : menu **SQL Editor** → **New query** → colle tout le contenu de `supabase-setup.sql` → **Run**. Tu dois voir « Success ».

## 2. Récupérer les deux valeurs

Dans **Project Settings → API** (ou « API Keys ») :

- **Project URL** : par exemple `https://abcdefghijkl.supabase.co`
- **Clé anon** (parfois nommée « publishable key »)

Ouvre `config.js` et colle-les entre les guillemets :

```js
window.STOCK_CONFIG = {
  supabaseUrl: 'https://abcdefghijkl.supabase.co',
  supabaseKey: 'ta-cle-anon'
};
```

La clé anon est faite pour être publique. Ne mets jamais la clé `service_role`.

## 3. Mettre l'appli en ligne

Mets en ligne le dossier `appli-stock` (voir `LISEZ-MOI.md`, Netlify ou GitHub Pages). Note l'adresse obtenue.

Retourne dans Supabase, **Authentication → URL Configuration** : mets cette adresse dans **Site URL**. Elle sert aux liens des e-mails de confirmation.

Facultatif : dans **Authentication → Sign In / Providers → Email**, décoche « Confirm email » pour ne pas avoir à cliquer sur un lien à la création du compte.

## 4. Premier lancement

1. Ouvre l'appli sur le premier appareil : écran de connexion → **Créer mon compte** (e-mail + mot de passe de 6 caractères minimum).
2. Si tu avais déjà des pièces sur cet appareil, elles sont envoyées automatiquement.
3. Sinon, importe ton fichier `sauvegarde_….json` (onglet Export, « Importer »). Fais cet import **sur un seul appareil**.
4. Sur chaque autre appareil : ouvre l'adresse, **Se connecter** avec le même compte. Le stock arrive tout seul.

Ensuite, supprime la possibilité de créer d'autres comptes : **Authentication → Sign In / Providers**, désactive « Allow new users to sign up ». Tes données sont de toute façon isolées par compte, mais cela évite les inscriptions inutiles.

## Comment ça se comporte

- Une pièce ajoutée ou modifiée sur le téléphone apparaît sur le PC en quelques secondes, quand l'appli est ouverte.
- Hors connexion, tu continues à travailler. L'indicateur en haut affiche « Hors ligne · n en attente » et tout est envoyé au retour du réseau.
- Si la même pièce est modifiée sur deux appareils, la dernière modification envoyée l'emporte.
- Se déconnecter garde les données sur l'appareil. Se connecter avec un autre compte les efface (pour ne pas mélanger deux stocks).
- Garde l'habitude de faire une **Sauvegarde complète (JSON)** de temps en temps (onglet Export) : c'est ton filet de sécurité.

## Dépannage

- « Tables manquantes » : le script `supabase-setup.sql` n'a pas été exécuté en entier.
- « E-mail ou mot de passe incorrect » : vérifie ou recrée le compte.
- Rien ne se synchronise : onglet Export → carte Synchronisation, le message d'erreur y est affiché.
