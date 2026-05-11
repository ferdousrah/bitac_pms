#!/usr/bin/env bash
# Boots the BITAC PMS container: prepares storage, runs migrations, primes caches,
# then hands off to Apache.
set -euo pipefail

cd /var/www/html

echo "==> [BITAC PMS] Boot starting..."

# Required APP_KEY for Laravel encryption. Coolify should set this once and reuse.
if [ -z "${APP_KEY:-}" ]; then
    echo "==> APP_KEY not set; generating one (one-time only)."
    php artisan key:generate --force --no-interaction || true
fi

# Wait briefly for the database to be reachable. Coolify usually starts MySQL first
# but we still poll up to ~30s in case the DB container isn't ready yet.
if [ -n "${DB_HOST:-}" ]; then
    echo "==> Waiting for database at ${DB_HOST}:${DB_PORT:-3306}..."
    for i in $(seq 1 30); do
        if mysqladmin ping -h "${DB_HOST}" -P "${DB_PORT:-3306}" -u "${DB_USERNAME:-root}" -p"${DB_PASSWORD:-}" --silent > /dev/null 2>&1; then
            echo "==> Database is ready."
            break
        fi
        sleep 1
    done
fi

# Ensure runtime directories exist
mkdir -p \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/framework/mpdf \
    storage/fonts \
    storage/logs \
    bootstrap/cache

# Public storage symlink (idempotent)
if [ ! -L public/storage ]; then
    php artisan storage:link --no-interaction || true
fi

# Run migrations on every boot. Safe because migrations are idempotent
# and Laravel skips already-applied ones.
echo "==> Running migrations..."
php artisan migrate --force --no-interaction

# Drop stale caches then rebuild for production performance.
# All these run as root (the entrypoint user), which is fine — we re-chown below.
echo "==> Rebuilding caches..."
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache 2>/dev/null || true

# Final ownership/permission pass MUST come AFTER artisan commands so the
# cache files written by root (config.php, routes-v7.php, etc.) and any
# auto-created cache subdirs are owned by Apache's www-data user.
echo "==> Fixing ownership for Apache..."
chown -R www-data:www-data storage bootstrap/cache
find storage         -type d -exec chmod 775 {} \;
find storage         -type f -exec chmod 664 {} \;
find bootstrap/cache -type d -exec chmod 775 {} \;
find bootstrap/cache -type f -exec chmod 664 {} \;

echo "==> Boot done. Handing off to Apache."
exec "$@"
