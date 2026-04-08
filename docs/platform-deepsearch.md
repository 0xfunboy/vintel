# Deepsearch: Vinted platform dynamics relevant to Vintel

Date: 2026-04-08

## What matters for a Vinted sniper-style product

- Discovery is not a simple shared chronological feed. Search, ranking, seller-follow notifications, and paid visibility tools can change what different users see.
- The real product challenge is not only speed. It is signal quality: category cuts, price boundaries, keyword logic, description matching, seller filtering, and deduplication.
- Public listing links are useful, but checkout remains a separate buyer flow. Vintel should optimize discovery and handoff, not impersonate purchase completion.

## Product implications

- The homepage should work for guests: fresh public finds, hot searches, category previews, and price lanes.
- Private accounts should be optional and clearly valuable:
  - saved filters
  - Google identity
  - Telegram chat binding
  - personal alert delivery
- Manual-buy CTAs can exist both in Telegram and on the web as listing handoff buttons that open the original Vinted page.

## Operational constraints

- Public web behavior on Vinted can change over time, so ingest logic must be modular and replaceable.
- Scoring should remain local to Vintel:
  - keyword hits
  - category match
  - seller allow/block rules
  - duplicate suppression
  - price lane fit
- Empty states matter because ingest volume is bursty. The UI should still feel alive even when no fresh items have landed yet.

## Recommended product surface

1. Guest-first homepage with live board, most wanted searches, and latest items under selected price ceilings.
2. Optional auth for saved filters and Telegram sync.
3. Ingest API that accepts normalized listing payloads from whichever upstream collector is active.
4. Telegram bot for alerts and manual handoff.
5. Private dashboard for user filters:
   category
   min/max price
   keyword AND/OR
   description search
   seller allowlist/blocklist

## Guardrails

- Keep the product language user-facing, not internal. Avoid ops words like `deploy`, `feed status`, or `ingest` in public copy.
- Treat Telegram and the web app as complementary surfaces of the same discovery workflow.
- Keep the buy action manual and explicit.
