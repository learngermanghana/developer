# Sedifex Integration Quickstart (Next.js + WordPress)

Use this guide to connect a client website, WordPress site, or backend service to Sedifex without exposing private keys in the browser.

This public developer guide is for partner/client integrations only. Internal Sedifex team systems and private marketplace workflows are intentionally excluded.

## What you can build

After setup, your website can fetch and render Sedifex-powered data such as:

- Products and services
- Promo details
- Gallery images
- Customer imports/sync, when allowed
- Top-selling products
- TikTok video feeds, when configured
- Availability and service bookings

## Required environment variables

Set these values in your server environment, not in browser/client-side variables:

```bash
SEDIFEX_API_BASE_URL=https://us-central1-sedifex-web.cloudfunctions.net
SEDIFEX_STORE_ID=<your_store_id>
SEDIFEX_INTEGRATION_API_KEY=<your_store_integration_key>
SEDIFEX_CONTRACT_VERSION=2026-04-13
```

Some older projects may use `SEDIFEX_INTEGRATION_API_BASE_URL` or `SEDIFEX_INTEGRATION_KEY`. They should point to the same values.

## Request headers

Every authenticated integration request should include:

```http
x-api-key: <your integration key>
X-Sedifex-Contract-Version: 2026-04-13
Accept: application/json
```

Never expose the integration key in a browser bundle or a `NEXT_PUBLIC_` variable.

## Main endpoints

Use the production base URL plus these paths:

```txt
GET /v1IntegrationProducts?storeId=<storeId>
GET /v1IntegrationPromo?storeId=<storeId>
GET /integrationGallery?storeId=<storeId>
GET /integrationCustomers?storeId=<storeId>
GET /integrationTopSelling?storeId=<storeId>&days=30&limit=10
GET /integrationTikTokVideos?storeId=<storeId>
GET /v1IntegrationAvailability?storeId=<storeId>&serviceId=<serviceId>&from=<ISO>&to=<ISO>
GET /v1IntegrationBookings?storeId=<storeId>
POST /v1IntegrationBookings?storeId=<storeId>
```

## Next.js server-side fetch example

```ts
import 'server-only'

type Product = {
  id: string
  storeId: string
  name: string
  category?: string | null
  description?: string | null
  price: number
  stockCount?: number
  imageUrl?: string | null
  imageUrls?: string[]
  imageAlt?: string | null
  itemType?: string | null
  updatedAt?: string | null
}

const BASE_URL = process.env.SEDIFEX_API_BASE_URL ?? 'https://us-central1-sedifex-web.cloudfunctions.net'
const STORE_ID = process.env.SEDIFEX_STORE_ID ?? ''
const API_KEY = process.env.SEDIFEX_INTEGRATION_API_KEY ?? process.env.SEDIFEX_INTEGRATION_KEY ?? ''
const CONTRACT = process.env.SEDIFEX_CONTRACT_VERSION ?? '2026-04-13'

function dedupeProducts(products: Product[]) {
  const seen = new Set<string>()
  return products.filter((product) => {
    const key = `${product.id}|${product.storeId}|${product.name}|${product.price}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function fetchSedifexProducts(): Promise<Product[]> {
  if (!STORE_ID || !API_KEY) return []

  const response = await fetch(
    `${BASE_URL}/v1IntegrationProducts?storeId=${encodeURIComponent(STORE_ID)}`,
    {
      headers: {
        'x-api-key': API_KEY,
        'X-Sedifex-Contract-Version': CONTRACT,
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    }
  )

  if (!response.ok) {
    throw new Error(`Sedifex products request failed: ${response.status}`)
  }

  const payload = await response.json()
  return dedupeProducts(Array.isArray(payload?.products) ? payload.products : [])
}
```

## Promo and gallery example

```ts
export async function fetchPromoAndGallery() {
  const headers = {
    'x-api-key': API_KEY,
    'X-Sedifex-Contract-Version': CONTRACT,
    Accept: 'application/json',
  }

  const [promoRes, galleryRes] = await Promise.all([
    fetch(`${BASE_URL}/v1IntegrationPromo?storeId=${encodeURIComponent(STORE_ID)}`, {
      headers,
      next: { revalidate: 60 },
    }),
    fetch(`${BASE_URL}/integrationGallery?storeId=${encodeURIComponent(STORE_ID)}`, {
      headers,
      next: { revalidate: 60 },
    }),
  ])

  if (!promoRes.ok) throw new Error(`Promo request failed: ${promoRes.status}`)
  if (!galleryRes.ok) throw new Error(`Gallery request failed: ${galleryRes.status}`)

  const promo = await promoRes.json()
  const gallery = await galleryRes.json()

  return {
    promo: promo?.promo ?? null,
    gallery: Array.isArray(gallery?.gallery)
      ? gallery.gallery.filter((item: any) => item?.isPublished !== false && item?.url)
      : [],
  }
}
```

## Booking/registration payload guidance

Build booking forms on each website using store-defined fields. Put vertical-specific data inside `attributes`.

Example fields:

```json
{
  "serviceId": "service_123",
  "serviceName": "Starter Course",
  "bookingDate": "2026-05-20",
  "bookingTime": "10:00",
  "customer": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "+233200000000"
  },
  "payment": {
    "method": "manual",
    "amount": 250,
    "confirmed": false
  },
  "attributes": {
    "source": "client_website_booking_form",
    "branchLocationId": "branch_1",
    "notes": "Optional notes"
  }
}
```

For the full booking dictionary, see `docs/integration-api-guide.md`.

## Common 404 fix

If your logs show a URL like:

```txt
/2026-04-13/products
```

your URL builder is wrong. `2026-04-13` is the contract header value, not a URL segment. Use:

```txt
GET /v1IntegrationProducts?storeId=<storeId>
```

and send:

```http
X-Sedifex-Contract-Version: 2026-04-13
```

## WordPress setup

For WordPress storefronts, use:

- `docs/wordpress-install-guide.md`
- `docs/wordpress-plugin/sedifex-sync.php`

## Security checklist

- Keep integration keys server-side only.
- Use one key per website/backend service.
- Rotate keys after staff changes or incidents.
- Log request IDs on failures.
- Add fallback UI so your website still renders if Sedifex is temporarily unavailable.

## Troubleshooting checklist

- Confirm `SEDIFEX_STORE_ID` is not empty.
- Confirm the integration key belongs to the store you are requesting.
- Confirm both headers are sent.
- Confirm endpoint names exactly match the docs.
- Use server logs, not browser logs, when debugging secret-backed requests.
