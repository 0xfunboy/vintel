# Vintel

Production-oriented Next.js app for a Vinted sniper portal on `https://app.eeess.cyou`.

## Included

- optional Google OAuth with Auth.js
- guest-first homepage with live market previews
- private per-user dashboard for filters and delivery
- dark mode first, light mode available
- English / Italian UI switch
- Telegram chat linking through `/start <token>`
- protected ingest API for real listing delivery
- privacy, cookie, and GDPR pages
- JSON persistence for single-host deployment

## Required env

Copy `.env.example` to `.env.local` and set:

- `APP_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `INGEST_CRON_SECRET`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

## Commands

```bash
source ~/.nvm/nvm.sh
nvm use 23.3.0
pnpm install
pnpm build
pnpm start -- --port 3001
```

Dev:

```bash
pnpm dev -- --port 3001
```

Smoke:

```bash
pnpm smoke
```

## Main routes

- `/`
- `/signin`
- `/dashboard`
- `/privacy`
- `/cookies`
- `/gdpr`
- `/api/health`
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
