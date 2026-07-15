# Bank of America Mobile Banking App

Mobile banking application with admin dashboard, multi-user support, and Supabase-backed storage for production.

## Run locally

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase keys (see Deploy section)
npm start
```

- **Banking app:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin

Without Supabase env vars, data falls back to `server/data/app.json` for local development.

## Logins

Customer and admin credentials are configured through the admin dashboard and environment variables. They are not shown in the app UI or stored in the frontend code.

## Admin features

- Create and manage multiple customer users
- Set any account balances shown on the dashboard
- Customize transfer error messages per user
- Edit transaction history, investments, and admin credentials

## Deploy to Vercel + Supabase

### 1. Set up Supabase

1. Open your [Supabase project](https://supabase.com/dashboard).
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`.
3. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (required for admin saves)

### 2. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Add these **Environment Variables** in Vercel project settings:

| Variable | Value |
|----------|--------|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_ANON_KEY` | Anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret key |
| `JWT_SECRET` | A long random string |

4. Deploy. Vercel will serve static pages and route `/api/*` to the serverless backend.

### 3. Open your live app

- App: `https://your-project.vercel.app`
- Admin: `https://your-project.vercel.app/admin`

**Important:** Do not open the site with Live Server (port 5501). Always use the Vercel URL or `localhost:3000` with `npm start` so the API is available.

## How storage works

| Environment | Storage |
|-------------|---------|
| Local (no Supabase env) | `server/data/app.json` |
| Local + Supabase env | Supabase `app_settings` table |
| Vercel + Supabase env | Supabase `app_settings` table |

The banking app uses Supabase Realtime (production) or SSE/polling (local) to pick up admin changes instantly.

## Security

This app includes several protections, but **no website is 100% unhackable**. Use strong passwords, keep secrets private, and change default logins after deploy.

### What is protected

| Layer | Protection |
|-------|------------|
| Authentication | JWT sessions for customers and admin (12h expiry) |
| Passwords | Bcrypt hashing at rest; passwords never returned in admin API responses |
| API access | Customer routes require valid user JWT; admin routes require admin JWT |
| Brute force | Rate limits on login endpoints (per IP) |
| Headers | CSP, HSTS, X-Frame-Options, nosniff, Permissions-Policy |
| Data storage | Supabase service role key stays server-side only |
| Production | Refuses to start without strong `JWT_SECRET` + real Supabase service key |

### What you must do

1. Set a **long random** `JWT_SECRET` (32+ characters) in Vercel and `.env`.
2. Never commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.
3. Change default admin and customer passwords after deploy.
4. Use **HTTPS only** (Vercel provides this automatically).

### Vercel hosting (frontend + API together)

**Yes — both the frontend and backend run on Vercel in one project:**

| Path | Served by |
|------|-----------|
| `index.html`, `dashboard.html`, etc. | Vercel static hosting (CDN) |
| `/admin` | Static admin dashboard |
| `/api/*` | Serverless function (`api/index.js` → Express) |

Realtime updates on Vercel use **Supabase Realtime** (not SSE — serverless instances do not keep persistent connections).

Deploy steps are unchanged: push to GitHub → import on Vercel → add env vars → deploy.

## Project structure

```
api/index.js          # Vercel serverless entry (Express API)
server/app.js         # Express app
server/database.js    # Supabase + JSON storage
admin/                # Admin dashboard
index.html            # Customer login
```
