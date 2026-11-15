# Live connecté : ce qui est dans Syno

L'outil **Live connecté** (menu Outils) suit les ventes de live d'une boutique, le stock et le résultat des ballots à partir de commandes lues en lecture seule.
La spécification complète est dans `docs/Max-Live-Spec-Technique.md` ; le squelette serveur dans `server/`.

## Ce qui est fait et testé
| Élément | Où | Tests |
|---|---|---|
| Moteur : centimes entiers, statuts par plateforme, attribution (live, puis cible, puis ballot), règles sans doublon, correction explicite avec historique | `src/modules/live-core.js` | `tests/v60-live-core.test.js` |
| Stock : effet cible moins effet déjà compté, réservation, annulation, vente impossible gardée avec écart de stock, changement de liaison atomique | idem | critères 1, 2, 6 |
| Finance : brut, provisoire, comptabilisé jamais additionnés ; frais non ventilés ; double import sans effet | idem | critère 7 |
| Résultat d'un ballot : `reste_a_recuperer`, `ecart_vs_cout`, exemple de la spécification (540 € → 105 € → +70 € → +50 €) | idem | critères 3, 4, 7 |
| Résilience : événement ancien ignoré, rejeu sans effet | idem | critère 8 |
| Cloisonnement par espace, capacités documentées / autorisées / vérifiées | idem | critère 9 |
| Connecteur de démonstration (n'écrit jamais dans les fiches réelles) | `src/modules/live-demo.js` | `tests/v60-live-view.test.js` |
| Écrans : Connexions, Lives (et détail), Ballots, À rapprocher | `src/modules/live-view.js` | idem |

## Ce qui n'est pas fait
- **Connexion réelle à TikTok Shop ou Whatnot** : elle demande un serveur, des comptes développeur validés et des autorisations (voir `server/README.md`). Le bouton « Connecter TikTok Shop » l'explique au lieu de faire semblant.
- **Écriture du stock sur les plateformes** (V2) : « Synchro du stock active » ne s'affiche que si l'écriture est vérifiée.
- **Fiches Syno réelles** : l'état Live a son propre stock de référence (pièces uniques et variantes). Le lien avec les fiches de Syno est à décider avec le pilote : tant qu'il n'existe pas, le connecteur de test ne modifie aucune fiche.
- Whatnot est masqué : pas de bouton public tant que l'accès pour les applications tierces n'est pas confirmé.

## Les trois modes
- **Pièce unique** : une liaison référence → pièce ; la vente confirmée fait passer le stock de 1 à 0, une seule fois.
- **Stock par variante** : une liaison par référence de variante ; une vente de 3 t-shirts M noirs ne touche ni le L noir ni le M blanc.
- **Ballot sans tri** : coût livré, puis « toutes les ventes non classées de ce live » si le direct lui est consacré, ou des règles par annonce dans un live mixte. Sans règle, une ligne ambiguë reste dans le live, hors résultat du ballot.

Un chiffre sans frais connus est affiché **brut** (« Net indisponible »), jamais « net estimé ». Le résultat d'un ballot compare les ventes au coût d'achat : ce n'est pas le bénéfice comptable.
