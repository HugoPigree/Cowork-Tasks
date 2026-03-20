"""
Pytest root conftest (optional hooks). Test DB is configured via `config.settings_test`.
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_test")


def pytest_configure(config):
    os.environ["USE_SQLITE_FOR_TESTS"] = "1"
