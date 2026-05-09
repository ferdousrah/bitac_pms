# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build frontend assets with Vite
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app

# Install only what's needed for the asset build
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest and build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Composer install (no dev deps for production)
# ─────────────────────────────────────────────────────────────────────────────
FROM composer:2 AS vendor
WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist \
    --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — Runtime: PHP 8.2 + Apache + LibreOffice (for DWG/Office conversions)
# ─────────────────────────────────────────────────────────────────────────────
FROM php:8.2-apache

# System packages: image libs, zip, ICU, MySQL client, LibreOffice headless
RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev \
        libonig-dev \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libwebp-dev \
        libxml2-dev \
        libcurl4-openssl-dev \
        libssl-dev \
        zip unzip git curl ca-certificates \
        default-mysql-client \
        libreoffice \
    && rm -rf /var/lib/apt/lists/*

# PHP extensions required by Laravel + this project
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
 && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mbstring \
        intl \
        zip \
        gd \
        bcmath \
        opcache \
        xml \
        exif

# Apache modules + custom vhost
RUN a2enmod rewrite headers expires
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php.ini            /usr/local/etc/php/conf.d/zz-app.ini

# Composer for any post-deploy work (artisan tinker, etc.)
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# App code (vendor + built assets pulled from previous stages)
COPY --from=vendor   /app                   /var/www/html
COPY --from=frontend /app/public/build      /var/www/html/public/build

# Entrypoint runs migrations, storage:link, caches
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Permissions for storage + bootstrap cache (writable by Apache user)
RUN chown -R www-data:www-data \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache \
 && find /var/www/html/storage -type d -exec chmod 775 {} \; \
 && find /var/www/html/bootstrap/cache -type d -exec chmod 775 {} \;

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["apache2-foreground"]
