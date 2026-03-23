# Guide — Lancer Cowork-Tasks

## Une seule commande (recommandé)

À la **racine du dépôt** (où se trouve `docker-compose.yml`), avec **Docker Desktop** démarré :

```bash
docker compose up --build -d
```

C’est tout : **aucun fichier `.env` n’est obligatoire** en local. Les mots de passe et la `SECRET_KEY` par défaut sont dans `docker-compose.yml` (**réservé au dev local**, pas à la production).

| URL | Rôle |
|-----|------|
| **http://localhost:8080** | Interface (nginx + SPA) |
| **http://localhost:8000** | API Django |

Ensuite : **inscription** sur le site, puis utilisation normale (espaces, tâches).  
Si tu vois *« Aucun espace »* avec un navigateur qui garde d’anciennes sessions : **Gérer les espaces** → créer un espace, ou vider le stockage local pour `localhost`.

### Arrêter

```bash
docker compose down
```

Tout effacer (y compris la base) :

```bash
docker compose down -v
```

---

## Windows : raccourci

```bat
compose-up.cmd up --build -d
```

Équivalent à `docker compose …`.

---

## Production (avec Traefik)

Pour un **déploiement réel** avec Traefik (HTTPS, noms de domaine), utilisez le fichier de surcharge dédié :

```bash
# 1. Créer le réseau externe si besoin
docker network create web

# 2. Lancer avec les deux fichiers
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Pensez également à copier **`.env.example`** vers **`.env`** et à renseigne au minimum **`SECRET_KEY`**, **`DB_PASSWORD`** et **`DOMAIN`**. Docker Compose lit le `.env` à la racine pour **substituer** les variables.

---

## Front en mode HMR (optionnel)

En plus du build nginx sur le port 8080 :

```bash
docker compose --profile dev up --build
```

Ouvre **http://localhost:5173** pour Vite avec rechargement à chaud.

---

## Dépannage

| Problème | Piste |
|----------|--------|
| Port déjà pris | Change `APP_PORT` / `8000` via un `.env` ou arrête l’autre service. |
| Pas de page sur 8080 | `docker compose ps` — les services **`cowork_frontend`** et **`cowork_backend`** doivent être *running* / *healthy*. |
| API en erreur | Teste `http://localhost:8000/api/health/`. |

Plus de détails : **`README.md`** (section *Quick start (Docker)*).
