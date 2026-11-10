# Accueil, « Aujourd'hui » et mode simple

## Qui voit quoi

| | Compte existant (avec des pièces) | Nouveau compte (sans pièce) |
|---|---|---|
| Accueil en 3 questions | non | oui, une seule fois |
| Mode | avancé (rien ne change) | simple |
| Carte « Aujourd'hui » | oui, en haut du Bilan | oui |

Un compte existant n'est jamais dérangé : il peut passer en mode simple dans **Outils**.

## L'accueil

Trois questions, avec « Passer » et « Retour » :
1. **Statut** : particulier, micro-entrepreneur, autre statut pro.
2. **Canal** : Vinted, TikTok Live, les deux, ailleurs.
3. **Objectif** : argent de poche (100 € de bénéfice par mois), complément (500 €), en vivre (2 000 €).

Ce que ça change : l'objectif de départ (seulement si tu n'en as pas déjà un), et les 8 outils du mode simple (Ligne fiscale pour un micro-entrepreneur ou un pro, Live et Bilan des lives pour TikTok). Les réponses sont gardées dans les réglages, donc sur tous les appareils : l'accueil ne se représente pas sur un second appareil.

La case « Charger quelques pièces d'exemple » est cochée par défaut. Les exemples sont marqués, jamais comptés dans les analyses de qualité des achats, et se suppriment en un clic depuis la carte « Aujourd'hui » (ou Réglages, Exemples).

Pour revoir l'accueil : Outils, en bas de la liste en mode simple, « Revoir l'accueil ».

## « Aujourd'hui » : 4 cases

1. **À publier** : pièces disponibles sans date de publication.
2. **Vendues aujourd'hui** : nombre et montant encaissé.
3. **À relancer** : pièces en stock depuis 60 jours ou plus.
4. **Bénéfice du mois** : avec la barre d'avancement vers ton objectif (ou le CA si ton objectif est en chiffre d'affaires).

En mode simple, c'est tout ce que montre le Bilan, avec un bouton « Voir le bilan complet ». Un compte en mode simple arrive directement sur cet écran à l'ouverture de l'appli.

## Mode simple / avancé

Bascule en haut de la feuille **Outils**. Le mode simple montre 8 outils et « Plus d'outils (N) » donne accès à tous les autres : rien n'est retiré. Le choix est synchronisé entre tes appareils.

## Pour le développeur

* `src/modules/simple-mode.js` : mode, 8 outils (`essentials()`), carte « Aujourd'hui » (`todayData()`, `todayHTML()`).
* `src/modules/welcome.js` : les 3 questions et la règle d'affichage.
* `tools-index.js` appelle `app.toolsView()` pour savoir quels outils lister.
* Réglages ajoutés : `mode` (`simple` ou `avance`) et `onb` (réponses de l'accueil).
* Tests : `tests/accueil.test.js` et `tests/bienvenue.test.js`.
