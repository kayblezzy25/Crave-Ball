# Crave Ball — Telegram Bot (Supabase + Railway)

A Telegram bot whose startup image, startup message, and inline buttons are
fully managed by an administrator **from inside Telegram** — no code edits,
no redeploys, no restarts. Configuration lives in Supabase; Railway only
runs the Node.js process.

## Architecture

```
Telegram → Railway (Node.js/Telegraf, HTTPS webhook) → Supabase client (service role)
                                                          ├── Postgres        (bot_settings, admins)
                                                          └── Supabase Storage (startup image)
```

- **Telegram** is the interface for both regular users (`/start`) and the
  administrator (`/admin`).
- **Railway** runs the stateless Node.js/TypeScript process and receives
  Telegram updates via an HTTPS webhook (`POST /telegram/webhook`). It holds
  no persistent bot data.
- **Postgres (Supabase)** stores the active startup message, the active
  image reference, inline buttons, and the admin allowlist.
- **Supabase Storage** stores the actual startup image file
  (`startup/current-image.jpg` inside your bucket).
- The **Supabase service-role client** is the only thing that talks to
  Supabase; it runs server-side inside the Railway process using a service
  role key from environment variables. The service role key bypasses Row
  Level Security — the same trust model as a privileged Firebase Admin SDK
  server — so authorization is enforced in the Node.js app itself (see
  "Security notes"), never left to database policies.

> This project originally targeted Firebase (Firestore + Cloud Storage) but
> moved to Supabase because Firebase now requires the paid Blaze plan to
> enable Cloud Storage. Supabase's free tier includes both Postgres and
> Storage with no card required.

## Project structure

```
src/
├── bot/
│   ├── commands/     /start, /admin
│   ├── handlers/     photo uploads, text input, inline button callbacks
│   ├── keyboards/    inline keyboard layouts
│   ├── session.ts    in-memory "what is the admin doing right now" state
│   └── index.ts      wires the Telegraf bot together
├── supabase/         Supabase client init, table refs, Storage upload
├── services/         business logic (botSettings, imageService, adminService)
├── config/           environment variable loading + validation
├── server/           HTTP server: webhook route + /health
└── index.ts          entrypoint
supabase/
└── schema.sql        run once in the Supabase SQL editor
```

## Database structure

```
bot_settings (single row, id = 'general')
  ├── startup_message      text
  ├── startup_image_path   text | null   (Storage object path)
  ├── startup_image_url    text | null   (public download URL)
  ├── buttons               jsonb  [{ text, url }]
  ├── updated_at            timestamptz
  └── updated_by            bigint (Telegram user id)

admins (telegram_id primary key)
  ├── telegram_id  bigint
  ├── username     text | null
  ├── role         'admin' | 'super_admin'
  ├── active       boolean
  └── created_at   timestamptz
```

This is intentionally flat so future features (announcements, broadcasts,
maintenance mode, per-chat settings, admin roles, stats, ...) can be added
as new tables alongside these without restructuring anything that already
exists.

## Storage structure

```
<your bucket>/
└── startup/
    └── current-image.jpg   ← overwritten (upsert) on every image update
```

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
   (free tier is fine).
2. Open the **SQL Editor** and run the contents of `supabase/schema.sql`
   from this repo — it creates the `bot_settings` and `admins` tables.
3. Go to **Storage** → **New bucket**. Create a bucket (e.g. `bot-media`)
   and mark it **Public** so uploaded images are servable by URL.
4. Go to **Project Settings → API**. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY` (never the
     `anon`/public key — that one is safe for browsers, this one is not)

## 2. Create the Telegram bot

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → follow the
   prompts → copy the bot token.
2. Message [@userinfobot](https://t.me/userinfobot) (or similar) to get
   your own numeric Telegram user ID for `ADMIN_TELEGRAM_IDS`.

## 3. Configure environment variables

Copy `.env.example` to `.env` for local development, or set these
directly in Railway's **Variables** tab for deployment:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From BotFather. Never commit it. |
| `SUPABASE_URL` | Project URL from Supabase API settings. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret key. Never the anon key. Never commit it. |
| `SUPABASE_STORAGE_BUCKET` | Name of the public bucket you created, e.g. `bot-media`. |
| `ADMIN_TELEGRAM_IDS` | Comma-separated numeric Telegram user IDs. Numeric IDs only — never usernames. |
| `WEBHOOK_URL` | Public HTTPS base URL of the deployed app, e.g. `https://your-app.up.railway.app`. Leave empty locally to fall back to long polling. |
| `TELEGRAM_WEBHOOK_SECRET` | Optional random string; Telegram echoes it back on every webhook call so the endpoint can reject requests that didn't come from Telegram. |
| `PORT` | Provided automatically by Railway; defaults to `3000` locally. |

## 4. Deploy to Railway

1. Push this repository to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → select this repo.
3. Do **not** add a Railway database or volume — Supabase is the database
   and Supabase Storage holds the images.
4. Add all the environment variables from the table above in Railway's
   **Variables** tab.
5. Once deployed, set `WEBHOOK_URL` to the public URL Railway assigns
   (Settings → Networking → Generate/Copy domain), then redeploy. On
   startup the app automatically calls `setWebhook` with that URL — no
   manual webhook registration step is needed.

Railway serves the app on whatever port it assigns via `PORT`; the app
reads `process.env.PORT` and never hard-codes a port.

## 5. Using the bot

**Regular users** send `/start` and receive the current image, message,
and buttons — always pulled live from Supabase.

**Administrators** (numeric IDs in `ADMIN_TELEGRAM_IDS`) send `/admin` to
open an inline-keyboard panel:

- **🖼 Startup Image** — upload a photo; it's downloaded from Telegram,
  validated, uploaded to Supabase Storage, and the reference is saved to
  Postgres. Live immediately.
- **✏️ Startup Message** — send new text; saved to Postgres, live
  immediately.
- **🔘 Buttons** — add (`Label | https://...`) or clear inline buttons
  shown under the startup message.
- **👀 Preview** — see exactly what `/start` currently sends.
- **⚙️ Settings** — last-updated timestamp and who made the change.

None of this requires touching source code, `.env`, GitHub, or Railway.

## Security notes

- Admin authorization is by **numeric Telegram user ID only**
  (`ADMIN_TELEGRAM_IDS`), never username or display name.
- The Supabase service role key is privileged and bypasses Row Level
  Security, so all authorization happens in the Node.js server before any
  database/Storage call — this is the trusted boundary.
- `/health` returns only `{"status":"ok"}` — no tokens, keys, or admin IDs.
- Secrets are never logged (see `src/utils/logger.ts`) and never committed
  (`.gitignore` excludes `.env*`).
- Uploaded Telegram images are only ever held in memory, never written to
  Railway's filesystem, before being uploaded to Supabase Storage.

## Cost awareness

- **Supabase**: the free tier covers this workload comfortably (a couple
  of small tables, one small image file, low request volume) with no
  credit card required.
- **Railway**: Free plan includes $1/month of resource credit; new
  accounts get a one-time $5 trial credit for 30 days; the Hobby plan is
  $5/month. An always-on bot will eventually need a paid Railway plan —
  don't assume the trial credit is permanent.
- No Railway database, no Railway volume are used, keeping the footprint to
  exactly: Railway (compute) + Supabase (Postgres + Storage).

## Local development

```bash
npm install
cp .env.example .env   # fill in real values; leave WEBHOOK_URL empty
npm run dev             # long polling, no public URL needed
```

## Scripts

- `npm run dev` — run with ts-node-dev (long polling if `WEBHOOK_URL` unset)
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run the compiled build (what Railway runs)
- `npm run typecheck` — type-check without emitting
