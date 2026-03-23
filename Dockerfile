# Production-oriented image: DEBUG must not be enabled in containers.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Enforce non-debug mode for container runs (override via compose only if you know the risk).
ENV DEBUG=False

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static for WhiteNoise (SECRET_KEY only needed for Django settings import).
ENV SECRET_KEY=collectstatic-build-placeholder-not-used-at-runtime
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Timeouts and logs suitable for production behind a reverse proxy
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]
