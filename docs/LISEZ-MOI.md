# Max

Application web installable (téléphone et PC) pour suivre le stock et les ventes : ajout de pièces avec photo, passage en vendu, retours, bilan, export Excel, sauvegarde JSON. Elle fonctionne aussi sans connexion une fois installée.

## Mettre l'application en ligne (gratuit)

L'installation sur téléphone demande une adresse en https. Deux solutions simples :

**Netlify (le plus rapide)**
1. Va sur https://app.netlify.com/drop et crée un compte gratuit.
2. Glisse le dossier `appli-stock` entier dans la zone indiquée.
3. Netlify te donne une adresse du type `https://nom-au-hasard.netlify.app`. Tu peux la renommer dans les réglages du site.

**GitHub Pages**
1. Crée un dépôt GitHub et envoie-y le contenu du dossier `appli-stock`.
2. Dans Settings → Pages, choisis la branche principale comme source.

## Installer sur ton téléphone ou ton PC

- **Android (Chrome)** : ouvre l'adresse, puis menu ⋮ → « Installer l'application ». Un bouton « Installer » apparaît aussi dans l'onglet Export.
- **iPhone (Safari)** : ouvre l'adresse, touche Partager, puis « Sur l'écran d'accueil ».
- **PC (Chrome ou Edge)** : icône d'installation à droite de la barre d'adresse.

## Synchronisation entre appareils

Par défaut, les données restent sur l'appareil. Pour partager le stock entre téléphone et PC, suis **SYNCHRONISATION.md** (base Supabase gratuite, fichier supabase-setup.sql fourni, valeurs à mettre dans config.js).

Dans tous les cas, fais régulièrement une **Sauvegarde complète (JSON)** dans l'onglet Export : elle contient les pièces et les photos.

## Mettre à jour l'application

Remplace les fichiers modifiés dans le dépôt GitHub et change VERSION dans `sw.js` (par exemple `stock-v4`). À l'ouverture suivante, l'appli affiche un bandeau « Nouvelle version disponible » : touche **Mettre à jour**. Les données ne sont pas touchées.

## Contenu du dossier

- `index.html` : l'application
- `manifest.webmanifest`, `icons/` : installation et icône
- `sw.js` : fonctionnement hors connexion
- `config.js`, `supabase-setup.sql`, `SYNCHRONISATION.md` : synchronisation
- `vendor/supabase.js` : bibliothèque Supabase (2.45.4)
- `vendor/xlsx.full.min.js` : bibliothèque pour l'export Excel (SheetJS 0.18.5)


- `push-setup.sql`, `classement-setup.sql`, `supabase/functions/`, `generer-cles-vapid.html`, `PUSH-ET-CLASSEMENT.md` : notifications appli fermée et classement entre amis
