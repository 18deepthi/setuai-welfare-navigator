# SetuAI — Multi-Scheme Welfare Navigator

A hackathon prototype that turns a citizen's natural-language description into a profile, discovers eligible welfare schemes, prepares an application draft, and simulates submission tracking.

## Run locally

1. Copy `.env.example` to `server/.env` and optionally add `OPENAI_API_KEY`. The app works in demo mode without one.
2. Run `npm run install:all` from this folder.
3. Run `npm run dev` and open `http://localhost:5173`.

The backend is served on port 3001 and the Vite dev server proxies `/api` requests to it.

## Adding more schemes and opportunities

Keep every government scheme, scholarship, internship, CSR programme, or private opportunity in `server/schemes.json`. Each record has a `type`, `providerType`, eligibility `rules`, benefit summary, and application attachments. The intake endpoint uses these fields to determine which cards a user sees. The catalog can also be read through `GET /api/schemes`, for example `GET /api/schemes?type=internship&provider=private`.

For a production-ready, up-to-date nationwide catalog, connect a scheduled importer to official programme portals or a licensed data source. Do not rely on AI-generated benefit amounts or deadlines without verifying them against the current official notice.

Set `AUTO_SYNC_SCHEMES=true` and configure `SCHEME_FEEDS` in `server/.env` as a JSON array of approved HTTPS JSON feeds. SetuAI will sync them at launch and every six hours; imported records are saved in `server/remote-schemes.json`. You can also trigger a sync locally with `npm run sync:catalog --prefix server`.

> This is a sandbox prototype using mock scheme data. It does not submit to government portals or retain personal data.
