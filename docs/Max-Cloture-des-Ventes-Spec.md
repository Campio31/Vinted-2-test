# Max — Clôture des ventes

**Spécification produit et technique · V1 · France / EUR · 15 novembre 2026**

## 1. Objectif

**À la fin du mois, Max montre ce que la plateforme a réglé, ce qui est encore en attente et ce qui mérite une vérification.** Le vendeur peut ensuite vérifier les virements arrivés à la banque, sans que cette étape soit obligatoire pour clôturer ses ventes.

Ce mode réutilise les commandes, ventes et retours de Max. Il ajoute des justificatifs et un rapprochement sans créer un second historique des ventes, sans modifier le stock, et sans faire de calcul déclaratif. Une vente Live ou boutique suit le même parcours.

**V1** — Choisir le mois et les comptes. Ajouter des opérations manuellement ou importer un fichier pris en charge. Examiner les écarts. Enregistrer un récapitulatif versionné. Confirmation bancaire manuelle facultative.

**Hors V1** — Connexion bancaire, déclenchement de virements ou remboursements, connexion universelle aux marketplaces, mise à jour du stock, comptabilité fiscale et déclaration. Ce récapitulatif ne remplace pas le livre des recettes.

## 2. Les montants et dates à ne pas mélanger

| Indicateur | Définition |
|---|---|
| **Ventes enregistrées** | Valeur des articles vendus selon Max, avec annulations et remboursements visibles. Ne pas confondre prix articles et total payé par l’acheteur. |
| **Net attendu** | Ce qui devrait revenir au vendeur après les frais et ajustements connus. Toute estimation est indiquée comme telle. Un net non calculable reste inconnu. |
| **Net plateforme confirmé** | Écritures nettes de vente au porte-monnaie ou sur un relevé de règlement, selon la plateforme. Ce n’est ni le solde retirable du compte ni la preuve d’un crédit bancaire. |
| **Virement plateforme** | Transfert vers la banque, avec référence, date et statut s’ils existent. Un transfert n’est pas une nouvelle vente. |
| **Reçu en banque** | Ce que le vendeur a effectivement confirmé sur son relevé bancaire. Afficher « Confirmé par toi » en V1. Pas d’accès bancaire nécessaire. |

Afficher trois vues séparées.

1. **Ventes du mois** — commandes datées dans le mois. Leur état de règlement est calculé à une date d’arrêté choisie, y compris si celle-ci tombe après la fin du mois.
2. **Mouvements plateforme du mois** — crédits, frais, remboursements et autres écritures à leur date d’effet, même si la vente est plus ancienne.
3. **Virements du mois** — transferts à la date indiquée par la plateforme. La date de crédit bancaire confirmée est un champ distinct.

Afficher compte, devise, mois et **« Situation au … »**. Pour un espace français, Europe/Paris par défaut pour délimiter la période. Préserver le fuseau de la source. Une date sans heure reste une date, pas minuit UTC inventé. Une vente du 30 novembre réglée le 2 décembre figure dans **Ventes de novembre** et **Mouvements de décembre**. Dans une clôture arrêtée au 30 novembre, elle reste en attente si la source l’indiquait. Ne jamais additionner les trois vues.

### Exemple de résultat

**600 € nets attendus** pour les ventes de novembre. Les écritures confirment **550 €** et la source indique explicitement **35 € en attente**. À périmètre comparable, Max affiche **15 € à vérifier**, sans inventer une commission ou un remboursement.

Un virement de **400 €** peut inclure des ventes d’octobre. Il s’affiche dans Virements sans être soustrait du total des ventes de novembre. Si le vendeur confirme **380 €** en banque pour ce même virement, c’est **un écart de virement de 20 €**, pas un écart sur une vente.

## 3. Parcours écran par écran

| Écran | Action du vendeur | Réponse de Max |
|---|---|---|
| **1 · Ouvrir le mois** | Ouvrir **Ventes → Clôture des ventes**, choisir le mois et le ou les comptes. | Charge les ventes existantes. Affiche le dernier arrêté, la dernière mise à jour et l’état de couverture des sources. Crée ou reprend un brouillon. |
| **2 · Ajouter les justificatifs** | Importer un fichier pris en charge, saisir des écritures depuis le portail ou réutiliser une source déjà connectée. | Affiche un aperçu avant validation : compte, devise, période, lignes reconnues, rejetées et doublons potentiels. Permet de corriger le mapping ou d’annuler. |
| **3 · Vérifier les écarts** | Ouvrir un écart et confirmer un rapprochement, documenter une cause ou laisser à vérifier. | Montre la vente, la ou les écritures, le calcul et les raisons de chaque suggestion. Les correspondances certaines sont présentées séparément. |
| **4 · Contrôler les virements** | Consulter les virements et confirmer, si souhaité, ceux vus en banque. | Compare montant, devise et référence. Distingue virement annoncé, reçu, rejeté et non vérifié. L’étape est facultative. |
| **5 · Clôturer et exporter** | Relire le résumé et cliquer **Clôturer la période**. | Fige la version avec date d’arrêté, sources, chiffres et exceptions. Propose un récap imprimable et un CSV de contrôle. |

### Libellés à utiliser

- **En attente identifiée** — la source dit que le règlement est en attente. Une absence de donnée ne donne pas ce statut.
- **Non vérifié** — source absente ou couverture insuffisante. Ne pas écrire « impayée ».
- **À rapprocher** — écriture sans vente identifiée ou vente sans rapprochement alors qu’une source pertinente a été ajoutée.
- **Écart de montant** — les montants sont comparables, mais la différence n’est pas expliquée.
- **Ajustement non ventilé** — frais, remboursement ou retenue au niveau du compte, sans lien fiable avec une vente.
- **Réglée hors période** — différence de calendrier, pas un manque d’argent.
- **Virement à vérifier** — transfert non retrouvé, rejeté ou confirmé avec un montant différent. Ne pas confondre avec une vente impayée.

Prévoir également le filtre **À traiter en priorité**, trié par montant et ancienneté, et les filtres par compte et type d’écart. Un écart reconnu avec un motif peut rester non résolu.

## 4. Sources et faisabilité par plateforme

La vérification porte sur les documentations publiques, pas sur des fichiers ou des comptes vendeurs authentifiés. Un adaptateur d’import n’est activé qu’après validation sur un fichier réel anonymisé.

| Canal | V1 proposée | Automatisation ultérieure |
|---|---|---|
| **Vinted** | Saisie guidée à partir du porte-monnaie et de son historique, ou modèle Max à remplir. Vinted distingue en attente, disponible et transfert bancaire. Si seuls des totaux sont connus, contrôler le compte, sans prétendre rapprocher les ventes une par une. [V1] [V2] | Aucun export transactionnel universel ni accès automatique au porte-monnaie n’est supposé. L’accès Vinted Pro est réservé aux comptes autorisés et ne prouve pas l’accès aux écritures financières recherchées. [V3] |
| **TikTok Shop** | Les relevés sont consultables dans **Centre des vendeurs → Finances → Relevés**. Valider les colonnes et identifiants d’un vrai export de compte français avant de proposer un import dédié. [T1] | Avec la permission Finance approuvée, lire les transactions provisoires, les écritures par commande et les paiements automatisés selon l’accès effectif. Une estimation disparaît ou est remplacée par la partie réglée correspondante. [T2] [T3] [T4] |
| **Whatnot** | CSV du **Livre de comptes** disponible depuis le Portail vendeur. Tester quels identifiants figurent dans le fichier effectivement exporté. Le rapport d’un live est une source complémentaire, pas une preuve bancaire. [W1] [W2] | Le rapport financier de l’API documente notamment l’identifiant d’écriture, la référence commande, l’ID du live et le montant signé. Prototype sur compte propre possible. Pas de connexion SaaS commerciale sans confirmation de l’accès tiers. [W3] [W4] |

**Ordre recommandé :** noyau Max et Vinted assisté, puis import TikTok Shop vérifié sur ton compte, puis CSV Whatnot. API TikTok Finance dans un second temps, avec les autorisations requises. L’étape bancaire reste manuelle.

## 5. Moteur de rapprochement à coder

### 5.1 Règles de montant

- Stocker les centimes entiers signés et la devise. « Inconnu » n’est pas zéro. Pas de somme entre devises sans conversion explicite.
- Distinguer recette, commission, remboursement, port payé par le vendeur, réserve, transfert, achat et ajustement. Si la source fournit **18 € nets**, ne pas redéduire une commission indiquée à titre descriptif.
- Distinguer estimation et écriture comptabilisée par commande et composante. Si un règlement partiel ne précise pas quelle part est couverte, afficher le net confirmé observé et **« Reste non déterminé »**. Ne pas ajouter le total estimé au total confirmé.
- Un remboursement négatif peut diminuer le net. Il ne modifie pas la quantité en stock. Un ajustement sans commande identifiable reste au niveau compte.
- Un contrôle global de porte-monnaie ou un virement ne suffit pas à marquer toutes les ventes comme réglées. Si un règlement couvre plusieurs commandes, n’attribuer à la ligne que ce que la source justifie.
- Une différence peut être positive ou négative. Ne pas la masquer en la bornant à zéro. L’identité **attendu − confirmé − attente identifiée = écart** n’est valable que pour le même compte, la même devise, les mêmes commandes et des composantes qui ne se chevauchent pas.

### 5.2 Priorités de rapprochement

| Priorité | Donnée disponible | Traitement |
|---|---|---|
| **A · Certain** | Référence externe exacte et unique, compte, devise et type compatibles | Lier à la commande ou à la ligne identifiée. Une référence commande seule ne ventile pas automatiquement entre articles. |
| **B · Groupé** | Le relevé lie explicitement les écritures à un règlement ou virement | Lier au niveau documenté. Si le détail est incomplet, garder le reliquat non ventilé. |
| **C · Suggestion** | Montant égal, date proche, SKU, titre ou autre indice indirect | Proposer sans valider. Deux ventes de 18 € le même jour ne sont jamais rapprochées automatiquement. |
| **D · Inconnu** | Pas de lien fiable ou données insuffisantes | Garder sur le compte, avec statut et explication. Aucun montant n’est inventé. |

Une écriture peut être liée à plusieurs lignes seulement si les montants sont explicites ou confirmés par le vendeur. Empêcher que la somme des montants alloués dépasse le montant allouable, avec le même signe et la même devise. Les agrégats partent des écritures, pas du nombre de liens. Les corrections manuelles enregistrent acteur, date, motif et pièces sources, sans écraser les valeurs du relevé.

### 5.3 Imports fiables

- **Même fichier** — dédupliquer par compte et empreinte du fichier. Renvoyer le résultat du précédent import.
- **Même écriture sur plusieurs fichiers/API** — si elle a un ID fiable, identifier par compte, espace de référence et ID, puis garder l’historique de ses corrections. Un remboursement n’est pas un doublon de la vente initiale.
- **Sans ID stable** — garder fichier, ligne et type. Des dates et montants identiques créent des candidats doublons, pas une fusion silencieuse. Les collisions non résolues restent visibles hors du total confirmé.
- **Couverture** — enregistrer la fenêtre réelle, le filtre, le statut complet/partiel/inconnu, le compte et le nombre de lignes écartées. Un fichier tronqué ou filtré ne peut pas faire conclure à un non-paiement.
- **Validation** — montants, devise, séparateur, encodage, colonnes et taille. Montrer les lignes écartées et pourquoi. Ne pas exécuter les formules d’un fichier importé. Neutraliser les champs texte interprétables comme formules dans le CSV produit.

## 6. Modèle de données indicatif

| Entité | Champs et contraintes utiles |
|---|---|
| `FinanceSourceBatch` | Espace, compte vendeur, type manuel/CSV/API, empreinte, début/fin de couverture, statut de couverture, version du parseur, synthèse des lignes. |
| `FinanceEntry` | Compte, lot source, ID externe d’écriture si fiable, références commande/ligne/règlement si disponibles, type, stade estimé/comptabilisé, portée compte/commande/ligne, centimes signés, devise, date d’effet, révision. |
| `SettlementLink` | Écriture source, commande/ligne ou règlement lié, centimes attribués, mode exact/suggestion validée/manuel, auteur, horodatage et historique. |
| `PlatformPayout` | Compte, ID externe si disponible, montant, devise, statut, date d’envoi, date attendue facultative et source. Une écriture de retrait déjà enregistrée ne se recompte pas ici. |
| `BankReceiptCheck` | Virement Max, statut, montant et date confirmés le cas échéant, acteur, horodatage, note. Ne pas stocker de coordonnées bancaires. |
| `ClosePeriod` et `CloseSnapshot` | Unité compte + devise + mois local. Récap global dérivé par devise. Instantané versionné avec arrêté, sources et révisions référencées, couverture, résultats, exceptions et auteur. |

Réutiliser les identifiants Max des ventes et des comptes. Un mouvement financier ne crée pas une vente en silence. Si Max ne connaît pas la vente, afficher la ligne à rapprocher et permettre d’ouvrir le parcours normal de création de vente.

### Contrat de service proposé

- `previewFinanceImport(accountId, source)` et `commitFinanceImport(previewId, operationId)` — aperçu, puis validation rejouable.
- `reconcileAccount(accountId, dateRange)` — recalculer les liens certains, les candidats et les éléments non vérifiés, sans écraser une résolution manuelle.
- `resolveIssue(issueId, decision, evidence, expectedRevision)` — changer l’attribution ou documenter un écart avec historique.
- `getCloseSummary(accountId, month, asOf)` — fournir les trois vues sans les additionner.
- `closePeriod(accountId, month, asOf, expectedRevision, operationId)` — créer le bon instantané une seule fois même en cas de reprise.
- `reopenPeriod(periodId, reason)` — créer un brouillon pour une nouvelle version. Garder l’ancienne inchangée.

Isoler données, imports et exports par espace et compte vendeur. Ne pas importer les noms, adresses ou coordonnées bancaires pour cette fonctionnalité. Restreindre l’accès aux fichiers sources s’ils sont conservés. En cas d’API, limiter les permissions, conserver les jetons côté serveur et ne pas les écrire dans les logs.

## 7. Cycle de clôture et export

1. **Brouillon** — les imports et corrections modifient la vue de travail. L’utilisateur peut changer la date d’arrêté.
2. **Clôturée** — le périmètre annoncé est couvert et les écarts inexpliqués sont traités. Une attente normale peut subsister si elle est identifiée et listée.
3. **Clôturée avec exceptions** — le vendeur peut figer le mois malgré un écart, une période incomplète ou une vente non vérifiée. Max enregistre les exceptions et le motif. Le contrôle bancaire facultatif n’empêche pas la clôture.
4. **Écriture tardive** — si sa date d’effet est antérieure à l’arrêté, signaler qu’elle aurait changé le résultat et proposer une nouvelle version. Si le mouvement est effectivement postérieur, afficher un mouvement du mois suivant ou un règlement hors période. Ne pas réécrire l’instantané.
5. **Export** — « Récapitulatif de rapprochement Max », période locale, arrêté, devise, comptes, couverture, trois vues et écarts restants. Le CSV est un support de contrôle, pas une déclaration fiscale.

## 8. Développement et recette

1. **P0 · Données réelles** — repérer les IDs existants dans Max. Récupérer un relevé de test anonymisé de TikTok Shop et recenser les champs visibles côté Vinted. Inclure vente simple, lot, règlement partiel, retour et virement.
2. **P1 · Noyau** — états, dates, calculs signés, sources et rapprochement exact. Construire d’abord la saisie guidée et le modèle d’import Max.
3. **P2 · Parcours** — cinq écrans, exceptions, confirmation facultative des virements, clôture et export versionné.
4. **P3 · Adaptateurs** — import TikTok puis Whatnot sur formats vérifiés. API Finance TikTok ensuite selon les droits. Vérifier la non-duplication d’une écriture reçue à la fois par un fichier et par l’API.

| Test | Résultat attendu |
|---|---|
| 600 € attendus, 550 € confirmés, 35 € explicitement en attente | 15 € à vérifier. Pas de cause inventée. |
| Aucun détail Finance pour une commande | « Non vérifié » ou « Net indisponible ». Pas « impayée ». |
| Même relevé importé deux fois | Aucune écriture ni aucun montant doublé. |
| Deux achats de 18 € le même jour, sans référence | Aucun lien automatique. Deux candidats possibles. |
| Écriture de 18 € nets avec commission descriptive | 18 € pris en compte, commission non déduite une deuxième fois. |
| Vente du 30 novembre réglée le 2 décembre | Bonne date dans chaque vue. L’instantané arrêté au 30 novembre reste inchangé. |
| Estimation de 100 €, écriture finale de 95 € | Net confirmé à 95 €, jamais 195 €. Écart s’il reste non expliqué sur un périmètre comparable. |
| Paiement partiel sans ventilation fiable | Crédits observés conservés, reste non déterminé. |
| Remboursement partiel après expédition | Écriture négative, pas de retour automatique en stock. |
| Retrait de 400 € regroupant des ventes de plusieurs mois | Virement à part, pas de double comptage ni d’attribution inventée. |
| Virement du portail non encore confirmé en banque | Mention « Réception non vérifiée ». La période reste clôturable. |
| Fichier incomplet et chevauchement sans ID | Couverture visible et collision à résoudre, pas de faux manque ni de fusion silencieuse. |
| Clôture avec exceptions puis relevé reçu | Vue courante mise à jour. Nouvelle version seulement après action du vendeur. |
| Deux comptes ayant la même référence externe | Aucun rapprochement croisé. |

**Pilote.** Utiliser un vrai mois Vinted et TikTok Shop. Retrouver une vente finalisée, une en attente, un remboursement et un virement. Le mode remplit sa promesse si le vendeur comprend ce qui explique la différence entre ventes et virements, et sait quoi vérifier, sans refaire son tableau.

## Sources officielles

- [V1 — Vinted, vente finalisée et paiement](https://www.vinted.fr/help/4/235-een-betaling-ontvangen)
- [V2 — Vinted, transferts et historique](https://www.vinted.fr/help/68)
- [V3 — Vinted Pro Integrations, accès réservé](https://pro-docs.svc.vinted.com/)
- [T1 — TikTok Shop France, finances et relevés](https://seller-fr.tiktok.com/university/essay?default_language=fr&knowledge_id=3536105590097684)
- [T2 — TikTok Shop, transactions provisoires](https://partner.tiktokshop.com/docv2/page/get-unsettled-transactions)
- [T3 — TikTok Shop, transactions réglées par commande](https://partner.tiktokshop.com/docv2/page/get-transactions-by-order)
- [T4 — TikTok Shop, paiements automatisés](https://partner.tiktokshop.com/docv2/page/get-payments-202605)
- [W1 — Whatnot, Livre de comptes et export CSV](https://help.whatnot.com/hc/fr/articles/44413003987981-Comprendre-ta-page-Livre-de-comptes-ou-Transactions)
- [W2 — Whatnot, exporter le rapport d’un live](https://help.whatnot.com/hc/en-us/articles/36107067835533-Export-a-Show-Report-CSV)
- [W3 — Whatnot, rapports API et colonnes financières](https://developers.whatnot.com/reports)
- [W4 — Whatnot France, lancement de l’API vendeur](https://blog.teamwhatnot.com/france-blog/whatnot-seller-api)
