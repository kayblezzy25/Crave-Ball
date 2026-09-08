# Crave Ball — Telegram Bot (Firebase + Railway)

A Telegram bot whose startup image, startup message, and inline buttons are
fully managed by an administrator **from inside Telegram** — no code edits,
no redeploys, no restarts. Configuration lives in Firebase; Railway only
runs the Node.js process.

## Architecture

```
Telegram → Railway (Node.js/Telegraf, HTTPS webhook) → Firebase Admin SDK
                                                          ├── Firestore   (bot_settings, admins)
                                                          └── Cloud Storage (startup image)
```

- **Telegram** is the interface for both regular users (`/start`) and the
  administrator (`/admin`).
- **Railway** runs the stateless Node.js/TypeScript process and receives
  Telegram updates via an HTTPS webhook (`POST /telegram/webhook`). It holds
  no persistent bot data.
- **Firestore** stores the active startup message, the active image
  reference, inline buttons, and the admin allowlist.
- **Cloud Storage** stores the actual startup image file
  (`bot/startup/current-image.jpg`).
- **Firebase Admin SDK** is the only thing that talks to Firebase; it runs
  server-side inside the Railway process using service-account credentials
  from environment variables. No Firebase client/web SDK is used.

Firebase Cloud Functions and Firebase Hosting are intentionally **not**
used — see "Why not Cloud Functions?" below.

## Project structure

```
src/
├── bot/
│   ├── commands/     /start, /admin
│   ├── handlers/     photo uploads, text input, inline button callbacks
│   ├── keyboards/    inline keyboard layouts
│   ├── session.ts    in-memory "what is the admin doing right now" state
│   └── index.ts      wires the Telegraf bot together
├── firebase/         Admin SDK init, Firestore refs, Storage upload
├── services/         business logic (botSettings, imageService, adminService)
├── config/           environment variable loading + validation
├── server/           HTTP server: webhook route + /health
└── index.ts          entrypoint
```

## Firestore structure

```
bot_settings/general
  ├── startup_message      string
  ├── startup_image_path   string | null   (Cloud Storage path)
  ├── startup_image_url    string | null   (public download URL)
  ├── buttons               [{ text, url }]
  ├── updated_at            timestamp
  └── updated_by            Telegram user id

admins/{telegram_id}
  ├── telegram_id  number
  ├── username     string | null
  ├── role         "admin" | "super_admin"
  ├── active       boolean
  └── created_at   timestamp
```

This is intentionally flat so future features (announcements, broadcasts,
maintenance mode, per-chat settings, admin roles, stats, ...) can be added
as new documents/collections alongside these without restructuring
anything that already exists.

## Cloud Storage structure

```
bot/
└── startup/
    └── current-image.jpg   ← overwritten on every image update
```

## 1. Create the Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com) and
   create a new project.
2. Enable **Cloud Firestore** (Native mode, any region).
3. Enable **Cloud Storage** and note the bucket name
   (e.g. `your-project.appspot.com`).
4. Go to **Project settings → Service accounts → Generate new private
   key**. This downloads a JSON file with `project_id`, `client_email`,
   and `private_key`. **Do not commit this file.** You'll copy three
   values out of it into environment variables (step 4 below) and then
   delete/secure the file.

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
| `FIREBASE_PROJECT_ID` | From the service-account JSON. |
| `FIREBASE_CLIENT_EMAIL` | From the service-account JSON. |
| `FIREBASE_PRIVATE_KEY` | From the service-account JSON, with real newlines replaced by `\n`. The app converts them back at startup. |
| `FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com`. |
| `ADMIN_TELEGRAM_IDS` | Comma-separated numeric Telegram user IDs. Numeric IDs only — never usernames. |
| `WEBHOOK_URL` | Public HTTPS base URL of the deployed app, e.g. `https://your-app.up.railway.app`. Leave empty locally to fall back to long polling. |
| `TELEGRAM_WEBHOOK_SECRET` | Optional random string; Telegram echoes it back on every webhook call so the endpoint can reject requests that didn't come from Telegram. |
| `PORT` | Provided automatically by Railway; defaults to `3000` locally. |

## 4. Deploy to Railway

1. Push this repository to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → select this repo.
3. Do **not** add a Railway database or volume — Firestore is the database
   and Cloud Storage holds the images.
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
and buttons — always pulled live from Firestore/Storage.

**Administrators** (numeric IDs in `ADMIN_TELEGRAM_IDS`) send `/admin` to
open an inline-keyboard panel:

- **🖼 Startup Image** — upload a photo; it's downloaded from Telegram,
  validated, uploaded to Cloud Storage, and the reference is saved to
  Firestore. Live immediately.
- **✏️ Startup Message** — send new text; saved to Firestore, live
  immediately.
- **🔘 Buttons** — add (`Label | https://...`) or clear inline buttons
  shown under the startup message.
- **👀 Preview** — see exactly what `/start` currently sends.
- **⚙️ Settings** — last-updated timestamp and who made the change.

None of this requires touching source code, `.env`, GitHub, or Railway.

## Security notes

- Admin authorization is by **numeric Telegram user ID only**
  (`ADMIN_TELEGRAM_IDS`), never username or display name.
- The Firebase Admin SDK is privileged and bypasses Firestore Security
  Rules, so all authorization happens in the Node.js server before any
  Firestore/Storage call — this is the trusted boundary.
- `/health` returns only `{"status":"ok"}` — no tokens, keys, or admin IDs.
- Secrets are never logged (see `src/utils/logger.ts`) and never committed
  (`.gitignore` excludes `.env*` and any service-account JSON).
- Uploaded Telegram images are only ever held in memory, never written to
  Railway's filesystem, before being uploaded to Cloud Storage.

## Cost awareness

- **Firestore + Cloud Storage**: free tier is generous for this workload
  (single small document, one small image file, low read volume).
- **Railway**: Free plan includes $1/month of resource credit; new
  accounts get a one-time $5 trial credit for 30 days; the Hobby plan is
  $5/month. An always-on bot will eventually need a paid Railway plan —
  don't assume the trial credit is permanent.
- No Railway database, no Railway volume, no Firebase Cloud Functions, no
  Firebase Hosting are used, keeping the footprint to exactly: Railway
  (compute) + Firestore + Cloud Storage.

## Why not Cloud Functions?

Not used initially because the Railway process already runs continuously
and can call Firestore/Storage directly via the Admin SDK — adding Cloud
Functions would mean two runtimes, two deploy pipelines, and a second
billing surface for no functional gain. Reconsider Cloud Functions only if
a future feature needs to react to a Firestore/Storage event independently
of the bot process (e.g. a scheduled broadcast that must run even if the
bot is temporarily down) — that would mean: (1) necessity — event-driven
work decoupled from bot uptime, (2) what it does — e.g. a scheduled
trigger that writes a broadcast job Firestore doc, (3) architecture impact
— a second compute surface calling into the same Firestore/Storage,
(4) billing — Cloud Functions has its own free tier and then pay-per-
invocation/compute-time pricing on top of Railway's.

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
