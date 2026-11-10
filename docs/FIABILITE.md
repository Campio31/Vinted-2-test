# Fiabilité et accessibilité : ce qui est en place

| Sujet | Où | Comment ça marche |
|---|---|---|
| Bouton Retour | `src/modules/history.js` | Une fenêtre ouverte ou un changement d'onglet ajoute une entrée à l'historique du navigateur ; Retour ferme la fenêtre puis revient à l'onglet précédent. |
| Brouillon d'Ajouter | `add-view.js`, `form.js` | La saisie est enregistrée dans le navigateur (`addDraft`), reprise à l'ouverture, effacée à l'ajout ou à l'annulation. |
| Fenêtres accessibles | `src/modules/a11y.js` | Rôle de dialogue, titre, focus dans la fenêtre, Tab qui reste dedans, reste de la page `inert`, focus rendu à la fermeture. |
| Point hors ligne | `sync.js` (`dotState`) | Visible seulement avec un compte : hors ligne, ou modifications en attente depuis plus de 2 minutes. |
| Réglages datés | `settings-core.js` (`_ts`) | Chaque réglage garde la date de sa dernière modification ; une copie plus ancienne du serveur ne remplace jamais un réglage plus récent, et un appareil neuf reprend ceux du serveur. |
| Traductions | `public/i18n.js`, `tests/traductions.test.js` | Un test parcourt l'appli en anglais et échoue si un texte n'a pas sa traduction (sauf l'historique des nouveautés et les réponses de l'aide). |
| config.js frais | `public/sw.js` | `config.js` passe d'abord par le réseau, le reste d'abord par le cache. |

## Réglage daté : limite connue
La comparaison se fait sur l'horloge de chaque appareil. Si l'horloge d'un téléphone avance de plusieurs minutes, ses modifications peuvent l'emporter à tort un court instant ; ça se corrige dès la modification suivante.
