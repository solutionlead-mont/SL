# Estimateur de revêtement de sol — avec admin des tarifs

Ce projet reprend l'estimateur (`estimateur.html`) et ajoute :

- une **page admin** pour saisir/modifier tous les prix ;
- un **fichier `prices.json`** comme source de vérité ;
- un **petit serveur Node.js** (aucune dépendance à installer) qui sert les pages et une API JSON.

L'estimateur charge les prix au démarrage depuis `/api/prices`, donc toute modification faite dans l'admin est utilisée par les visiteurs (après actualisation de leur page).

## Démarrage

Prérequis : [Node.js](https://nodejs.org) installé (version 18 ou plus).

Deux options :

1. **Double-cliquer sur `demarrer.bat`** (Windows) — le serveur démarre et l'admin s'ouvre dans le navigateur.
2. En ligne de commande, dans ce dossier :

   ```powershell
   npm start
   ```

Puis ouvrir :

| Page | URL |
|---|---|
| Estimateur | http://localhost:3000/ |
| Admin | http://localhost:3000/admin |

Pour arrêter le serveur : `Ctrl+C` dans la fenêtre de commande.

## Utilisation de l'admin

1. Ouvrir http://localhost:3000/admin.
2. Entrer le mot de passe (par défaut : `admin123`).
3. Modifier les **tarifs de base** (prix $/sqft, min – max) et les **suppléments**.
4. Cliquer sur **Enregistrer les prix**.
5. Recharger l'estimateur pour voir les nouveaux prix.

Boutons disponibles :

- **Recharger** : annule les modifications non enregistrées et relit `prices.json`.
- **Réinitialiser** : remet tous les tarifs d'origine.
- **Déconnexion** : ferme la session admin.

### Changer le mot de passe

Éditer `config.json` :

```json
{
  "port": 3000,
  "host": "127.0.0.1",
  "adminPassword": "mon-nouveau-mot-de-passe"
}
```

La variable d'environnement `ADMIN_PASSWORD` est prioritaire sur le fichier (utile en production).

## Comment fonctionne le calcul

L'estimateur additionne :

```
prix min/max = tarif de base (type + gamme)
             + suppléments éventuels (commercial, extérieur, état du béton…)
total        = prix × surface (sqft)
```

Les tarifs incluent déjà le facteur de perte matière (~10 %). Les montants sont affichés sous forme de fourchette.

## Fichiers

```
.
├── server.js          Serveur HTTP + API (Node.js, sans dépendance)
├── prices.json        Prix utilisés par l'estimateur (modifiable via l'admin)
├── config.json        Port, hôte et mot de passe admin
├── package.json       Script "npm start"
├── demarrer.bat       Lancement rapide sous Windows
└── public/
    ├── index.html     L'estimateur (design d'origine conservé)
    ├── estimateur.css Styles de l'estimateur, isolés sous .fe-estimator
    └── admin.html     Page d'administration des prix
```

## Intégrer le CSS dans une feuille de styles existante

Tout le CSS de l'estimateur est dans `public/estimateur.css` et **toutes les règles sont préfixées par `.fe-estimator`**. Il n'y a plus aucune règle globale sur `body`, `html`, `*`, `h1`, `h2`, `.card`, `.btn`, etc. : le reste du site n'est pas affecté.

Pour l'intégrer à ton fichier de styles existant :

1. Copie le contenu de `estimateur.css` à la fin de ton fichier CSS (ou importe-le avec `@import`).
2. Dans la page qui contient l'estimateur, garde le conteneur :

   ```html
   <div class="fe-estimator">
     ... tout le markup de l'estimateur ...
   </div>
   ```

3. Supprime l'ancien `<style>` de l'estimateur et garde le lien vers ta feuille de styles.

Points importants :

- Le reset (`margin: 0; padding: 0; box-sizing`) ne s'applique **qu'aux éléments à l'intérieur** de `.fe-estimator`.
- L'animation du spinner a été renommée `fe-spin` pour éviter un conflit avec un `@keyframes spin` existant.
- Si tu renommes la classe `.fe-estimator`, mets-la à jour dans le wrapper et dans les deux sélecteurs JS `document.querySelectorAll('.fe-estimator .page')` et `document.querySelectorAll('.fe-estimator .day-tile')`.
- La page admin (`admin.html`) a son propre CSS intégré, indépendant de celui de l'estimateur.

## API

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/api/prices` | public | Lit les prix |
| `PUT` | `/api/prices` | admin | Enregistre les prix (header `X-Admin-Password`) |
| `POST` | `/api/prices/reset` | admin | Remet les tarifs d'origine |
| `POST` | `/api/login` | public | Vérifie le mot de passe |

Le serveur valide chaque prix : nombre positif, minimum ≤ maximum, maximum ≤ 10 000 $/sqft. L'écriture de `prices.json` est atomique (fichier temporaire puis renommage).

## Mise en ligne / réseau local

- Pour rendre le site accessible depuis les autres appareils du réseau, mettre `"host": "0.0.0.0"` dans `config.json`, puis ouvrir `http://IP-DU-PC:3000/`.
- En production, placez le serveur derrière HTTPS (reverse proxy) et changez impérativement le mot de passe.
- Sauvegardez régulièrement `prices.json` : c'est la seule donnée à conserver.
- Si l'API est indisponible, l'estimateur utilise ses tarifs par défaut intégrés (mais l'admin ne peut pas enregistrer).

## Remarque

La capture de lead de l'estimateur est inchangée : le formulaire valide les informations et affiche l'estimation, mais le payload est seulement affiché dans la console du navigateur (aucun webhook n'est appelé). Voir `logLeadPayload()` dans `public/index.html` pour brancher un webhook si besoin.
