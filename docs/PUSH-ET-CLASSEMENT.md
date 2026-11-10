# Notifications appli fermée et classement entre amis

Deux fonctions qui demandent le serveur Supabase que tu utilises déjà. Compte une trentaine de minutes, une seule fois. Aucun mot de passe ni aucune clé secrète ne doit être écrit dans un message ou dans un fichier envoyé sur GitHub.

## A. Classement entre amis (5 minutes)

1. Supabase → **SQL Editor** → **New query**.
2. Ouvre `classement-setup.sql`, copie tout, colle, puis **Run**. Tu dois voir « Success ».
3. Dans l'appli : **Outils → Défis du mois → Classement entre amis**. Choisis un pseudo, donne un nom au groupe, **Créer**. Un code à 6 caractères s'affiche : envoie-le à tes amis. Ils ouvrent la même page, saisissent leur pseudo et le code, puis **Rejoindre**.

Seuls le pseudo, le nombre de pièces publiées et le nombre de ventes du mois sont partagés, et seulement avec les membres du groupe.

## B. Notifications appli fermée

### 1. Fabriquer les deux clés
1. Sur ton ordinateur, double-clique sur `generer-cles-vapid.html` (il s'ouvre dans ton navigateur), puis **Générer mes clés**.
2. Copie la **clé publique** et colle-la dans `config.js`, entre les guillemets de `vapidPublicKey: ''`. Cette clé-là est publique, elle peut aller sur GitHub.
3. Garde la page ouverte : la **clé privée** va à l'étape 4. Ne l'écris nulle part d'autre.

### 2. Préparer la base
Supabase → **SQL Editor** → **New query** → colle `push-setup.sql` → **Run**.
Si un message parle de `pg_cron` ou `pg_net` : **Database → Extensions**, active les deux, puis relance.

### 3. Créer la fonction d'envoi
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom : `envoyer-rappels` (exactement).
3. Remplace tout le code par le contenu de `supabase/functions/envoyer-rappels/index.ts`, puis **Deploy**.
4. Ouvre la fonction → **Details** (ou *Settings*) et **désactive « Verify JWT »** (« Enforce JWT Verification »). La fonction est protégée par un mot de passe interne généré par `push-setup.sql`.

### 4. Ajouter les secrets
**Edge Functions → Secrets → Add new secret**, trois fois :

| Nom | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY` | la clé publique de l'étape 1 |
| `VAPID_PRIVATE_KEY` | la clé privée de l'étape 1 |
| `VAPID_SUBJECT` | `mailto:` suivi de ton e-mail, par exemple `mailto:toi@exemple.fr` |

Une fois les secrets enregistrés, ferme la page des clés.

### 5. Mettre l'appli en ligne
Remplace les fichiers sur GitHub (voir ci-dessous), attends une minute, rouvre l'appli et touche **Mettre à jour**.

### 6. Tester
1. Dans l'appli : **Outils → Rappels → Recevoir les rappels appli fermée** → autorise les notifications.
2. Touche **Envoyer un test**, puis **ferme complètement l'appli**. La notification arrive en moins d'une minute.
3. iPhone : l'appli doit être installée sur l'écran d'accueil (Safari → Partager → Sur l'écran d'accueil), iOS 16.4 ou plus récent. Ouvre-la depuis l'icône avant d'activer.

Chaque appareil (téléphone, PC) s'active séparément.

### Ce qui est envoyé
- « N colis à déposer avant 18h » : 2 h avant l'heure de dépôt réglée dans Rappels, aujourd'hui et demain tant qu'il reste des colis.
- « Live ce soir à 21h » : 2 h avant le live programmé dans Rappels.
- Le rappel du calendrier commercial : à 9 h pendant la période de préparation.

L'appli recalcule ces rappels chaque fois que tu l'ouvres ou modifies un stock. Si tu n'ouvres pas l'appli pendant plusieurs jours, seuls les rappels déjà programmés (aujourd'hui et demain) partent.

### Si le test n'arrive pas
- Supabase → **Edge Functions → envoyer-rappels → Logs** : cherche une erreur (secret manquant, par exemple).
- Rien dans les logs : SQL Editor → `select * from cron.job_run_details order by start_time desc limit 5;` pour voir si la tâche tourne, et `select * from push_queue;` pour voir si le test est enregistré.
- Si tu régénères les clés, désactive puis réactive les rappels appli fermée sur chaque appareil.

## Quoi remplacer sur GitHub

**Remplacer** : `index.html`, `sw.js`, `config.js` (avec ta clé publique collée).
**Ajouter** (utiles pour garder une trace, non nécessaires au fonctionnement) : `push-setup.sql`, `classement-setup.sql`, `supabase/functions/envoyer-rappels/index.ts`, `generer-cles-vapid.html`, `PUSH-ET-CLASSEMENT.md`.
