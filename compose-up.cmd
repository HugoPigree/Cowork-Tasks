@echo off
REM Raccourci Windows : identique à `docker compose` (plus besoin de .env pour un lancement local).
docker compose %*
exit /b %ERRORLEVEL%
