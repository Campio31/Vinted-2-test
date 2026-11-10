# Publier l'appli

Deux façons. La première est recommandée : plus rien à construire à la main, et une version cassée ne part jamais en ligne.

## A. GitHub construit et publie tout seul (recommandé)

À faire **une seule fois** :

1. Dézippe `max-source.zip`. Tu obtiens un dossier avec `index.html`, `package.json`, `src/`, `public/`, `tests/`, `docs/`, `.github/`…
2. Sur ton dépôt GitHub (`campio31/Vinted-2`) : supprime les anciens fichiers à la racine (`index.html`, `sw.js`, `i18n.js`, `config.js`, `vendor/`, `icons/`, `fonts/`… ils sont maintenant dans `public/`).
3. Envoie tout le contenu du dossier dézippé : **Add file, Upload files**, puis glisse tout le contenu.
   * Le dossier `.github` est caché sous Windows : si GitHub ne l'accepte pas, crée le fichier à la main : **Add file, Create new file**, tape `.github/workflows/deploy.yml` comme nom, et colle le contenu du fichier `deploy.yml` du zip.
4. Va dans **Settings, Pages**. À « Source », choisis **GitHub Actions** (à la place de « Deploy from a branch »).
5. Onglet **Actions** : le travail « Vérifier et publier » démarre. Il prend 1 à 2 minutes. Quand il est vert, ton site est à jour à la même adresse qu'avant.

La branche doit s'appeler `main`. Si ton dépôt utilise `master`, remplace `main` par `master` dans `.github/workflows/deploy.yml`.

### Ensuite, pour chaque modification

Tu envoies les fichiers modifiés sur GitHub. Le travail se relance :
* **rouge** : quelque chose est cassé (un nom qui n'existe plus, un écran qui plante, un test qui échoue). Le site **n'est pas touché**. Clique sur le travail rouge pour lire l'erreur.
* **vert** : le site est publié.

## B. Sans GitHub Actions (comme avant)

Dézippe `max-site.zip` et envoie son contenu à la racine du dépôt, comme pour les versions précédentes (Pages en « Deploy from a branch »). Ce dossier est déjà construit ; il ne passe pas par les vérifications automatiques.