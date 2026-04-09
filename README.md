# Vintel

Production-oriented Next.js app for a Vinted sniper portal on `https://app.eeess.cyou`.

## Included

- optional Google OAuth with Auth.js
- guest-first homepage with live Vinted market search
- private per-user dashboard for filters and delivery
- track-similar modal that turns live searches and listings into tracked hunts
- dark mode first, light mode available
- English / Italian UI switch
- Telegram chat linking through auto deep link, `/link <token>`, or manual chat id from `/id`
- protected ingest API plus live Vinted poller for tracked searches
- privacy, cookie, and GDPR pages
- JSON persistence for single-host deployment

## Required env

Copy `.env.example` to `.env.local` and set:

- `APP_URL`
- `AUTH_URL`
- `PORT`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `INGEST_CRON_SECRET`
- `POLL_INTERVAL_SECONDS`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

## Commands

```bash
source ~/.nvm/nvm.sh
nvm use 23.3.0
pnpm install
pnpm build
pnpm start -- --port 43101
```

Dev:

```bash
pnpm dev -- --port 43101
```

Smoke:

```bash
pnpm smoke
pnpm poll
pnpm poll:loop
```

## Production port

`app.eeess.cyou` is pinned to `PORT=43101`.

The current production unit also keeps a local compatibility bridge on `127.0.0.1:3001` so the existing Cloudflare tunnel can keep serving traffic until its system service is reloaded.

## Poller

Tracked-search polling runs from a separate user service and reads `POLL_INTERVAL_SECONDS` from `.env.local`.

Current default:

```bash
POLL_INTERVAL_SECONDS=60
```

Manual run:

```bash
source ~/.nvm/nvm.sh
nvm use 23.3.0
corepack pnpm poll:loop
```

User service template:

[`deploy/systemd/vinted-gpu-watch-poller.service`](/home/funboy/vintel/deploy/systemd/vinted-gpu-watch-poller.service)

## Safe deploy flow

On this host, do not rebuild while `next start` is serving the same `.next` directory. Stop the service first, rebuild, then start it again.

```bash
systemctl --user stop vinted-gpu-watch.service
source ~/.nvm/nvm.sh
nvm use 23.3.0
corepack pnpm build
systemctl --user start vinted-gpu-watch.service
```

## Main routes

- `/`
- `/signin`
- `/dashboard`
- `/privacy`
- `/cookies`
- `/gdpr`
- `/api/health`
- `/api/search/live`
- `/api/sniper/track`
- `/api/cron/poll`
- `/api/ingest/listings`
- `/api/telegram/webhook`
- `/api/me/export`

## Telegram webhook

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$APP_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Ingest payload

```json
{
  "items": [
    {
      "source": "vinted",
      "sourceListingId": "123",
      "category": "Sneakers",
      "title": "Nike Air Max 97 silver",
      "description": "Worn twice, with box",
      "url": "https://www.vinted.it/items/123",
      "imageUrl": "https://example.com/item.jpg",
      "priceCents": 8900,
      "currency": "EUR",
      "sellerName": "seller_123",
      "sellerUrl": "https://www.vinted.it/member/123",
      "location": "Milan",
      "postedAt": "2026-04-08T12:00:00.000Z"
    }
  ]
}
```
