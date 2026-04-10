# Treasure Hunt — Management Dashboard

A fully production-ready Next.js 14 dashboard for managing Treasure Hunt survey data. Built on a single Supabase project that handles both authentication (GoTrue) and all application data, with role-based access control, audit logging, and signup approval workflows.

---

## Architecture

```
┌────────────────────────────────┐
│         SUPABASE               │
│                                │
│  auth.users (GoTrue)           │
│  profiles (role, status, etc.) │
│  survey_responses              │
│  audit_log                     │
│  rate_limit_log                │
│                                │
│  Secret key  → server-side     │
│  Publishable → browser (auth)  │
└───────────────┬────────────────┘
                │
      ┌─────────▼──────────┐
      │    NEXT.JS APP      │
      │                     │
      │  Middleware          │
      │   ├ CSRF protection │
      │   ├ Session IDs     │
      │   ├ Security headers│
      │   └ Route guards    │
      │                     │
      │  API Routes         │
      │   └ requireRole()   │
      │                     │
      │  Dashboard UI       │
      └─────────────────────┘
```

## Roles

| Role   | Level | Permissions                                         |
|--------|-------|-----------------------------------------------------|
| Owner  | 100   | Everything — manage all users/roles, delete, config |
| Admin  | 80    | Edit/delete data, approve/reject signups, audit     |
| Editor | 50    | Edit data, flag/unflag entries                      |
| Viewer | 10    | Read-only access to survey responses                |

Owners can assign any role. Admins can only manage editors and viewers.
No one can modify users at or above their own role level (except owners).

---

## Setup

### 1. Set up Supabase

Open **Supabase → SQL Editor → New Query** and paste the contents of `auth_supabase_setup.sql`. This creates:
- `profiles` table with auto-create trigger on signup
- `survey_responses`, `audit_log`, `rate_limit_log` tables
- RLS policies, indexes, constraints, and helper functions

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in all values from **Project Settings → API → Publishable and secret API keys**:

| Variable | Where it's used |
|---|---|
| `SUPABASE_URL` | Server-side (API routes, middleware) |
| `SUPABASE_SECRET_KEY` | Server-side only — bypasses RLS for admin operations |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side SSR client (cookie-based auth) |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser — same value as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser — login/signup only |
| `ALLOWED_DOMAIN` | Domain lock — comma-separated hostnames (e.g. `localhost,your-project.vercel.app`); omit to allow all hosts |

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Create the first Owner

1. Go to `/signup` and create an account.
2. Confirm your email (check inbox, or disable email confirmation in Supabase → Auth → Settings).
3. In **Supabase → SQL Editor**, run:

```sql
UPDATE public.profiles SET role = 'owner', status = 'approved' WHERE email = 'your@email.com';
```

You now have full owner access and can approve/promote other users from the dashboard.

---

## Hosting

### Vercel (recommended)

The simplest and best-supported option for Next.js apps.

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Add all environment variables in **Settings → Environment Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `ALLOWED_DOMAIN` — e.g. `localhost,127.0.0.1,your-project.vercel.app` (comma-separated; include localhost for local dev)
4. Deploy. Vercel auto-detects Next.js and configures the build.

Production URL will be `https://your-project.vercel.app`. Add a custom domain in **Settings → Domains**.

**Post-deploy checklist for Vercel:**
- Verify all environment variables are set (missing vars will cause 500s on API routes)
- Update **Supabase → Auth → URL Configuration → Site URL** to your production URL (e.g. `https://your-project.vercel.app`)
- Add your production URL to **Supabase → Auth → URL Configuration → Redirect URLs**
- Test signup → email confirmation → login → dashboard flow end-to-end

### Netlify

1. Push the repo to GitHub.
2. Go to [netlify.com](https://netlify.com) and import the repository.
3. Set build command to `npm run build` and publish directory to `.next`.
4. Install the **Next.js Runtime** plugin (Netlify auto-suggests it).
5. Add all five environment variables in **Site settings → Environment variables**.
6. Deploy.

### Self-hosted (VPS)

```bash
# Install dependencies
npm ci --production=false

# Build for production
npm run build

# Start production server (default port 3000)
npm start

# Or specify a port
PORT=8080 npm start
```

For production, run behind a reverse proxy (Nginx, Caddy) with HTTPS.

**Nginx example:**

```nginx
server {
    listen 80;
    server_name dashboard.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Use **PM2** as a process manager:

```bash
npm install -g pm2
pm2 start npm --name "treasure-hunt" -- start
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t treasure-hunt .
docker run -d -p 3000:3000 --env-file .env.local --name treasure-hunt treasure-hunt
```

**Docker Compose** (with auto-restart):

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped
```

---

## Production Checklist

Before going live, verify every item:

### Supabase

- [ ] Run `auth_supabase_setup.sql` and `migration_approval_audit.sql` in SQL Editor
- [ ] RLS is enabled on all tables (`profiles`, `survey_responses`, `audit_log`, `rate_limit_log`)
- [ ] First owner account is created and has `role = 'owner'`, `status = 'approved'`
- [ ] **Auth → URL Configuration → Site URL** is set to your production URL
- [ ] **Auth → URL Configuration → Redirect URLs** includes your production URL
- [ ] **API Settings → Custom CORS** allowed origins set to your production URL only
- [ ] Email confirmation is configured (or intentionally disabled for internal use)
- [ ] Email templates are reviewed (Supabase → Auth → Email Templates)

### Environment

- [ ] All six environment variables are set in production (including `ALLOWED_DOMAIN`)
- [ ] `ALLOWED_DOMAIN` lists production hostname(s) and, if you use the lock locally, `localhost` / `127.0.0.1`
- [ ] `SUPABASE_SECRET_KEY` is **not** exposed to the browser (no `NEXT_PUBLIC_` prefix)
- [ ] `.env.local` is in `.gitignore` and not committed to the repository

### Security

- [ ] HTTPS is enforced (redirect HTTP → HTTPS)
- [ ] Domain lock is active — middleware rejects requests from unauthorized hosts/origins
- [ ] Cookies are set with `secure: true` in production (handled automatically by middleware)
- [ ] Supabase CORS is restricted to your production domain only
- [ ] Rate limiting is active on password change and email check endpoints

### Build & Deploy

- [ ] `npm run build` completes with zero errors
- [ ] Test all critical flows: signup → approval → login → view data → edit → audit log
- [ ] Test role escalation protections (viewer cannot access admin routes, etc.)
- [ ] Verify 401/403 responses for unauthenticated and unauthorized requests

---

## Project Structure

```
treasure-hunt-dashboard/
├── app/
│   ├── globals.css              # Tailwind + custom styles
│   ├── layout.js                # Root layout
│   ├── login/page.js            # Login (GoTrue)
│   ├── signup/page.js           # Signup with availability checks
│   ├── api/
│   │   ├── auth/
│   │   │   ├── me/route.js              # GET current user + role
│   │   │   ├── logout/route.js          # POST sign out
│   │   │   ├── change-password/route.js # POST change own password
│   │   │   ├── reset-user-password/     # POST owner resets another user's password
│   │   │   └── check-availability/      # GET check email/name uniqueness
│   │   ├── responses/
│   │   │   ├── route.js         # GET/PATCH/DELETE survey data
│   │   │   └── stats/route.js   # GET dashboard stats
│   │   ├── audit/route.js       # GET audit log
│   │   └── users/
│   │       ├── route.js         # GET/PATCH/DELETE user management
│   │       └── requests/route.js# GET/PATCH signup approval queue
│   └── dashboard/
│       ├── layout.js            # Auth guard + sidebar layout
│       ├── dashboard-client.js  # User context provider
│       ├── pending-approval.js  # Pending state screen
│       ├── page.js              # Responses (main view)
│       ├── audit/page.js        # Audit log
│       ├── requests/page.js     # Signup request management
│       ├── users/page.js        # User/role management
│       └── settings/page.js     # Settings & password change
├── components/
│   ├── icons.js                 # SVG icon components
│   ├── sidebar.js               # Navigation sidebar
│   └── skeleton.js              # Loading skeleton components
├── lib/
│   ├── api-client.js            # Client-side fetch wrapper (CSRF + 401 handling)
│   ├── audit.js                 # Audit log helper
│   ├── roles.js                 # Role definitions + permission checks
│   ├── session.js               # getSessionUser() + requireRole()
│   ├── supabase-data.js         # Data client (secret key, server-side)
│   ├── supabase-auth-admin.js   # Admin client (secret key, server-side)
│   ├── supabase-auth-browser.js # Browser client (publishable key)
│   └── supabase-auth-server.js  # SSR client (publishable key)
├── auth_supabase_setup.sql      # Full database setup — run in Supabase SQL Editor
├── migration_approval_audit.sql # Approval workflow migration
├── middleware.js                 # CSRF, session IDs, security headers, route guards
├── .env.local.example           # Environment template
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── package.json
```

## Security

**Domain lock** — When `ALLOWED_DOMAIN` is set, the middleware rejects requests whose `Host`, `Origin`, or `Referer` hostname is not in the comma-separated list (ports are ignored). Add `localhost` and `127.0.0.1` to the same variable for local dev, or omit `ALLOWED_DOMAIN` entirely to disable the lock.

**CSRF protection** — Middleware generates a `_csrf` cookie on first visit. All state-changing API requests (POST/PATCH/DELETE) must include a matching `x-csrf-token` header. The `apiFetch` client wrapper handles this automatically.

**Session IDs** — A unique `_sid` cookie (httpOnly, SameSite=Strict) is generated per authenticated session. API routes require it — requests without a valid session ID are rejected.

**Server-side validation on every request** — Every API call runs `supabase.auth.getUser()` which validates the JWT with Supabase's server. No request is trusted based on client state alone.

**Input hardening** — Search queries are sanitized against PostgREST filter injection, query limits are bounded, request bodies are validated (UUID format, role allowlists, integer IDs), and malformed JSON is caught.

**Rate limiting** — Password change attempts are capped at 5 per 15 minutes per user. Email/name availability checks are capped at 20 per minute per IP.

**Security headers** — All responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`.

**RLS** — Row Level Security is enabled on all tables. Data tables (`survey_responses`, `audit_log`, `rate_limit_log`) deny all access to `anon` and `authenticated` roles — only the `service_role` (secret key) can access them, and that key never leaves the server.
