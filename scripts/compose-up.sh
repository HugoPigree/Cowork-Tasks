#!/usr/bin/env sh
# Raccourci : identique à `docker compose` (plus besoin de .env pour un lancement local).
exec docker compose "$@"
