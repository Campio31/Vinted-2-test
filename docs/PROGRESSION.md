# Coach du lundi, niveaux, défis et trophées

## Coach du lundi (Outils, Coach du lundi)

Une ligne de bilan (ventes et bénéfice de la semaine, comparés à la semaine d'avant), puis **3 priorités au maximum**, chacune avec un bouton qui mène à l'écran concerné :

| Priorité | Quand | Bouton |
|---|---|---|
| Prépare N colis | des ventes ne sont pas marquées prêtes | Vente, filtre « À préparer » |
| Publie N pièces | des pièces en stock ne sont pas publiées | Stock, filtre « À publier » |
| Baisse le prix de N pièces | des pièces en ligne depuis 30 jours ou plus | Stock, filtre « En ligne » |
| Objectif du mois : encore N ventes | l'objectif du mois n'est pas atteint | Bénéfice cumulé et objectif |
| Fais une sauvegarde | pas de sauvegarde depuis 7 jours | Réglages |

Si rien n'est à faire : « Tout est à jour ». Le bandeau du lundi matin reste inchangé.

## Défis et trophées (Outils, Défis et trophées)

Un seul écran, 3 onglets.

**En cours**
* **Niveau** : Débutant, Chineur (50 points), Confirmé (150), Pro (400), Expert (1 000), Légende (2 500).
  Points : publier une pièce 1, vendre une pièce 3, préparer un colis 1, réussir un défi 5. Les pièces d'exemple ne comptent pas.
  Le niveau est **calculé** à partir de ce que tu as déjà fait : rien n'est stocké, il est identique sur tous tes appareils. Un message te félicite quand tu montes de niveau.
* **Série de publication** : comme avant.
* **Défi du mois** : s'il n'y en a pas, Max en propose un d'après le mois dernier (un peu plus de ventes ou de publications ; sinon « publier 30 pièces »). Un geste pour l'accepter. Tu peux aussi en créer d'autres.
* **Carnet de médailles** : 12 cases par an, une médaille pour chaque mois où un défi est réussi.

**Trophées** : record de CA mensuel et badges (inchangés).

**Amis** : le classement entre amis, qui était caché dans les défis.

## Pour le développeur
* `src/modules/coach.js` : `coachData()` (les priorités) et la fenêtre.
* `src/modules/progress.js` : écran à onglets, `xpData()`, `levelOf()`, `proposeDefi()`, `carnet()`, `checkLevel()`.
* `app.openTrophees` et `app.openDefis` pointent tous deux vers `progress.js`, donc les anciennes cartes du Bilan fonctionnent toujours.
* Tests : `tests/progres.test.js`.
