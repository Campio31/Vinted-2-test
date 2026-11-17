# Max — Parcours de travail

**Spécification produit et technique · v1.0**

## 1. Décision produit

Ajouter dans Max des parcours guidés pour les tâches qui se font par lots. Un parcours garde les données et la sélection de l’utilisateur entre les étapes. **Il ne crée ni catalogue parallèle, ni listes de stock parallèles, ni nouveau menu de raccourcis sans continuité.**

Premier parcours à construire : **Réceptionner un carton**. Les autres parcours sont **Atelier annonces**, **Préparation colis**, **Déstockage** et **Avant d’acheter**. **Max Live** conserve sa propre spec et reçoit les ballots ou les pièces déjà préparés dans Max.

Exemple de bout en bout : j’ouvre un carton, j’enregistre ses quantités, je documente deux pièces manquantes, je crée 30 fiches avec le lien vers le ballot déjà rempli et je garde le reste pour un live. Si je ferme Max au milieu, je reprends à la même étape.

### Ce qui change dans Max

| Existant observé dans la version publique | Ce qu’on ajoute |
|---|---|
| Ballots, rattachement d’une pièce, analyse par ballot | Un brouillon de réception lié à un ballot, les quantités attendues et constatées, la répartition vers stock, réserve ou live |
| Fiche pièce, photo, emplacement, prix conseillé | Des sélections persistantes et des étapes de traitement par lot |
| QR et étiquettes, liste des colis | Un trajet de collecte par bac et la vérification pièce ↔ commande au scan |
| Dossier de preuves des colis | Une réutilisation des briques photo et impression pour un nouveau dossier **fournisseur**, distinct des preuves d’expédition |
| Stock dormant, états de publication, statistiques | Des actions groupées et des plans à objectif, construits sur le même stock |

Le relevé concerne la version publique de Max, pas son schéma de base de données. Les noms de tables et de composants ci-dessous sont des propositions. Vérifier les services existants dans le dépôt avant toute migration.

## 2. Navigation proposée

- Sur **Aujourd’hui**, bouton **Réceptionner un carton**. Sur la page **Ballots**, même parcours, avec le ballot déjà sélectionné si on part de sa fiche.
- Dans **À publier**, bouton **Préparer les annonces**. Dans **Colis**, bouton **Préparer une tournée**. Les outils existants restent accessibles seuls.
- Sur mobile, chaque parcours affiche une action principale, l’étape en cours et **Reprendre plus tard**. Sur ordinateur, mêmes données et mêmes actions.
- En V1, conserver le brouillon avec le mécanisme de persistance déjà utilisé par Max. Si Max synchronise ces données entre appareils, respecter sa politique de conflits. Ne pas promettre une reprise sur un autre appareil tant que ce parcours n’est pas testé.

## 3. Mode Réception — V1 à développer

### Écran 1 — Quel carton viens-tu de recevoir ?

- Choisir un **ballot existant** ou en créer un directement dans le parcours. Réutiliser son nom, sa provenance et son coût si déjà renseignés. Créer le nouveau ballot au plus tard à la validation, ou isoler un ballot brouillon des statistiques pour ne pas compter un achat abandonné.
- Champs : fournisseur ou provenance, date de réception, coût livré **si connu**, référence de commande facultative, nombre et grade(s) attendus **si connus**.
- Autoriser les commandes au poids ou au contenu inconnu. Un champ vide signifie **non renseigné**, jamais zéro.
- Le coût saisi dans Réception doit alimenter **le même coût de ballot** que l’analyse existante et Max Live. Si le ballot a déjà un coût, l’afficher et proposer sa modification explicite. Ne pas additionner coût du ballot + coût de réception si c’est le même achat.

### Écran 2 — Qu’as-tu constaté ?

Deux parcours possibles, dont le choix reste modifiable avant validation.

| Option | Interface | Résultat |
|---|---|---|
| **Je compte et je trie** | Compteurs modifiables A / B / C / À vérifier. Une correction doit pouvoir se faire sans ajouter un événement fictif. | Max calcule la quantité constatée et les écarts si une attente a été renseignée. |
| **Je garde le ballot fermé ou non trié** | Quantité totale facultative si elle est fiable. Sinon option **Quantité non vérifiée**. Pas de compteur de grades obligatoire. | Le ballot peut être préparé pour le live mais Max n’invente ni grades, ni nombre de pièces, ni taux de vente. |

En tri détaillé, chaque pièce est comptée dans une seule case. Afficher les grades attendus et reçus côte à côte seulement là où ils sont connus. Une pièce classée « À vérifier » est bien reçue. Elle n’est pas manquante.

Exemple : commande de 50 pièces grade A, réception de 42 A et 6 B. Afficher **48 reçues**, **2 manquantes**, **6 déclassées**. Ne jamais afficher « 8 manquantes ». Si le fournisseur n’a promis aucun grade, afficher le résultat du tri, sans le qualifier de non-conformité.

### Écran 3 — Des écarts à signaler ?

- Pour chaque écart, choisir un type : **quantité manquante**, **quantité en trop**, **grade différent**, **défaut**, **article différent**, **autre**. Ajouter une quantité, une note et des photos facultatives. Un même vêtement peut être déclassé et taché. Ces écarts sont descriptifs, **ils ne décrémentent pas deux fois le stock**.
- Bouton **Préparer le récap fournisseur**. Produit un aperçu copiable ou imprimable avec commande, inventaire attendu/reçu, écarts et photos sélectionnées. Max ne l’envoie pas automatiquement. La version imprimable précise les champs inconnus.
- Si le vendeur sort du parcours ou que la photo n’est pas encore enregistrée, la fiche et le statut de la photo doivent l’indiquer. Prévenir avant de générer le récap si des photos sont en attente.
- V1 : préparer les preuves. V2 : suivre la demande, l’avoir et les remplacements. Ne pas modifier le coût du ballot sur la base d’un remboursement seulement demandé.

### Écran 4 — Où vont les pièces ?

Sorties disponibles, indépendantes du grade. Une pièce grade B peut être publiée, réservée pour un live ou isolée.

| Sortie | Libellé UX | Ce que Max enregistre |
|---|---|---|
| Stock détaillé | **Créer les brouillons** | La fiche existante de Max est réutilisée, avec ballot, provenance, grade si connu et bac si choisi. Les brouillons incomplets ne sont pas publiables. Réutiliser un état non publié existant ou ajouter un indicateur de complétude. |
| Ballot pour Live | **Garder en ballot** | Une quantité au niveau du ballot, ou « inconnue » si non vérifiée. Pas de création de fiches unitaires. La réception ne programme pas de live, ne publie rien et ne nécessite aucune connexion externe. |
| À isoler | **Mettre de côté** | Une quantité réservée au contrôle, à la remise en état ou au retour fournisseur. Pas un stock vendable ni une liste « À publier ». |
| Reprendre plus tard | **Laisser à traiter** | Un reliquat dans la réception. Visible dans le récap, sans conversion automatique en pièces ni réservation pour un live. |

En **V1**, une répartition mixte est possible sur quantités connues. Exemple : 30 pièces à détailler, 12 à garder en ballot, 6 à isoler pour **48 reçues**, soit 0 à traiter. Si on a saisi les grades, l’écran permet de ventiler chaque grade entre les sorties. Les places « À détailler » deviennent des brouillons identifiés, que l’utilisateur peut compléter progressivement. Si Max ne peut pas créer de fiche sans champ obligatoire, sauvegarder des **places de préparation** puis créer la fiche au moment où ces champs sont fournis. Une place transformée ne doit plus compter comme une unité non détaillée.

Quand la quantité du ballot est inconnue, Max peut transférer son statut vers Live sans afficher de quantité. Pour détailler un sous-ensemble, demander à compter ce sous-ensemble. Le reliquat reste inconnu. On ne calcule pas « inconnu − 30 ».

### Écran 5 — Récap et validation

- Expliquer ce qui va être créé : **30 brouillons prêts à compléter**, **12 pièces en ballot**, **6 isolées**, **2 pièces manquantes signalées**.
- Bouton **Valider la réception**. Après succès, montrer **Ouvrir dans l’Atelier**, **Associer à un live** ou **Voir le récap** selon les sorties.
- Revenir sur une réception confirmée présente un historique. Une correction modifie le reliquat, crée un ajustement ou demande un déplacement explicite selon l’action. Elle ne recrée pas le stock et ne supprime pas des pièces déjà vendues.
- En cas de reprise après échec, ne pas proposer indéfiniment de recréer les fiches. Afficher précisément ce qui a été enregistré et ce qui reste à traiter.

## 4. Données et règles de développement

Réutiliser les identifiants de Max. Les objets suivants décrivent **la préparation et la provenance** des fiches existantes, pas une seconde base de produits.

| Objet | Champs indicatifs |
|---|---|
| `Reception` | `id, workspace_id, ballot_id, order_ref?, received_at, expected_total?, received_total?, quantity_mode, state, current_step, revision`. États `draft / confirmed / cancelled`. Quantités facultatives distinctes de 0. En tri détaillé, calculer le total reçu à partir des compteurs, sans deuxième saisie. |
| `ReceptionCount` | `reception_id, grade, expected_qty?, received_qty?`. Grade `A / B / C / unknown` si ce vocabulaire correspond au stock. Un total estimé est affiché comme tel, pas utilisé comme un décompte confirmé. |
| `ReceptionIssue` | `reception_id, issue_type, grade_expected?, grade_observed?, quantity?, note?, media_ids[]`. Réutiliser le composant de preuves, avec un contexte réception. |
| `ReceptionAllocation` | `id, reception_id, grade?, target, quantity?`. Cibles `item_draft / live_ballot / quarantine / unprocessed`. Une allocation Live sans quantité autorisée uniquement en mode non vérifié. |
| `ReceptionItemLink` | `allocation_id, slot, stock_item_id?`. Un couple allocation + place unique. Une fiche de stock liée au plus à une place de réception. |
| `WorkSession` | Plus tard, si nécessaire : `id, workspace_id, flow, source_id?, state, selected_ids, current_step, revision`. Ne pas construire ce moteur générique avant d’avoir éprouvé Réception et Atelier. |

### Interface de service indicative

`startReception(ballotId?)` initialise le brouillon. `saveReceptionDraft(id, revision, patch)` persiste compteurs, preuves, choix et étape. `validateReception(id, revision, operationId)` contrôle la ventilation et renvoie l’ID du ballot, les IDs des fiches ou places et le statut de l’opération. Le front utilise ces IDs pour ouvrir le prochain parcours. Éviter les redirections fondées sur un filtre vague comme « toutes les fiches créées aujourd’hui ». Si la révision a changé pendant l’édition, recharger ou proposer de résoudre le conflit avant de valider.

### Invariants

1. **Une pièce, un seul état physique à la fois.** Pour une quantité constatée, brouillons + ballot non détaillé + isolées + à traiter = reçu. Une allocation de 30 ne vient pas s’ajouter aux 30 fiches qui la matérialisent dans les totaux globaux.
2. **Quantité publiée ≠ quantité reçue.** Rien n’est en ligne à la validation. Un ballot peut continuer d’exister dans l’analyse même après avoir été totalement détaillé.
3. **La validation est rejouable.** Une relance réseau, un double clic ou une réouverture ne doit pas créer deux ballots ni deux séries de fiches. Utiliser un identifiant stable de validation et des liens uniques. Transaction serveur si disponible. Sinon opération durable rejouable avec des états explicites, sans signaler « terminé » avant la fin.
4. **Ne pas recalculer les finances existantes en enregistrant la réception.** Le coût livré est porté une seule fois par le ballot. Un éventuel coût indicatif par pièce est une répartition, pas un deuxième achat. Ne jamais diviser le prix total du ballot par le seul nombre de fiches générées si une partie reste non triée.
5. **Réception partielle.** Un même ballot peut être reçu en plusieurs fois. Ne pas signaler deux fois l’écart lié à une quantité attendue globale. Si la commande reste ouverte, afficher « Quantité restante attendue ». Marquer « Manquantes » seulement quand le vendeur clôture l’attente ou signale explicitement un manque.
6. **Lien Max Live.** Passer l’identifiant du ballot existant au parcours Live. Un live peut mélanger pièces détaillées et reliquat, mais une vente attribuée à une pièce du ballot ne doit pas compter une seconde fois comme vente anonyme du même ballot. Sans attribution fiable, garder la vente à rapprocher. Le stock chez les marketplaces et l’automatisation Live ne font pas partie de cette V1.

## 5. Les autres modes et leurs transmissions

| Mode | Point d’entrée | Séquence minimale | Ce que Max transmet ou modifie |
|---|---|---|---|
| **Atelier annonces** | Brouillons de la réception ou sélection « À publier » | Choisir les pièces → photos → mesures → titres/descriptions → vérifier | Réutilise les mêmes IDs et le modèle d’annonce enregistré. Écrit sur les fiches existantes. Copie/export dans la première version. Ne passe à « Publié » qu’après confirmation ou signal fiable d’une intégration. |
| **Préparation colis** | Commandes « À préparer » | Regrouper par bac → faire la collecte → scanner les pièces par commande → confirmer l’emballage | Vérifie que la référence appartient à la commande, y compris les lots. Un autre exemplaire identique n’est accepté que si la vente porte sur une variante et pas une pièce unique. Un scan ne signifie pas « expédié ». |
| **Déstockage** | Stock dormant / bouton « Libérer de la place » | Fixer un objectif en euros ou en pièces/bacs → voir une sélection → valider un plan | Sort un plan à baisser, grouper ou passer en live, avec hypothèses et seuils par article si les coûts sont connus. N’applique aucune baisse ni ne promet de ventes sans action explicite. Un bac « libéré » n’est qu’un objectif tant que les pièces sont là. |
| **Avant d’acheter** | Ballots → « Comparer une offre » | Saisir coût livré et nombre estimé → comparer à des ballots comparables → simuler un scénario prudent | Utilise les réceptions et les ventes existantes pour comparer grade reçu, écart, délai de récupération et montant récupéré. Affiche la taille de l’historique. L’offre simulée ne crée pas d’achat ni de stock sans validation. |

**Ordre recommandé.** Réception → Atelier annonces → Préparation colis. Déstockage et Avant d’acheter viennent ensuite, quand Max dispose de suffisamment de données sur la mise en ligne, les ventes et les réceptions. Le suivi des règlements fournisseurs, la publication multicanal et les automatisations Live avancées restent séparés.

## 6. Backlog et recette V1

### Ordre des tickets

1. **Relevé dans le dépôt** — retrouver les services de stock, ballots, médias et navigation. Établir comment Max stocke une fiche non publiée et comment il persiste un brouillon.
2. **Réception minimale** — ajouter un point d’entrée et un brouillon avec ballot, quantités et grades. Permettre reprise, fermeture et modifications.
3. **Ventilation** — proposer les quatre sorties et afficher les totaux. Créer les liaisons de fiches sans double opération. Prévoir le cas « quantité non vérifiée ».
4. **Écarts et récap** — ajouter photos et texte/impression avec les composants existants. Gérer la réception partielle.
5. **Transitions** — ouvrir la sélection exacte dans « À publier » et passer le même ID de ballot vers Live. Si le connecteur Live n’existe pas encore, la fiche indique simplement « Prêt pour un live ».
6. **Recette sur un vrai carton** — mesurer temps total, allers-retours entre écrans et ressaisies, puis ajuster le parcours avant d’ajouter la suite.

### Tests d’acceptation

| Cas | Résultat attendu |
|---|---|
| 50 A annoncées, 42 A + 6 B reçues | 48 reçues, 2 manquantes si réception close, 6 déclassées. |
| 48 reçues, répartition 30 / 12 / 6 | 30 places détaillées, 12 non détaillées, 6 isolées. Total physique 48. Conversion des 30 places en fiches sans ajout au total. |
| Mélange de grades | Les sorties ne dépassent ni le total, ni le nombre constaté dans un grade. |
| Ballot fermé, nombre inconnu | Transfert vers Live possible, aucun faux total et aucune fiche créée par défaut. |
| Fermeture à l’étape 3 puis reprise | Même ballot, mêmes compteurs et mêmes preuves déjà enregistrées. Pas de nouveau brouillon. |
| Double validation ou crash pendant la création | Rejouer la même opération sans dupliquer les fiches ni le coût du ballot. Échec partiel visible. |
| Deux livraisons de 30 et 20 sur une commande de 50 | Première livraison : 20 restantes attendues. Après la seconde : 50 reçues au total, aucun manquant. |
| Pièce détaillée issue d’un ballot vendue pendant le live | Une seule vente dans le bilan du ballot, un seul mouvement de stock. |
| Photo en attente au moment du récap | Avertissement et possibilité de continuer sans cette photo si l’utilisateur le choisit. |
| Création sans connexion marketplace | Toutes les étapes de Réception fonctionnent sans TikTok Shop, Whatnot ni Vinted. |

**Critère de réussite du pilote.** Sur le prochain carton, le vendeur va de la réception aux pièces à publier ou au ballot prêt pour un live **sans changer d’outil, sans ressaisir la provenance et sans recompter le carton**. Comparer le temps et le nombre de ressaisies à sa méthode habituelle. Pas besoin d’un seuil de performance arbitraire avant d’avoir ce premier résultat.
