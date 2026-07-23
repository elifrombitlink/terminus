# Terminus // Command

Internal operations command interface for NorthFirn and related businesses —
missions, objectives, approvals, signals, and the Mission Log.

This repository is the **web front-end**: a Vite + React single-page app,
deployed on **Cloudflare Pages**, backed by a dedicated **Supabase** project.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in your Supabase project values
npm run dev
```

The dev server runs on <http://localhost:5173>.

## Build

```bash
npm run build      # typecheck + vite build -> dist/
npm run preview    # serve the production build locally
```

## Environment

The app reads two **public, browser-safe** values (see `.env.example`):

| Variable | Meaning |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable / anon key (`sb_publishable_…`) |

The publishable key is designed to be shipped in the client bundle. The
`service_role` / secret key must **never** appear in this repo or the bundle.

For Cloudflare Pages, set these in the Pages project's environment variables
(Production and Preview) rather than committing a `.env`.

## Hosting (Cloudflare Pages)

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Connect this GitHub repo to a Cloudflare Pages project and every push
redeploys.

## Status

The Command interface currently runs on in-browser sample state — search and
filter objectives, create objectives, inspect details, update status/priority/
due date, add comments, approve or hold sensitive actions, and watch each
action land in the Mission Log.

The Supabase client (`src/lib/supabase.ts`) is wired and validated; the data
plane (objectives, comments, approvals, Mission Log) is being connected to it
incrementally once the Terminus schema is applied to the project.
