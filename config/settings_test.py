"""
Django settings for the automated test suite.

Loaded only when `DJANGO_SETTINGS_MODULE=config.settings_test` (see `pytest.ini`).
Forces SQLite in-memory so tests never depend on PostgreSQL or `.env` credentials.
"""
import os

os.environ["USE_SQLITE_FOR_TESTS"] = "1"

from config.settings import *  # noqa: F403, E402
