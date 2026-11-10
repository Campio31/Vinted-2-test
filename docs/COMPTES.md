# Comptes de vente

Un **compte** est un endroit où tu vends (« Vinted pro », « Vinted perso », un compte Leboncoin…). Réglages, Comptes de vente.

| Champ | Rôle |
|---|---|
| Nom | affiché partout (liste des ventes, fiche, Bilan) |
| Plateforme | Vinted (plateforme 1), TikTok Live (plateforme 2) ou Autre : sert à proposer le bon compte quand tu choisis la plateforme |
| Type | Pro ou Particulier : en changer règle la case suivante par défaut (Pro coché, Particulier décoché) |
| Commission | remplace la commission de la plateforme pour préremplir les frais ; vide = celle des Réglages |
| Pris en compte (URSSAF) | si décoché, ses ventes sont exclues du chiffre d'affaires à déclarer, du plafond et des ventes « à finaliser » |

## Règles (`src/modules/comptes.js`)
- **Sans compte** : rien ne change.
- Chaque vente garde son compte (`cpt`). Il est choisi dans la fenêtre de vente, ou proposé d'après la plateforme (le dernier compte utilisé pour celle-ci). Tous les chemins de vente (fiche, Live, vente rapide, vocale, groupée) passent par `app.save`, qui le renseigne au moment où la pièce passe à « Vendu ».
- Une pièce remise en stock, ou une vente annulée, perd son compte.
- Les ventes **d'avant les comptes** (sans `cpt`) sont rattachées au compte de leur plateforme, sinon au **compte principal**. Modifier une ancienne vente ne lui donne pas de compte d'office.
- Supprimer un compte ne supprime aucune vente : ses ventes retombent sur la règle ci-dessus.
- Le Bilan, les objectifs et le Wrapped comptent **toutes** les ventes ; le filtre par compte du Bilan et de l'onglet Vente sert à comparer.

## À vérifier
Ce qui doit être déclaré dépend de ta situation : revendre des pièces achetées pour la revente peut relever d'une activité professionnelle même depuis un compte particulier. Max te laisse choisir, il ne décide pas. Vérifie sur autoentrepreneur.urssaf.fr ou auprès d'un comptable.