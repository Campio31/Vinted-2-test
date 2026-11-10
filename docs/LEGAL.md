# Pages légales, compte et suppression

## Ce qui est en place
* `public/confidentialite.html` et `public/conditions.html` : deux pages publiques, liées depuis l'écran de connexion (« En créant un compte, tu acceptes… ») et depuis **Réglages, À propos de Max**.
* **Réglages, Mon compte et mes données** : exporter toutes les données, supprimer le compte (avec confirmation par la saisie de « SUPPRIMER »), ou effacer les données de l'appareil si aucun compte n'est connecté.
* **Réglages, À propos de Max** : version, contact, liens légaux.

## Ce qu'il faut faire avant d'ouvrir au grand public

1. **Compléter les deux pages.** Les passages marqués `[À COMPLÉTER : …]` (surlignés en orange) : nom ou raison sociale, adresse, e-mail de contact, date, région Supabase, durée de conservation des erreurs. Ce sont des **modèles** : fais-les relire par un juriste ou à défaut par un outil de génération reconnu (CNIL, Légal Place…) avant publication.
2. **Activer la suppression de compte.** Dans Supabase (SQL Editor), colle et lance `docs/compte-setup.sql`. Tant que ce n'est pas fait, le bouton répond « La suppression de compte n'est pas encore activée sur ce serveur » et ne supprime rien côté serveur.
3. **Renseigner `feedbackEmail`** dans `public/config.js` : l'adresse de contact s'affiche alors dans À propos (sinon, un bouton ouvre le formulaire « Proposer une idée »).
4. **Vérifier la région des services** : Supabase (Réglages du projet) et Sentry (Europe, comme choisi à la création du compte) doivent correspondre à ce que dit la page de confidentialité.

## Comment la suppression fonctionne
1. L'appli supprime les photos de l'utilisateur dans le stockage Supabase (dossier à son identifiant, et ses sauvegardes).
2. Elle appelle la fonction `delete_my_account()` : elle supprime les lignes de l'utilisateur dans chaque table (pièces, mesures d'usage, notifications, classement) puis son compte. La fonction ne peut agir que sur la personne connectée (`auth.uid()`).
3. L'appli efface les données de l'appareil (base du navigateur, réglages, cache) et se recharge.

Les rapports d'erreurs déjà envoyés à Sentry ne sont pas liés à un compte (aucune identité n'est envoyée) : ils expirent selon la durée de conservation de ton projet Sentry.
