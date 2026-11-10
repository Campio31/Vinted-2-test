# Page d'administration (pour toi seul)

Adresse : `https://campio31.github.io/Vinted-2/admin.html` (ou l'adresse de ta version test + `admin.html`).

## Ce que tu y vois

| Carte | Source |
|---|---|
| Inscrits, confirmés, nouveaux sur 7 et 30 jours, courbe des inscriptions | les comptes Supabase (chiffres exacts, dès le premier jour) |
| Actifs aujourd'hui / 7 jours / 30 jours, courbe, fidélité jour/mois | un compte est « actif » le jour où il ouvre l'appli (mesure démarrée à la mise en place) |
| Fonctions les plus utilisées (30 jours) | écrans et outils ouverts, avec le nombre d'utilisations et de personnes différentes |
| Revenus mensuels (MRR), désabonnements | **pas branchés** : Max n'a pas de paiement en ligne. Ils s'afficheront quand on ajoutera Stripe |

## Mise en place (une seule fois)

1. Ouvre `docs/admin-setup.sql` dans un éditeur de texte. Tout en bas, remplace `TON_EMAIL@exemple.com` par l'e-mail avec lequel tu te connectes à Max (ton compte doit exister).
2. Dans Supabase : **SQL Editor, New query**, colle tout le fichier, clique sur **Run**. Tu dois voir « Success ». Tu peux le relancer sans risque.
3. Publie la nouvelle version de Max sur GitHub (guide `PUBLIER.md`). Elle contient la page admin et l'envoi des mesures.
4. Ouvre `…/admin.html`, connecte-toi avec ton e-mail et ton mot de passe.

Si la page dit « Accès refusé », l'e-mail du script ne correspond pas à ton compte : corrige l'e-mail et relance l'étape 2. Si elle dit « Le script n'a pas encore été lancé », reprends l'étape 2.

Les chiffres d'activité commencent à zéro : ils se remplissent au fur et à mesure que les utilisateurs ouvrent la nouvelle version, connectés à leur compte.

## Comment c'est protégé

* La page est publique, comme le reste du site, mais elle ne montre rien sans connexion.
* Les chiffres viennent d'une fonction Supabase (`admin_stats`) qui répond **seulement** aux comptes listés dans la table `app_admins`. Un autre compte reçoit une erreur, même s'il connaît l'adresse de la fonction.
* Aucune clé secrète n'est dans le site. Les tables de mesures ne sont lisibles par personne directement.
* Pour ajouter ou retirer un administrateur : table `app_admins` dans Supabase (Table Editor).

## Vie privée

* Ce qui est envoyé : « le compte X a ouvert l'écran ou l'outil Y, N fois, tel jour ». Jamais le stock, les ventes, les prix, les pseudos des acheteurs ou le contenu des notes.
* Les utilisateurs sont informés sur l'écran de connexion et peuvent refuser dans Outils > Confort. Un refus vide aussi les compteurs en attente sur leur appareil.
* Si un utilisateur supprime son compte, ses compteurs sont supprimés avec lui.
* Si tu as des utilisateurs en Europe, ajoute cette mesure à ta politique de confidentialité.

## Plus tard : MRR et désabonnements

Il faut un service de paiement (Stripe). Il préviendrait une fonction Supabase à chaque abonnement ou résiliation ; la page calculerait alors le MRR et les départs. À décider ensemble quand tu voudras des abonnements payants.
