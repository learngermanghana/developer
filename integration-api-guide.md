# Sedifex Integration API Guide (v1)

This guide explains how third-party clients (including Buy Sedifex) should authenticate, call endpoints, cache/deduplicate responses, and migrate safely as the API evolves.

## 1) Authentication and API keys

### Required integration secrets/config

Set these values in your website/server environment before calling Sedifex integration endpoints:

- `SEDIFEX_INTEGRATION_API_KEY` (or legacy alias `SEDIFEX_INTEGRATION_KEY`) → your integration key.
- `SEDIFEX_API_BASE_URL` (or legacy alias `SEDIFEX_INTEGRATION_API_BASE_URL`) → API base URL, typically `https://us-central1-sedifex-web.cloudfunctions.net`.
- `SEDIFEX_STORE_ID` → store id to query in `?storeId=<storeId>`.

Example server-side env:

```env
SEDIFEX_API_BASE_URL=https://us-central1-sedifex-web.cloudfunctions.net
SEDIFEX_STORE_ID=store_123
SEDIFEX_INTEGRATION_API_KEY=sk_live_xxx
```

- Choose one auth mode:
  - **Admin master key mode**: set Firebase Functions param `SEDIFEX_INTEGRATION_API_KEY` (can fetch all stores from integration products endpoints when `storeId` is omitted).
  - **Store key mode**: create a store integration key from Sedifex Account settings (must include that `storeId`; access is store-scoped).
- Store keys server-side only (never in browser bundles).
- Call authenticated endpoints with:
  - `x-api-key: <master_or_store_integration_key>`
  - `X-Sedifex-Contract-Version: 2026-04-13`
- Rotate keys regularly (recommended quarterly or immediately on incident).

## 2) Versioning contract

- Current contract version: `2026-04-13`.
- Request header: `X-Sedifex-Contract-Version`.
- Response headers:
  - `x-sedifex-contract-version`
  - `x-sedifex-request-id`
- If versions mismatch, API returns 400:

```json
{
  "error": "contract-version-mismatch",
  "expectedVersion": "2026-04-13",
  "receivedVersion": "2026-01-01"
}
```

## 3) Endpoint response shapes

### GET /v1/products (public marketplace feed)

Query parameters:

- `sort`: `store-diverse | newest | price | featured`
  - `store-diverse` groups products by `storeId`, sorts within each store by `featuredRank desc`, then `updatedAt desc`, and interleaves stores round-robin before pagination.
- `page`: 1-based page number (default 1).
- `pageSize` or `limit`: products per page (default 24, max 60).
- `maxPerStore` (optional): cap how many products from the same store may appear on a single page.

```json
{
  "sort": "store-diverse",
  "page": 1,
  "pageSize": 24,
  "maxPerStore": 2,
  "total": 324,
  "products": [
    {
      "id": "product_1",
      "storeId": "store_123",
      "storeName": "Sedifex Store",
      "storeCity": "Accra",
      "name": "Item",
      "category": "Meals",
      "description": "Description",
      "price": 45,
      "stockCount": 10,
      "itemType": "product",
      "imageUrl": "https://...",
      "imageUrls": ["https://..."],
      "imageAlt": "Item image",
      "featuredRank": 12,
      "updatedAt": "2026-04-13T00:00:00.000Z"
    }
  ]
}
```

`storeName` and `storeCity` are included so marketplace consumers (e.g. Buy Sedifex) can render seller identity/location without making extra store lookup calls.

### GET /v1IntegrationProducts?storeId=<storeId> (authenticated)

- With a store key: `storeId` is required and only that store is returned.
- With the admin master key:
  - include `storeId` to get one store, or
  - omit `storeId` to fetch products across all stores (`scope: "all-stores"` in response).

```json
{
  "storeId": "store_123",
  "products": [
    {
      "id": "product_1",
      "storeId": "store_123",
      "name": "Item",
      "category": "Meals",
      "description": "Description",
      "price": 45,
      "stockCount": 10,
      "itemType": "product",
      "imageUrl": "https://...",
      "imageUrls": ["https://..."],
      "imageAlt": "Item image",
      "updatedAt": "2026-04-13T00:00:00.000Z"
    }
  ],
  "publicProducts": [],
  "publicServices": []
}
```

`publicProducts` and `publicServices` are convenience buckets derived from `itemType` so storefronts can render physical products and services in separate sections without extra client-side sorting.

### GET /api/public-blog?storeId=<storeId>[&slug=<postSlug>] (public, no API key)

Use this endpoint when a store wants its website to pull published blog posts from Sedifex.

- `storeId` is required.
- `slug` is optional. If provided, Sedifex filters to one post slug.
- Returns only posts with `status = "published"`.

Example list response:

```json
{
  "items": [
    {
      "id": "post_123",
      "title": "How to choose the right product",
      "slug": "how-to-choose-the-right-product",
      "content": "<p>...</p>",
      "linkUrl": "https://example.com/more-details",
      "imageUrl": "https://storage.googleapis.com/.../blog-image.jpg",
      "publishedAt": "2026-05-12T10:00:00.000Z"
    }
  ]
}
```

Blog pull integration steps (website)

- Save the store's `storeId` in your website backend config.
- Fetch posts server-side:
  - `GET ${SEDIFEX_SITE_BASE_URL}/api/public-blog?storeId=<storeId>`
- Cache response for 30-120 seconds to reduce repeated fetches.
- Render list cards (title, image, excerpt from content) and optionally deep-link by slug.
- For one post page, call:
  - `GET ${SEDIFEX_SITE_BASE_URL}/api/public-blog?storeId=<storeId>&slug=<postSlug>`

Minimal Node/Next.js server example

```js
const base = process.env.SEDIFEX_SITE_BASE_URL ?? 'https://www.sedifex.com'
const storeId = process.env.SEDIFEX_STORE_ID ?? ''

const res = await fetch(`${base}/api/public-blog?storeId=${encodeURIComponent(storeId)}`, {
  // next.js cache hint (optional)
  next: { revalidate: 60 },
})

if (!res.ok) throw new Error(`Blog pull failed: ${res.status}`)
const payload = await res.json()
const items = Array.isArray(payload.items) ? payload.items : []
```

### GET /v1IntegrationPromo?storeId=<storeId> (authenticated) or ?slug=<promoSlug> (public)

```json
{
  "storeId": "store_123",
  "promo": {
    "enabled": true,
    "slug": "my-store",
    "title": "Promo title",
    "summary": "Promo summary",
    "startDate": "2026-04-01",
    "endDate": "2026-04-30",
    "websiteUrl": "https://example.com",
    "youtubeUrl": null,
    "youtubeEmbedUrl": null,
    "youtubeChannelId": null,
    "youtubeVideos": [],
    "imageUrl": null,
    "imageAlt": null,
    "phone": "+233...",
    "storeName": "Sedifex Store",
    "updatedAt": "2026-04-13T00:00:00.000Z"
  }
}
```
