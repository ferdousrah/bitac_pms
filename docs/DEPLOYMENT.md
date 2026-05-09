# Deploying BITAC PMS on a VPS with Coolify

This guide walks through deploying the project as a Docker app on a self-hosted Coolify instance. Everything you need is in this repo: a multi-stage `Dockerfile`, Apache vhost, PHP overrides, and an entrypoint that runs migrations and primes caches.

---

## 1. Prerequisites

- A VPS with Coolify already installed and reachable on its dashboard URL.
- A domain (or subdomain) pointed at the VPS — e.g. `pms.yourdomain.com`.
- This repo pushed to a Git provider (GitHub / GitLab / self-hosted Gitea).

---

## 2. Create the MySQL service in Coolify

1. **Resources → New → Database → MySQL 8**
2. Set:
   - **Name:** `bitac-pms-mysql`
   - **Database:** `bitac_pms`
   - **Username:** `bitac`
   - **Password:** generate a strong one — copy it, you'll need it.
3. Deploy the database. Note the internal hostname Coolify gives you (usually the service name, e.g. `bitac-pms-mysql` or just `mysql` depending on your setup).
4. Make sure the **MySQL persistent volume** is enabled (Coolify defaults to one — confirm it's listed under "Storage").

---

## 3. Create the application

1. **Resources → New → Application → Public Repository** (or Private with deploy key).
2. Paste the repo URL, pick the branch you want to deploy from (e.g. `main`).
3. **Build Pack:** select **Dockerfile**. Coolify will auto-detect the `Dockerfile` at the repo root.
4. **Port:** `80` (the container exposes Apache on 80; Coolify's reverse proxy will TLS-terminate in front).
5. Save.

---

## 4. Environment variables

In **Application → Environment Variables**, paste the contents of `.env.production.example` and fill in real values. Critical ones:

| Key | Value |
|---|---|
| `APP_KEY` | leave empty on first deploy — entrypoint generates one. **After first boot, copy the value from the container and set it here so future redeploys reuse the same key.** |
| `APP_URL` | `https://pms.yourdomain.com` |
| `APP_DEBUG` | `false` |
| `DB_HOST` | the MySQL service hostname Coolify shows (e.g. `bitac-pms-mysql`) |
| `DB_DATABASE` | `bitac_pms` |
| `DB_USERNAME` | `bitac` |
| `DB_PASSWORD` | the password you set in Step 2 |
| `GEMINI_API_KEY` | optional — only needed if AI features are turned on |

> **About `APP_KEY`:** Laravel uses it to encrypt sessions and cookies. If it changes between deploys, every user is logged out and existing encrypted columns become unreadable. Generate it once, then keep it.
>
> To generate manually: `docker exec -it <container> php artisan key:generate --show` then paste the result back into Coolify's env vars.

---

## 5. Persistent storage (critical — uploads must survive redeploys)

In **Application → Storages**, add **two persistent volume mounts**:

| Mount path inside the container | Purpose |
|---|---|
| `/var/www/html/storage/app/public` | All user uploads — drawings, sample photos, quotation files, chatbot images, RFQ attachments |
| `/var/www/html/storage/logs` | Laravel logs (optional but recommended for debugging) |

Without these, every redeploy will wipe uploaded files. Coolify will create matching directories on the host and bind-mount them into the container.

> **Bootstrap cache and framework cache are NOT mounted** — they get rebuilt on every boot by the entrypoint script.

---

## 6. Domain + HTTPS

1. **Application → Domains → Add domain** → `pms.yourdomain.com`.
2. Coolify auto-issues a Let's Encrypt cert if your DNS is pointed at the VPS.
3. Make sure **Force HTTPS** is enabled.

The Apache vhost shipped in this repo already honours `X-Forwarded-Proto` from the reverse proxy, so Laravel sees HTTPS correctly.

---

## 7. Deploy

Hit **Deploy**. Watch the build log:

1. Stage 1 — Node 20 builds the React/TS bundle via Vite.
2. Stage 2 — Composer installs PHP deps (no dev).
3. Stage 3 — PHP 8.2 + Apache + LibreOffice runtime is assembled.
4. Container starts → entrypoint waits for MySQL → runs migrations → primes caches → Apache serves on port 80.

First boot takes a few minutes (LibreOffice install ~500 MB). Subsequent rebuilds use Docker's layer cache and finish in well under a minute for code-only changes.

---

## 8. First-time setup (one-time, after first deploy)

Open Coolify → Application → **Terminal** to run these against the live container:

```bash
# Seed the database (default users, roles, permissions, materials, operations, etc.)
php artisan db:seed --force

# Verify the storage symlink exists
ls -l public/storage

# Optional: create the first super-admin manually if seeders don't include one
php artisan tinker
>>> \App\Models\User::create([
...     'name' => 'Admin',
...     'email' => 'admin@yourdomain.com',
...     'password' => 'change-me',
... ])->assignRole('super_admin');
```

> Default seeded users / customers all use password `password` — **change them immediately** in production.

---

## 9. Optional — scheduler & queue

If you decide to use scheduled commands (e.g. quotation follow-up reminders):

- **Scheduler:** Coolify lets you run a cron-style command. Add:
  ```
  * * * * * cd /var/www/html && php artisan schedule:run >> /dev/null 2>&1
  ```
  Or add a separate "Service" in Coolify that runs `php artisan schedule:work` continuously.

- **Queue worker:** if you switch `QUEUE_CONNECTION` from `sync` to `database`, add another service running:
  ```
  php artisan queue:work --tries=3 --backoff=10
  ```
  with auto-restart enabled.

---

## 10. Health checks

In **Application → Health Check**:

- **Path:** `/login`
- **Expected status:** `200`
- **Interval:** 30s

This catches the case where MySQL is up but Laravel hasn't finished migrating yet.

---

## 11. Updating the app

Push a commit to the deploy branch → Coolify auto-builds and redeploys (if auto-deploy is on). The entrypoint re-runs migrations on each boot, so schema changes apply automatically.

For breaking config changes:

```bash
# Inside Coolify terminal
php artisan config:clear
php artisan cache:clear
```

---

## 12. Common gotchas

| Symptom | Fix |
|---|---|
| **502 / "AppKey is missing"** | `APP_KEY` not set in env. Run `php artisan key:generate --show` once and paste back into Coolify. |
| **All users logged out after redeploy** | `APP_KEY` changed (e.g. left blank). Pin a single value in env vars. |
| **PDF preview shows garbled text** | DomPDF font cache wasn't preserved. Already handled by entrypoint, but if you see it: `rm -rf storage/fonts/*.json` and reload. |
| **Uploads disappear after redeploy** | Persistent volume mount missing for `/var/www/html/storage/app/public`. See Step 5. |
| **"Permission denied" on storage** | Entrypoint chowns to `www-data` on every boot — if it still fails, check the host volume's owner: `chown -R 33:33 <host-path>`. |
| **MySQL connection refused on first boot** | Entrypoint polls for 30s. If the DB takes longer, raise the `for i in $(seq 1 30)` loop in `docker/entrypoint.sh`. |
| **"Mixed content" / HTTPS asset errors** | `APP_URL` must use `https://` AND Coolify's "Force HTTPS" toggle must be on. |
| **DWG previews fail** | Verify LibreOffice is installed in the container: `which soffice` should print a path. |
| **Build fails on `npm ci`** | Ensure `package-lock.json` is committed. If you only have `package.json`, change `npm ci` to `npm install` in the Dockerfile. |

---

## 13. Backup checklist

Before any major upgrade:

1. **Database:** `docker exec <mysql-container> mysqldump -u bitac -p bitac_pms > backup-$(date +%F).sql`
2. **Uploads:** `tar -czf uploads-$(date +%F).tar.gz <path-to-storage-volume>`
3. **Env vars:** export Coolify env via the dashboard (it's also stored in Coolify's own DB — back that up too).

---

## File layout for deployment (already in this repo)

```
.
├── Dockerfile                   ← multi-stage build
├── .dockerignore
├── .env.production.example      ← template for Coolify env vars
└── docker/
    ├── apache-vhost.conf        ← Apache vhost pointing at public/
    ├── php.ini                  ← upload limits, OPcache tuning, timezone
    └── entrypoint.sh            ← migrations + storage:link + caches
```

You don't need to write anything else — push the repo, point Coolify at it, deploy.
