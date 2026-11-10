# Défis, cartes, trophées et classement (v32)

## Défis
- Chaque semaine (lundi à dimanche) : 1 défi commun et 2 personnels. Chaque mois : 3 communs et 3 personnels.
- Les défis communs sont tirés d'après la date (même résultat pour tout le monde, sans serveur). Les personnels viennent de tes 3 derniers mois (ou 4 dernières semaines) : ton point fort un peu plus haut, ton point faible, et le milieu.
- Ils sont créés à l'ouverture de l'appli et gardés dans les réglages (`cfg.defis`), donc sur tous tes appareils. Un défi fini garde son résultat (`done`, `end`, `fp`).

## Cartes
- 60 cartes, 5 raretés (Commune, Rare, Épique, Légendaire, Mythique), 7 collections. Aucune valeur réelle.
- Pack = 3 cartes. Défi de la semaine : pack. Défi du mois, palier de trophée, collection complète : pack premium (au moins une carte Rare).
- Un pack standard sans carte Rare 4 fois de suite garantit une Rare au 5e.
- Doublons : poussière (1, 3, 8, 20, 50). Fabriquer une carte manquante : 5, 15, 40, 100, 250.
- Tout est dans `cfg.cartes`. Chaque pack n'est offert qu'une fois (liste `paid`).

## Trophées
10 catégories, 5 paliers (Bronze, Argent, Or, Platine, Diamant), calculés d'après tes données. Un pack premium par palier atteint.

## Classement
- Amis : voir `classement-setup.sql` (déjà en place).
- Monde et Région : lance **une fois** `classement-monde-setup.sql` dans Supabase (SQL Editor). Facultatif pour chaque joueur.
- Points du mois : publier 1, vendre 3, colis 1, défi réussi 5 (plafond 5 000). Les points sont calculés sur l'appareil : le serveur limite les valeurs mais ne peut pas empêcher de tricher.
- Quitter le classement efface le profil public et les scores. Supprimer le compte efface tout (cascade).
- Modération : les pseudos ne sont pas filtrés. À surveiller si l'appli grandit.
## Cartes : Collection Hiver (v37)

43 cartes (10 Communes, 10 Peu communes, 5 Rares, 5 Épiques, 5 Légendaires, 5 Mythiques, 3 Uniques). Données et logique dans src/modules/cartes.js, dessins SVG dans src/modules/cartes-art.js.

- **Raretés et tirages** : Commune illimité, Peu commune 50 000, Rare 10 000, Épique 2 500, Légendaire 500, Mythique 100, Unique 3. Version Super (fond noir) de Rare à Mythique : 1 000, 250, 50, 10 (une chance sur dix par carte tirée). Les tirages sont affichés sur les cartes ; rien ne les limite réellement (voir ci-dessous).
- **État** : 5 niveaux (Correct, Bon, Très bon, Excellent, Neuf), Neuf toujours le plus rare. Les marques d'usure du dessin suivent l'état. Les Uniques sont toujours Neuves.
- **Packs** (hypothèses à valider) : Givre 4 cartes, Glacier 5 cartes (4 + 1 Rare ou mieux garantie), Aurore 5 cartes (4 + 1 Épique ou mieux garantie, 25 % de chance de Super au lieu de 10 %), d'après les packs dessinés. Chances d'un tirage ordinaire : 62 % Commune, 28 % Peu commune, 7,5 % Rare, 2 % Épique, 0,45 % Légendaire, 0,05 % Mythique. Après 4 packs Givre sans Rare, le 5e en contient une.
- **Obtention** : défi de la semaine = Givre, défi du mois = Glacier, trophée Platine ou Diamant = Aurore. Collection complète = un pack Aurore.
- **Uniques** : `LA PREMIÈRE` (première vente), `LE COLIS ZÉRO` (premier colis prêt), `LE CINTRE D'OR` (100 ventes). Choix provisoire : le brief ne dit pas comment rattacher une carte à un article réel.
- **Limite** : les tirages sont locaux à chaque joueur. Pour qu'un tirage de 3 exemplaires soit vraiment rare, il faudrait un compteur central (serveur).

**Illustrations (v38)** : les 43 dessins fournis sont dans `src/modules/cartes-svg/NN-nom.svg` (viewBox 316 × 194). Pour en remplacer un, remplace le fichier du même numéro : le rectangle de fond crème est retiré automatiquement et les marques d'usure sont ajoutées par-dessus selon l'état. Les silhouettes dessinées par code (`SIL` dans `cartes-art.js`) ne servent plus que de secours.

**Logo, dos et packs (v39)** : fichiers fournis dans `src/modules/cartes-assets/` (`logo.svg`, `dos-0` à `dos-7` : Commune, Peu commune, Rare, Épique, Légendaire, Mythique, Unique, Super ; `pack-s`, `pack-p`, `pack-a`). Les feuilles de couleur des dos sont dans `BACKBG` (`cartes-art.js`). Les identifiants internes des SVG sont rendus uniques à chaque affichage. L'ouverture des packs est une animation CSS (classes `.stg`) inspirée des phases du dessin : repos, charge avec fissures, éclat, révélation. Les trois séquences d'ouverture sur mesure du canvas (éclats de verre, séparation, aurore) ne sont pas reprises à l'identique.
