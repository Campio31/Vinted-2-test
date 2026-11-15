# Serveur Live connecté (squelette)

Ce dossier contient ce qu'il faut **côté serveur** pour que Syno lise les ventes d'une boutique TikTok Shop sans téléchargement ni saisie.
**Rien ici n'est déployé ni testé contre une vraie plateforme.** C'est un point de départ écrit d'après `docs/Max-Live-Spec-Technique.md`.
Le moteur de référence, lui, est testé : `src/modules/live-core.js` (tests `tests/v60-live-core.test.js`).

| Fichier | Rôle | État |
|---|---|---|
| `migrations/001_live.sql` | Tables, contraintes d'unicité, cloisonnement par espace (RLS) | Écrit, jamais exécuté |
| `shared/contract.ts` | Forme canonique des commandes, lignes, écritures et du connecteur | Contrat |
| `functions/live-oauth-callback` | Retour du consentement vendeur, échange du code, vérification de la boutique | Squelette (renvoie 501) |
| `functions/live-webhook` | Réception des notifications : signature, idempotence, mise en file | Squelette (501 tant qu'aucun vérificateur n'existe) |
| `functions/live-sync-worker` | Traitement des jobs, relecture de l'état courant, rattrapage | Squelette |

## Avant d'aller plus loin (spécification, section 5, étape P0)
1. Un compte **TikTok Partner Center** correspondant au cas SaaS public, avec les portées utiles au marché français. Je ne crée aucun compte à ta place.
2. L'**autorisation vendeur** de TikTok Shop pour la seconde main (catégorie soumise à un parcours d'autorisation : la validation de l'application ne la donne pas aux vendeurs).
3. Des appels autorisés avec des données de recette (commande, live, ligne, variante, annulation, écriture de règlement) et des **fixtures anonymisées** qui représentent les vraies réponses.
4. Whatnot : une réponse officielle sur l'enregistrement d'une application tierce **avant** toute promesse. Pas de collecte de jetons personnels.

## Règles de sécurité à tenir
- Secrets (secret d'application, jetons) uniquement côté serveur ou coffre. `provider_credentials` n'a **aucune** politique d'accès : le front n'y touche jamais.
- Ne rien demander sur les acheteurs (noms, adresses) ni la portée « expédition » en V1 ; exclure les informations acheteurs des journaux ; limiter la conservation des charges utiles.
- À la déconnexion : arrêter les jobs, supprimer les identifiants, traiter les données selon les obligations du fournisseur et la politique annoncée au vendeur.

## Déploiement (quand les accès sont obtenus)
```bash
supabase db push                      # applique migrations/001_live.sql sur un projet de TEST
supabase functions deploy live-webhook live-oauth-callback live-sync-worker
```
Variables : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, et les identifiants d'application de chaque plateforme (jamais dans le dépôt).
Planifier `live-sync-worker` toutes les minutes pour le rattrapage.

## Décision GO / NO-GO (spécification, critère 10)
V1 commercialisable pour **une** plateforme seulement quand : le parcours de connexion multi-vendeurs est autorisé, au moins un live réel a été rapproché avec le relevé de la boutique, et les limites du bilan sont visibles dans l'interface. En attendant : démonstration avec données de test.
