# Réglages fiscaux par questionnaire (v33)

La Ligne fiscale ne laisse plus saisir plafond, seuil de TVA ni taux : Max les déduit de tes réponses (`src/modules/fiscal-rules.js`).

| Réponse | Effet |
|---|---|
| Particulier | Pas de plafond. Compteur de ventes et de chiffre d'affaires face au seuil des plateformes (30 ventes ou 2 000 € par an). |
| Micro-entrepreneur, vente de marchandises | Plafond 203 100 €, franchise de TVA 85 000 €, cotisations 12,3 %, abattement 71 %. |
| Date de création | La première année, plafond et seuil de TVA réduits au prorata des jours. |
| ACRE (première année) | Cotisations à 75 % (création depuis le 1er juillet 2025) ou 50 % (avant). Ignorée après 12 mois. |
| Versement libératoire | + 1 % du chiffre d'affaires, affiché avec les cotisations. |
| Assujetti à la TVA | Pas de jauge de franchise de TVA. |
| Mensuelle / trimestrielle | Périodes de déclaration proposées. |
| Autre statut | Chiffre d'affaires seulement, sans plafond ni cotisations. |

**À vérifier chaque année** : les chiffres (`RULES` dans `fiscal-rules.js`) sont ceux de la vente de marchandises en 2026 d'après nos informations ; confirme-les sur autoentrepreneur.urssaf.fr et change-les à un seul endroit si besoin. Le délai de finalisation automatique est fixé à 21 jours.

Les périodes de déclaration proposées vont de la période en cours à celle qui contient la plus ancienne pièce.