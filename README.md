# BITAC PMS — Production Management System

Bangladesh Industrial Technical Assistance Centre  
Laravel 12 + Inertia.js + React + TypeScript + TailwindCSS

---

## Requirements

| Component | Version |
|-----------|---------|
| PHP | 8.2+ |
| MySQL | 5.7+ / 8.0+ |
| Node.js | 18+ |
| Composer | 2.x |

---

## Quick Deploy (Shared / VPS Hosting)

### 1. Upload Files

Upload all files **except** `node_modules/` and `.env` to your server via FTP.  
Point your domain's document root to the `/public` directory.

### 2. Create `.env`

Copy `.env.example` to `.env` and fill in your values:

```env
APP_NAME="BITAC PMS"
APP_ENV=production
APP_KEY=                  # will be generated in step 4
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=bitac_pms
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=database
BROADCAST_CONNECTION=null
FILESYSTEM_DISK=public

VAT_RATE=15

# Optional — leave blank to disable WebSocket push
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=ap2
VITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
VITE_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"
```

### 3. Install PHP Dependencies

```bash
composer install --optimize-autoloader --no-dev
```

### 4. Bootstrap Application

```bash
php artisan key:generate
php artisan migrate --seed --force
php artisan storage:link
```

> **Alternative**: Import `database/exports/bitac_pms.sql` directly into MySQL  
> instead of running migrate --seed, for the exact demo dataset.

### 5. Build Frontend (if not pre-built)

```bash
npm install --legacy-peer-deps
npm run build
```

> The `public/build/` directory is pre-built and included. Skip this step if deploying  
> the compiled assets directly.

### 6. Set Permissions (Linux/VPS)

```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### 7. Configure Web Server

**Apache** — add to `.htaccess` in project root or set `DocumentRoot` to `/public`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

**Nginx**:

```nginx
root /var/www/bitac_pms/public;
index index.php;
location / { try_files $uri $uri/ /index.php?$query_string; }
location ~ \.php$ { fastcgi_pass unix:/run/php/php8.2-fpm.sock; include fastcgi_params; fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name; }
```

---

## Default Login Credentials

### Staff Portal (`/login`)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@bitac.gov.bd | password |
| Production Supervisor | supervisor@bitac.gov.bd | password |
| Operator | operator@bitac.gov.bd | password |
| QC Inspector | qc@bitac.gov.bd | password |
| Accounts | accounts@bitac.gov.bd | password |
| Management | management@bitac.gov.bd | password |

### Customer Portal (`/customer/login`)

| Organisation | Email | Password |
|-------------|-------|----------|
| Bangladesh Railway | railway@br.gov.bd | password |
| BPDB | procurement@bpdb.gov.bd | password |
| Bangladesh Shipyard | supply@bsc.gov.bd | password |

---

## Key URLs

| URL | Description |
|-----|-------------|
| `/` | Redirects to dashboard |
| `/dashboard` | Main KPI dashboard |
| `/dashboard/live` | Full-screen live dashboard (dark UI) |
| `/work-orders` | Work order list |
| `/wip` | Live WIP board |
| `/shop-floor` | Shop floor terminal |
| `/qc` | QC inspections |
| `/delivery` | Delivery orders |
| `/invoices` | Invoices |
| `/reports/production` | Production report |
| `/reports/oee` | OEE report |
| `/customer/login` | Customer portal login |
| `/admin/users` | User management |
| `/admin/audit-log` | Audit trail |

---

## Optional: Enable WebSocket Push (Pusher)

1. Create a free account at pusher.com
2. Create a new Channels app (cluster: `ap2` for Asia)
3. Fill `PUSHER_*` and `VITE_PUSHER_*` values in `.env`
4. Change `BROADCAST_CONNECTION=pusher`
5. Run `npm run build` to rebuild with your Pusher key

Without Pusher, the Live Dashboard and WIP Board still work via  
**30-second Inertia partial reloads** (polling fallback).

---

## Queue Worker (Optional)

For background jobs (PDF generation, notifications):

```bash
php artisan queue:work --queue=default --tries=3 --daemon
```

For shared hosting without process managers, add a cron job:

```
* * * * * cd /path/to/bitac_pms && php artisan schedule:run >> /dev/null 2>&1
```

---

## Timezone & Currency

- Timezone: `Asia/Dhaka` (UTC+6)
- Currency: Bangladeshi Taka (BDT)
- Number format: Bangladesh lakh system (1,00,000 = 1 lakh)
- VAT: 15% (configurable via `VAT_RATE` env variable)

---

## Architecture

```
Laravel 12 (PHP 8.2)
  Inertia.js v3          <- Server-side routing
  React 18 + TypeScript  <- Frontend pages
  TailwindCSS            <- Styling
  Vite 7                 <- Asset bundling
  Spatie Permission      <- RBAC (10 roles, 40+ permissions)
  DomPDF                 <- PDF generation
  simple-qrcode          <- QR codes on operation sheets
  Recharts + dnd-kit     <- Charts & drag-and-drop
```

---

*BITAC PMS — Built for Bangladesh Industrial Technical Assistance Centre, Tejgaon Industrial Area, Dhaka-1208*
