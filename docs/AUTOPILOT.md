# Max Autopilot, phase 1 : « Ma journée » (v35)

`src/modules/autopilot.js` calcule des tâches avec des règles (aucune IA, aucun coût) et les affiche en haut du Bilan.

**Tâches, par ordre d'importance** : plafond micro (75 % et plus), ventes à finaliser, colis à préparer, pièces à publier, prix à examiner (en ligne depuis plus de 45 jours, prix conseillé), fiches à compléter, objectif du mois en retard (après le 15), fournitures basses, sauvegarde.

**Niveaux** (`cfg.apMode`) : Manuel (Max liste, tu fais), Assisté (défaut : Max prépare un lot, tu coches puis valides), Automatique encadré (réservé, désactivé).

**Lots** (`batchOf`) : finaliser, colis prêts, publier (date du jour), prix (prix conseillé de `advice()`). Appliqués par `bulkMod`, annulables par `bulkUndo` pendant 8 secondes.

**Journal** (`cfg.apLog`, 60 derniers) et **temps gagné** (`cfg.apStats`, estimation : 0,3 min par vente finalisée, 0,5 par colis, 1 par publication, 1,5 par prix).

Rien n'est publié sur une plateforme et rien n'est modifié sans validation. Les phases suivantes (règles planifiées, IA pour les textes, fiches par photo) viendront enrichir ce moteur.
## Phase 2 : règles planifiées (v36)

Dix règles (RULES dans utopilot.js), toutes actives au départ, réglables dans Réglages. Une règle ne fait que **proposer** : sa tâche passe en tête de « Ma journée » avec la mention « Règle ». Règle coupée = tâche masquée. « Pas maintenant » reporte au lendemain. Au plus 3 tâches marquées par jour. Règle ignorée 3 jours de suite : proposition de la désactiver (compteur dans le navigateur). Les règles sont évaluées à l'ouverture de l'appli : rien ne tourne appli fermée (cela demanderait un traitement serveur, non prévu).
