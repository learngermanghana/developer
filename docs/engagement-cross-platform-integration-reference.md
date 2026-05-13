## 3) Coding websites can use in 3 different architectures

### Architecture A — Direct API (simplest)

Website frontend/backend calls Sedifex engagement APIs directly.

Best for: fast rollout, low infrastructure.

- Read: `GET /comments?storeId&sourceProductId`
- Write: submit comment/favorite via API
- Auth: user JWT + integration API key

Pros: simple.
Cons: runtime dependency on Sedifex API availability.

### Architecture B — Mirror DB via Webhooks

Website keeps local `comments_cache` and `favorites_cache`; Sedifex pushes updates by webhook.

Best for: high-speed pages, custom analytics.

- Initial sync via pull API
- Ongoing updates via webhook events
- Local read for display; writes still go Sedifex first

Pros: very fast local reads.
Cons: more infrastructure complexity (retry/idempotency handling).

### Architecture C — Widget/SDK Embed (lowest engineering effort)

Sedifex provides JS SDK/widget:

```html
<div id="sedifex-comments"></div>
<script src="https://cdn.sedifex.com/engagement-widget.js"></script>
<script>
  SedifexComments.mount({
    elementId: "sedifex-comments",
    storeId: "...",
    sourceProductId: "...",
    apiKey: "...",
  });
</script>
```

Best for: non-technical merchants / quick adoption.

Pros: lowest effort.
Cons: less UI control unless the SDK supports deep theming.

---

### C. Merchant website env (any client website)

- `SEDIFEX_ENGAGEMENT_API_BASE_URL=https://api.sedifex.com`
- `SEDIFEX_STORE_ID=<merchant_store_id>`
- `SEDIFEX_WEBSITE_CLIENT_ID=...`
- `SEDIFEX_WEBSITE_CLIENT_SECRET=...` (server-only)
- `SEDIFEX_WEBHOOK_SECRET=...` (if webhook architecture)
- `SEDIFEX_PLATFORM_NAME=website_api`
- `SEDIFEX_ENABLE_COMMENT_WRITE=true`
- `SEDIFEX_ENABLE_COMMENT_READ=true`
- `SEDIFEX_ENABLE_FAVORITES_WRITE=true`
- `SEDIFEX_ENABLE_FAVORITES_READ=true`