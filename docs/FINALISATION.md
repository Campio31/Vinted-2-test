# Ventes finalisées (chiffre d'affaires à déclarer)

Pour l'URSSAF, le chiffre d'affaires d'une période est celui des ventes **finalisées** pendant cette période : l'argent est reçu.
Ce n'est pas forcément celui des ventes faites pendant le mois.

## Règles (`src/modules/finalisation.js`)

| Cas | Date de finalisation |
|---|---|
| Tu as touché « Marquer la vente finalisée » (fiche d'une vente) ou « Tout finaliser » (onglet Vente, filtre À finaliser) | ce jour-là (`fin`) |
| Aucune action | date de vente + 21 jours (réglable dans Outils, Ligne fiscale) |
| Vente en main propre (canal « Autre ») | date de vente |
| Vente faite avant le 31/10/2026 (`FIN_START`) | date de vente, pour ne pas faire bouger les mois déjà déclarés |

- Une vente annulée ou retournée repasse en stock : elle n'a plus de date de finalisation et ne compte plus.
- Le Bilan, les objectifs, le Wrapped et les trophées continuent de compter à la **date de vente** : ils mesurent l'activité, pas la déclaration.
- Seuls la Ligne fiscale (plafond, TVA, déclaration URSSAF) utilisent la date de finalisation.

## À vérifier

La règle exacte de l'URSSAF (encaissement) dépend de ta situation. Le délai de 21 jours est un réglage par défaut, pas un conseil fiscal : vérifie sur autoentrepreneur.urssaf.fr.
