"""
Django settings for the Task Manager API project.

Sensitive values are loaded from environment variables via python-decouple.
Never commit a real `.env` file; use `.env.example` as a template.
"""
import os
from pathlib import Path

from decouple import Csv, config
from datetime import timedelta
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Use in-memory SQLite when running the automated test suite (set by conftest).
_USE_SQLITE_TESTS = os.environ.get("USE_SQLITE_FOR_TESTS") == "1"

# SECURITY WARNING: keep the secret key used in production secret!
# Override in `.env` for any shared or production deployment.
SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-change-me-in-production",
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config("DEBUG", default="false" if not _USE_SQLITE_TESTS else "true", cast=bool)

ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="127.0.0.1,localhost",
    cast=Csv(),
)

# Reject Django's documented insecure default when not in debug (tests use DEBUG=True).
if not DEBUG and SECRET_KEY == "django-insecure-change-me-in-production":
    raise ImproperlyConfigured(
        "Set a unique SECRET_KEY in the environment for production (see .env.example)."
    )

# Custom user model lives in the `core` app.
AUTH_USER_MODEL = "core.User"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # Local apps
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database — PostgreSQL in Docker/production; SQLite optional for local dev without DB.
if _USE_SQLITE_TESTS:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
else:
    # PostgreSQL when `DB_NAME` is set (Docker / production). Otherwise SQLite file for local dev without a server.
    _db_name = config("DB_NAME", default="")
    if _db_name:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": _db_name,
                "USER": config("DB_USER"),
                "PASSWORD": config("DB_PASSWORD"),
                "HOST": config("DB_HOST", default="localhost"),
                "PORT": config("DB_PORT", default="5432"),
            }
        }
    else:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3",
            }
        }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# WhiteNoise: compressed static assets (run `collectstatic` in the image build or before deploy).
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Production hardening (when DEBUG=False) ---
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

    if config("DJANGO_TRUST_X_FORWARDED_PROTO", default="false", cast=bool):
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
        USE_X_FORWARDED_HOST = True

    if config("DJANGO_SECURE_SSL_REDIRECT", default="false", cast=bool):
        SECURE_SSL_REDIRECT = True

    _hsts = config("DJANGO_SECURE_HSTS_SECONDS", default=0, cast=int)
    if _hsts > 0:
        SECURE_HSTS_SECONDS = _hsts
        SECURE_HSTS_INCLUDE_SUBDOMAINS = config(
            "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", default="true", cast=bool
        )
        SECURE_HSTS_PRELOAD = config(
            "DJANGO_SECURE_HSTS_PRELOAD", default="false", cast=bool
        )

    if config("DJANGO_SESSION_COOKIE_SECURE", default="false", cast=bool):
        SESSION_COOKIE_SECURE = True
        CSRF_COOKIE_SECURE = True

# Origins for CSRF (Django admin / forms behind HTTPS). Comma-separated full URLs.
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())
    if o.strip()
]

# Optional: serve user uploads through Gunicorn (OK for small setups; use nginx + volume at scale).
SERVE_MEDIA_THROUGH_DJANGO = config(
    "DJANGO_SERVE_MEDIA", default="false", cast=bool
)

# --- Django REST framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": config("API_PAGE_SIZE", default=10, cast=int),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

# --- Simple JWT ---
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_MINUTES", default=60, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- CORS (SPA / Vite dev server) ---
# In dev, Vite can proxy `/api` so CORS is optional; enable for direct API calls or preview.
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://127.0.0.1:5173,http://localhost:5173",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True
