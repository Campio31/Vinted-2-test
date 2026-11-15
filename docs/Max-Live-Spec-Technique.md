# Max Live — spécification produit et technique

**Version 1.0 · 15 novembre 2026 · Cible initiale France / EUR**

**Promesse.** Le vendeur autorise sa boutique dans Max, vend comme d’habitude et retrouve ses ventes, son stock et le résultat de ses ballots sans télécharger de CSV ni saisir chaque vente. Le vendeur fournit une seule fois les données que les plateformes ne connaissent pas, notamment le coût du ballot et, si nécessaire, sa correspondance avec un live ou des références.

**Périmètre de V1.** Synchronisation automatique en lecture seule côté plateforme, avec mise à jour du stock **interne à Max**. Une intégration commerciale TikTok Shop et, séparément, un prototype Whatnot sur un compte vendeur propre. La diffusion, les enchères, les expéditions et les annulations restent sur les plateformes. La publication et la synchronisation des stocks externes sont une V2 sous contrôle explicite du vendeur.

## 1. Faisabilité et décision de lancement

« Documenté » signifie qu’une capacité apparaît dans la documentation officielle. Cela ne garantit ni les autorisations de Max ni le comportement sur un compte donné. Cette vérification n’inclut aucun test authentifié sur un compte marchand.

| Besoin | TikTok Shop | Whatnot | Décision pour Max |
|---|---|---|---|
| Connecter la boutique du vendeur | Parcours officiel SaaS multi-vendeurs via OAuth et Partner Center. App publique soumise aux revues applicables au marché et aux scopes. Une app vendeur permet de tester sa propre boutique. [T1] [T2] | En France, Whatnot annonce l’API vendeur pour les comptes autorisés à vendre en live. La voie publique documentée pour un vendeur est un jeton personnel destiné à sa propre activité. OAuth existe dans la doc, mais l’enregistrement de Max comme app commerciale tierce et le consentement des vendeurs français ne sont pas confirmés. Whatnot demande de ne pas transmettre son jeton à un prestataire. [W1] [W2] | TikTok Shop en premier pour le SaaS. Whatnot en prototype privé. Pas de bouton public Whatnot tant que l’accès n’est pas confirmé, pas de collecte de jetons personnels de clients. |
| Récupérer commandes, lignes et changements de statut | Liste/détail des commandes et notifications de statut. Récupérer les lignes via l’API, pas seulement via le webhook. [T3] [T4] | Commandes et lignes via REST v2. Notifications de création/mise à jour documentées. Tester le paramétrage disponible dans le compte pilote. [W3] [W4] | Automatique après connexion et validation des scopes. Rattrapage périodique même si les notifications fonctionnent. |
| Identifier le live d’origine | TikTok documente `line_items[].room_id` par ligne pour l’UE, vide si achat hors live. La liste Analytics permet d’enrichir les sessions si le scope est accordé. Ne pas compter sur un événement de début/fin TikTok tant qu’il n’a pas été démontré. [T4] [T5] | Commande et notification contiennent `show_id`. Événements de début/fin de live documentés. Valider remises en ligne, absence d’ID et ventes hors live. [W3] [W5] | Associer par identifiant exact. Pas d’attribution par heure seule. Sans Analytics, ouvrir une session TikTok à la première vente attribuée, sans prétendre détecter les lives sans vente. |
| Retrouver pièce ou variante | Identifiants de lignes et de SKU documentés. Les références saisies chez le vendeur ne remplacent pas les identifiants plateforme. [T3] | Lignes REST et SKU du rapport financier documentés. Vérifier en recette quels identifiants sont présents pour une enchère standard, une annonce temporaire et un modèle réutilisable. [W4] [W6] [W7] | Liaison explicite par identifiant externe ou SKU marchand exact et unique validé. Jamais de rapprochement par titre seul. |
| Récupérer les frais et ajustements | Finance documente les montants provisoires puis les écritures de règlement par commande, avec frais et remboursements. [T6] [T7] | Rapports de l’API générés côté serveur. Rapport financier avec identifiant d’écriture, montants signés, références de commande et parfois de live. Les statistiques d’un show peuvent être estimées. Certains ajustements n’ont pas de live associé. [W6] | Le téléchargement technique d’un rapport par Max est automatique, même si la plateforme le fournit en CSV. Afficher montant provisoire et montant comptabilisé séparément. Pas de faux net si le scope ou les données manquent. |
| Mettre à jour les stocks externes | API d’écriture par variante documentée avec permission `seller.product.write`. [T8] | API d’inventaire et publication vers des lives documentées pour les comptes autorisés. [W2] [W4] | V2 pour les comptes et permissions éligibles. Pas de promesse de zéro double vente sur plusieurs marketplaces en parallèle. |
| Déduire à quel ballot appartient une pièce non identifiée | Aucune donnée native ne décrit l’origine physique du vêtement. | Même limite. Une annonce numérotée ne prouve pas de quel ballot sort l’article. [W7] | Un ballot par live, ou association explicite annonce/référence → ballot. Sinon « À attribuer ». |
| Publier automatiquement sur Vinted ou synchroniser ses annonces | Sans objet pour TikTok Shop. | Sans objet pour Whatnot. | Hors V1. Vinted Pro a une API officielle réservée aux comptes autorisés par Vinted. Sans accès vérifié, afficher une tâche « Retirer l’annonce » au vendeur. [V1] |

**Point TikTok Shop France.** La vente de vêtements de seconde main, vintage ou de pièces uniques dans cette catégorie est soumise au parcours d’autorisation vendeur de TikTok Shop. La validation de Max comme app ne rend pas les vendeurs éligibles à la catégorie. [T9]

**À faire avant de promettre Whatnot.** Obtenir une réponse officielle sur l’enregistrement OAuth d’une app SaaS tierce, la France, le parcours de consentement, les autorisations orders/shows/reports/inventory, la distribution à plusieurs vendeurs et le cycle de révocation. Ne pas lancer de connexion commerciale sur la base du seul schéma OAuth ou d’un jeton personnel.

## 2. Parcours et règles des trois modes

Le mode détermine **ce que Max suit**, pas la manière dont la plateforme fait payer l’acheteur. Un live peut combiner des pièces, des variantes et des ballots à condition de définir l’origine des ventes concernées. Le rattachement à un ballot est indépendant de la cible de stock : une pièce peut avoir les deux. Tous les écrans utilisent le même moteur de commandes.

| Mode | Préparation ponctuelle | Traitement automatique | Si l’identification manque |
|---|---|---|---|
| **Pièce unique** | Une fiche existante Max, une référence, stock initial 1. Lier l’annonce ou sa variante à cette fiche. | La commande confirmée marque la pièce vendue. Une commande éligible mais impayée peut la réserver. Max indique si une autre annonce connue doit être retirée. | Ligne « À rapprocher ». Ne pas débiter le stock au hasard. |
| **Stock par variante** | Une fiche produit, une variante par couple taille/couleur, un stock par variante. Lier chaque SKU plateforme à la variante Max. | Déduire la quantité vendue du bon SKU. Montrer stock restant et marge estimée si les coûts sont renseignés. | Un SKU inconnu ne modifie aucune autre taille. Aller dans « À rapprocher ». |
| **Ballot sans tri** | Créer le ballot avec fournisseur, coût livré et devise. Le nombre de pièces est facultatif. Choisir « Toutes les ventes éligibles de ce live » si le direct est exclusivement consacré au ballot, ou mapper les annonces/références dans un live mixte. | Cumuler ventes, frais et ajustements sur tous les lives liés. Pas de fiche individuelle, pas de saisie pendant le live. Ne pas inventer un stock physique restant si le nombre de pièces n’est pas saisi. | Pas d’association probabiliste. Les lignes ambiguës restent visibles dans le bilan du live, hors résultat du ballot jusqu’à résolution. |

### Règles d’attribution

1. La plateforme fait foi pour le live. Whatnot fournit `show_id` au niveau commande. TikTok fournit `room_id` par ligne. Le panier TikTok peut contenir des lignes d’origines différentes. Un identifiant absent n’est pas remplacé par « dernier live ouvert ».
2. Pour la cible métier, chercher une association exacte **session + identifiant externe d’annonce/variante**, puis une référence plateforme explicitement mappée pour la boutique. Refuser la sauvegarde de deux associations concurrentes de même portée. Autoriser une **correction explicite par ligne** avec historique.
3. Appliquer le **ballot par défaut** uniquement aux ventes non classées de cette session, et seulement si le vendeur a explicitement déclaré ce live « ballot exclusif ». Une ligne identifiée comme pièce/variante ne bascule pas vers ce ballot par défaut. Si une pièce identifiable a elle-même une provenance ballot enregistrée, sa vente débite le stock **une fois** et contribue au résultat de ce ballot.
4. Pour TikTok, autoriser l’affectation après le premier import si le live n’est pas visible avant diffusion. Les anciennes lignes sont ensuite recalculées. Les ventes hors live restent hors des chiffres du live. Une vente hors live d’une pièce explicitement issue d’un ballot peut compter pour la récupération du ballot, dans une rubrique séparée.
5. Pour plusieurs ballots avec une annonce réutilisée, pas de promesse de précision automatique. Préférer des annonces désignées par ballot. Un bouton « Passer au ballot B » peut être testé plus tard. Il crée un repère, pas une preuve. Les enchères chevauchantes, paiements décalés ou commandes ambiguës restent à vérifier.
6. Quand une recette est enregistrée au niveau commande et que ses lignes couvrent plusieurs ballots, la répartir uniquement si la plateforme fournit des montants par ligne ou si toutes les lignes concernées ont la même cible. Sinon, garder le montant au niveau commande et afficher « Frais non ventilés ». Une future estimation au prorata doit rester étiquetée comme telle.

**Exemple de recette.** Ballot à 540 € livré. Un premier live donne 435 € nets provisoires, puis un second live amène le net cumulé à 610 €. Max affiche 105 € restant à récupérer après le premier, puis 70 € au-dessus du coût d’achat après le second. Si un remboursement de 20 € est enregistré ensuite, l’excédent devient 50 €. Ce montant n’est pas le bénéfice comptable du vendeur.

## 3. Architecture proposée pour Max

La page publique de Max charge déjà Supabase côté client, et son bundle référence Supabase et IndexedDB. C’est suffisant pour proposer de réutiliser Supabase si le projet en production l’utilise comme stockage serveur. Ce n’est pas un audit des tables privées ni du dépôt. **Conserver le front actuel.** Ajouter une API serveur, un stockage serveur et un traitement de fond. Ne pas créer un deuxième catalogue Max. [M1]

- **Front Max** — onglet Live, comptes connectés, association facultative du ballot, rapprochements, bilan et état de synchro.
- **Serveur** — endpoints HTTPS OAuth et webhooks, stockage chiffré des tokens, jobs persistant en base. Supabase Edge Functions + Postgres et un worker planifié est une option cohérente. Utiliser un worker adapté si la durée ou le volume dépassent les limites du déploiement choisi.
- **Base serveur** — catalogue Max existant + tables Live. Le mode connecté doit fonctionner lorsque le navigateur est fermé. Si certaines fiches n’existent qu’en IndexedDB, prévoir une migration/liaison vers des identifiants serveur avant de les décrémenter automatiquement.
- **Adaptateurs** — TikTok, Whatnot et un connecteur de test appliquent le même contrat. Distinguer `documented`, `authorized` et `verified` par capacité et par compte. Ne pas afficher « Sync stock active » si seul l’accès en lecture est accordé.

```text
Notification vendeur → vérifier et enregistrer → traiter en arrière-plan
  → relire l’état courant chez la plateforme → normaliser commandes et lignes
  → attribuer le live et l’origine → enregistrer le delta de stock Max
  → rapprocher les écritures finance → recalculer le bilan
Synchronisation périodique ────────────────┘
```

### Contrat interne indicatif (TypeScript)

Les méthodes ci-dessous sont celles de **Max**, pas des endpoints à copier-coller chez les plateformes. L’adaptateur vérifie la forme et la disponibilité des vrais champs avant normalisation.

```ts
type Provider = "tiktok_shop" | "whatnot";
type Money = { minor: bigint; currency: string };
type LineStatus = "pending" | "confirmed" | "cancelled" | "unknown";
type LiveSource = "live" | "non_live" | "unknown";

type CanonicalLine = {
  orderId: string;
  lineId: string;
  variantId: string | null;
  listingId: string | null;
  merchantSku: string | null;
  externalLiveId: string | null;
  source: LiveSource;
  quantity: number;
  status: LineStatus;
  rawStatus: string;
  gross: Money | null;
  providerUpdatedAt: string | null;
};

interface LiveConnector {
  listOrderChanges(window: TimeWindow, cursor?: string): Promise<Page<OrderRef>>;
  readOrder(orderId: string): Promise<CanonicalOrder>;
  listLives?(window: TimeWindow, cursor?: string): Promise<Page<CanonicalLive>>;
  listFinanceChanges?(window: TimeWindow, cursor?: string): Promise<Page<LedgerEntry>>;
}
```

Les lecteurs de listes utilisent la pagination native. Les adaptateurs Whatnot et TikTok ne partagent ni le code de vérification de signature ni le mapping des statuts bruts. Pour certaines boutiques, les écritures Whatnot sont récupérées par génération asynchrone de rapport et lecture serveur de son URL temporaire, pas par un appel qui retourne immédiatement toutes les lignes. Ne pas stocker l’URL signée dans les logs. [W6]

### Modèle de données minimal

Les noms sont indicatifs. Réutiliser la table de stock/variantes de Max si elle existe déjà. Toutes les tables métier sont cloisonnées par `tenant_id`, avec références qui empêchent un enregistrement de relier deux tenants. Les IDs plateforme sont stockés en texte, y compris s’ils ressemblent à des nombres.

| Table | Champs clés / contraintes |
|---|---|
| `provider_accounts` | `id, tenant_id, provider, external_shop_id, market, status, scopes, last_sync_at`. Unique par tenant + plateforme + boutique. En V1, empêcher qu’une boutique soit revendiquée dans plusieurs espaces différents sans procédure de transfert. |
| `provider_credentials` | `account_id, token_secret_ref, refresh_secret_ref, expires_at`. Table privée serveur ou coffre. Jamais accessible au front. |
| `live_sessions` | `account_id, external_live_id, title?, starts_at?, ends_at?, state, assignment_mode`. Unique `(account_id, external_live_id)`. États `scheduled/live/ended/cancelled/unknown`, choix fondé sur une donnée réelle. |
| `ballots` | `id, tenant_id, supplier_id?, label, received_at?, landed_cost_minor, currency, known_units?`. Coût non négatif. Historiser les révisions de coût et recalculer les bilans. |
| `live_ballot_rules` | `session_id, ballot_id, external_subject_type?, external_subject_id?, is_default`. Un seul défaut par session, une cible par référence explicite et session. Un ballot peut être lié à plusieurs sessions. |
| `provider_sku_links` | `account_id, external_variant_id, catalog_variant_id, merchant_sku?, source, verified_at`. Unique `(account_id, external_variant_id)`. Correction historisée. Si la nature d’un identifiant Whatnot n’est pas stable, ne pas le mapper en production avant validation. |
| `provider_orders`, `provider_order_lines` | Unique `(account_id, external_order_id)` puis `(order_id, external_line_id)`. Statuts normalisé et brut, version/date fournisseur, quantités, montants, `live_session_id?`, `origin_target?`, `attribution_status`. Le live reste porté par la ligne dans le modèle commun. |
| `inventory_movements` | `variant_id, order_line_id?, delta_on_hand, delta_reserved, reason, causation_key`. Clé d’idempotence par effet métier. Solde initial et corrections via mouvements, pas via écrasement silencieux. |
| `finance_entries` | `account_id, external_entry_key, order_id?, line_id?, session_id?, type, signed_amount_minor, currency, financial_stage`. Unique `(account_id, external_entry_key)`. Whatnot utilise `ledger_transaction_id` quand disponible. TikTok utilise l’ID fiable ou une clé composite validée sur des exports réels. En absence de clé stable, remplacer un instantané versionné par commande plutôt que dédupliquer naïvement par montant. |
| `provider_events`, `sync_jobs`, `sync_cursors` | Identifiant de livraison quand fourni, empreinte de repli pour les retries identiques, travail persistant, compteur de tentatives, dates et point de reprise par compte et flux. |
| `attribution_overrides` | `order_line_id, old_target, new_target, actor_id, reason, created_at`. Les écritures finance dérivées sont recalculées sans dupliquer les recettes. |

### Routes fournisseur à intégrer en priorité

| Fonction | TikTok Shop | Whatnot REST v2 |
|---|---|---|
| Lecture commandes | `POST /order/202309/orders/search`, filtre par date de mise à jour et pagination. Charger le détail pour les événements et les cas nécessitant un état complet. La note [T4] documente Get Order Detail 202309/202507. [T10] | `GET /orders`, `GET /orders/{order_id}`, `GET /orders/{order_id}/items`. [W2] |
| Catalogue et sessions | Lire produits/SKU avec les permissions de lecture correspondantes. Pour les sessions, `GET /analytics/202509/shop_lives/performance` et scope `data.shop_analytics.public.read` si obtenu. Le noyau ne dépend pas de ce scope. [T5] | `GET /products`, `GET /shows`, `GET /shows/{show_id}`. [W2] [W4] |
| Écritures financières | `GET /finance/202507/orders/unsettled` (provisoire) et `GET /finance/202501/orders/{order_id}/statement_transactions` (par commande). Scope `seller.finance.info`. [T6] [T7] | `POST /reports` puis `GET /reports/{report_id}`. Ne pas prendre le total brut de `GET /analytics/shows/{show_id}` pour les recettes nettes. [W2] [W6] |

TikTok Shop utilise une signature pour les appels sortants en plus du jeton, avec `shop_cipher` lorsqu’il est demandé. Le webhook entrant utilise sa propre procédure de vérification. Côté Whatnot, vérifier les événements avec le format Standard Webhooks documenté. [T11] [W3]

### Stock, retours et résistance aux doublons

- Calculer l’**effet cible** de chaque ligne : `pending` réserve le stock quand le mapping de statut de la plateforme le justifie, `confirmed` retire la quantité du stock physique et libère sa réservation, `cancelled` libère une réservation et ne restitue le stock physique qu’en cas d’annulation avant expédition ou après retour revendable confirmé. `unknown` ne crée pas de nouvel effet et ouvre une anomalie si nécessaire. Un remboursement seul ne remet jamais une pièce en stock.
- Définir un point de départ du stock au branchement ou à la première liaison de SKU. Importer les ventes historiques pour le bilan sans redébiter des ventes déjà incluses dans le stock de départ. Figer le point de départ et distinguer les commandes déjà incluses du rattrapage postérieur. Une commande ouverte à ce point de départ est traitée à partir d’un état de référence, pas comme une nouvelle vente.
- Appliquer **effet cible moins effet déjà comptabilisé** dans une transaction qui verrouille la ligne et la variante. Exemple : réservation de 2 → confirmation de 2 = `delta_on_hand=-2, delta_reserved=-2`, pas une deuxième retenue sur le stock disponible. Un changement de liaison inverse l’ancien effet puis applique le nouveau de manière atomique.
- Le récepteur valide signature et compte, stocke événements et job durablement, puis répond rapidement. Le worker relit l’état courant de la commande, n’applique pas un état plus ancien et résiste à l’arrivée hors ordre. Le rattrapage utilise un curseur avec chevauchement et pagination. Ne pas avancer le curseur si une page échoue. Réessayer 429/5xx avec temporisation et aléa. Respecter les limites et les indications du fournisseur. Quand un token est révoqué, afficher « À reconnecter » et arrêter les traitements de ce compte.
- Une vente impossible ne doit pas être effacée. Si la plateforme confirme 2 ventes alors que Max comptait 1 pièce, garder le fait de vente et ouvrir un écart de stock. Afficher un stock disponible publiable d’au moins 0, sans masquer le solde physique théorique négatif.
- En V2, écrire une **quantité cible** vers chaque plateforme et relire son état. Ne jamais redéduire côté plateforme qui vient déjà de traiter la vente. Empêcher les boucles de synchro et conserver un journal des écritures externes. Répartir le stock ou garder un tampon quand un stock faible est vendu sur deux canaux.

### Calculs et affichage

- Montants en centimes entiers pour l’EUR, avec devise. Parser la précision à partir du format documenté sans calcul flottant. Ne pas sommer deux devises sans conversion explicitement configurée. Dates en UTC, affichées dans le fuseau de la boutique.
- Séparer **ventes brutes**, **net estimé**, **net comptabilisé par la plateforme**, **versement bancaire** et **coût du ballot**. Ne jamais additionner l’estimation et l’écriture finale de la même vente. Ne pas déduire des frais déjà inclus dans un montant net. Exclure cadeaux et pourboires du compte d’articles vendus. Isoler les ajustements sans rattachement fiable.
- `reste_a_recuperer = max(0, cout_livre - net_attribue)` et `ecart_vs_cout = net_attribue - cout_livre`. `net_attribue` correspond aux ventes rattachées moins frais, remboursements et ajustements attribuables, selon les données disponibles. Un chiffre sans frais connus est brut, pas « net estimé » par défaut.
- Montrer par fournisseur et type de ballot : coût livré, ventes attribuées, net, coût récupéré et délai historique pour couvrir le coût. Séparer ce qui est encore provisoire. Si le nombre de pièces à l’ouverture est inconnu, ne pas afficher de taux de vente ni de coût moyen par pièce.

## 4. Écrans et API Max

| Écran | Contenu minimal |
|---|---|
| **Connexions** | Connecter TikTok Shop, boutique autorisée et marché, permissions effectives, dernière synchro, reconnexion et déconnexion. Whatnot masqué en production tant que l’accès commercial n’est pas confirmé. |
| **Lives** | Plateforme, date ou « inconnue », numéro du live, commandes, pièces vendues, montant, état de finance et statut de synchronisation. Option « Associer un ballot ». |
| **Détail du live** | Ventes attribuées, lignes à rapprocher, brut/net, annulées ou remboursées, historique des corrections. Une notification de fin de live ne signifie pas que les règlements sont finalisés. |
| **Ballots** | Fournisseur, coût livré, liste des lives liés, progression par rapport au coût, ventes hors live liées le cas échéant, statut financier. |
| **À rapprocher** | SKU inconnu, rattachement ballot absent, frais non ventilés, écart de stock, accès perdu. Pouvoir corriger la règle une fois et recalculer. |

Routes internes proposées : `POST /live/connections/:provider/start`, `GET /live/oauth/:provider/callback`, `POST /webhooks/:provider`, `DELETE /live/connections/:id`, `GET /live/sessions`, `GET /live/sessions/:id`, `POST /live/sessions/:id/ballot-rules`, `POST /live/sku-links`, `POST /live/lines/:id/resolve`. Tous les endpoints vendeur filtrent par tenant. Relier le consentement OAuth au vendeur Max avec `state` si le flux le permet, ou une session de connexion serveur à usage unique selon les mécanismes documentés. Vérifier l’identité réelle de la boutique après échange du code. Ne pas stocker le secret d’app, les jetons ou les données brutes clients dans le front, IndexedDB ou localStorage. Ne pas demander noms, adresses ou scope expédition pour une V1 de suivi des ventes. Limiter la conservation des payloads et exclure les informations acheteurs des logs. À la déconnexion, arrêter les jobs et supprimer les credentials, puis traiter les données synchronisées selon les obligations du fournisseur et la politique annoncée au vendeur.

## 5. Ordre de développement et conditions de mise en production

| Étape | À coder | Validation attendue |
|---|---|---|
| **P0 · Vérifier les accès** | Obtenir un accès TikTok Partner Center correspondant au cas SaaS public et identifier les scopes nécessaires au marché français. Créer une app/boutique de développement ou tester sur sa propre boutique. Côté Whatnot, compte propre autorisé et demande d’accès commercial distincte. | Effectuer des appels autorisés REST avec des données de recette, sans mettre de secrets dans le code ni le navigateur. Récupérer commande, live, ligne, variantes, annulation et écriture de règlement. Enregistrer des fixtures anonymisées qui représentent les réponses réelles. |
| **P1 · Construire le noyau Max** | Comptes, sessions, commandes, règles ballot, liens SKU. Adaptateur simulé, migrations, écrans de connexion et de bilan. Jobs et effets stock idempotents. | Les trois modes passent les tests automatisés avec le même contrat, avant toute écriture externe. |
| **P2 · TikTok Shop V1** | OAuth, notifications + rattrapage, commandes ligne par ligne, `room_id`, stock interne, finance si autorisée. Analytics optionnel. Une fois accès et revues obtenus, lancer pilote vendeurs. | Un vrai live français avec achat live et achat hors live du même SKU, au moins une annulation et un rapprochement avec les relevés boutique. Si aucune donnée live authentifiée n’est disponible dans une Development Shop, lever ce point sur un compte pilote autorisé avant lancement. |
| **P3 · Whatnot** | Prototype en lecture sur le compte propre. Rapports et attribution `show_id`. Généraliser le connecteur uniquement après validation de l’accès SaaS. | Un vrai show avec annonce temporaire, éventuellement un modèle, vente hors live, réutilisation d’un ballot et rapprochement du rapport financier. Un test OAuth sur un autre compte vendeur est indispensable pour valider un parcours commercial. |
| **P4 · Stock et préparation externes** | Publication et sélection des annonces, mises à jour par variante, opt-in par boutique, plafonds/réserve et journal. | Tester les écritures sur articles de recette, doubles ventes, mises à jour concurrentes, retour à un stock cohérent et absence de boucle. Pas d’automatisation Vinted sans accès officiel. |

### Critères d’acceptation minimaux

1. **Pièce unique** — une vente confirmée du SKU lié fait passer de 1 à 0. Deux notifications et un rattrapage de la même vente ne débitent qu’une fois.
2. **Variantes** — une vente de 3 t-shirts M noirs ne modifie ni le L noir ni le M blanc. Une commande impayée puis payée ne réduit pas deux fois le stock disponible.
3. **Ballot exclusif** — le vendeur ouvre deux lives associés au même ballot, ferme Max et obtient le total automatique quand il revient. Rejouer les commandes sans double compte.
4. **Ballots mixtes** — deux annonces liées à des ballots distincts restent séparées. Une annonce commune ambiguë apparaît dans le live, pas dans les résultats des deux ballots.
5. **TikTok mixte** — deux lignes d’une commande qui n’ont pas le même `room_id` ne sont pas toutes attribuées au même direct. Une ligne sans `room_id` explicitement hors live ne rejoint pas le dernier live actif.
6. **Annulation et retours** — annulation avant expédition et confirmée par le fournisseur : libérer/recréditer une seule fois selon l’état précédent. Remboursement après envoi : ajuster le net, pas le stock tant que le retour physique revendable n’est pas établi.
7. **Finance** — frais manquants : afficher « Brut » ou « Net indisponible ». Quand un montant comptabilisé arrive, il remplace l’estimation correspondante, sans somme des deux. Importer deux fois le même rapport ne change pas le résultat.
8. **Résilience** — perdre une notification, recevoir un événement ancien puis une annulation, simuler un 429, couper le worker en cours de page : le rattrapage converge et les statuts ne régressent pas.
9. **Multi-vendeurs** — un vendeur ne voit jamais les commandes d’un autre. Signature invalide refusée. Token expiré/révoqué : indicateur de reconnexion. La synchronisation en cours ne publie rien après une déconnexion.
10. **Décision GO/NO-GO** — V1 commercialisable pour une plateforme seulement quand le parcours de connexion multi-vendeurs est autorisé, qu’au moins un live réel a été rapproché avec le relevé et que les limites du bilan sont visibles dans l’interface. En attendant, démo avec données de test et prototype privé.

**Décision produit.** Livrer une vraie automatisation en lecture seule avant la synchronisation multicanal. Le premier moment à réussir est celui où un vendeur termine son live, ne fait rien d’autre et retrouve dans Max les bonnes ventes déjà attribuées.

## Sources officielles et références

### TikTok Shop

- [T1 — Types de développeurs et parcours SaaS](https://partner.tiktokshop.com/docv2/page/tts-developer-types)
- [T2 — Revues de l’application](https://partner.tiktokshop.com/docv2/page/app-review-process)
- [T3 — Commandes, SKU, quantités et statuts](https://partner.tiktokshop.com/docv2/page/order-api-overview)
- [T4 — Attribution LIVE par ligne dans l’UE](https://partner.tiktokshop.com/docv2/page/pcr7j9rd)
- [T5 — Liste des performances des sessions LIVE](https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-list-202509)
- [T6 — Montants provisoires avant règlement](https://partner.tiktokshop.com/docv2/page/get-unsettled-transactions)
- [T7 — Écritures et frais par commande](https://partner.tiktokshop.com/docv2/page/get-transactions-by-order)
- [T8 — Mise à jour de l’inventaire par SKU](https://partner.tiktokshop.com/docv2/page/update-inventory)
- [T9 — Restrictions TikTok Shop UE et seconde main](https://seller-fr.tiktok.com/university/essay?default_language=fr&knowledge_id=6152877177997057)
- [T10 — Documentation de la liste des commandes](https://partner.tiktokshop.com/docv2/page/get-order-list-202309)
- [T11 — Paramètres et signature des appels sortants](https://partner.tiktokshop.com/docv2/page/common-parameters)
- [T12 — App et boutique de développement](https://partner.tiktokshop.com/docv2/page/64f198e74830a5028854bf8f)

### Whatnot et Max

- [W1 — Lancement en France de l’API vendeur et conditions des intégrations propres](https://blog.teamwhatnot.com/france-blog/whatnot-seller-api)
- [W2 — Authentification, jetons personnels et scopes](https://developers.whatnot.com/getting-started/authentication)
- [W3 — Événements commandes et lives](https://developers.whatnot.com/getting-started/webhooks)
- [W4 — API vendeur REST v2 et capacités](https://developers.whatnot.com/getting-started/introduction)
- [W5 — Événement commande et show_id](https://developers.whatnot.com/webhooks/tag/orders/webhook/post/orders.created)
- [W6 — Rapports API et colonnes du rapport financier](https://developers.whatnot.com/reports)
- [W7 — Annonces par type et numérotation](https://help.whatnot.com/hc/fr/articles/37446074410381-Guide-du-nouveau-vendeur-pour-les-annonces-de-produits)
- [W8 — Modèles réutilisables en accès anticipé](https://help.whatnot.com/hc/fr/articles/47600359516941-Les-mod%C3%A8les-une-nouvelle-fa%C3%A7on-de-pr%C3%A9senter-ton-inventaire-acc%C3%A8s-anticip%C3%A9)
- [V1 — API Vinted Pro et accès réservé](https://pro-docs.svc.vinted.com/)
- [M1 — Version publique de Max examinée](https://campio31.github.io/Vinted-2/)
