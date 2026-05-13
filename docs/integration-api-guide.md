\# Sedifex Integration API Guide (v1)



This guide explains how third-party clients (including Buy Sedifex) should authenticate, call endpoints, cache/deduplicate responses, and migrate safely as the API evolves.



\## 1) Authentication and API keys



\### Required integration secrets/config



Set these values in your website/server environment before calling Sedifex integration endpoints:



\- `SEDIFEX\_INTEGRATION\_API\_KEY` (or legacy alias `SEDIFEX\_INTEGRATION\_KEY`) → your integration key.

\- `SEDIFEX\_API\_BASE\_URL` (or legacy alias `SEDIFEX\_INTEGRATION\_API\_BASE\_URL`) → API base URL, typically `https://us-central1-sedifex-web.cloudfunctions.net`.

\- `SEDIFEX\_STORE\_ID` → store id to query in `?storeId=<storeId>`.



Example server-side env:



```bash

SEDIFEX\_API\_BASE\_URL=https://us-central1-sedifex-web.cloudfunctions.net

SEDIFEX\_STORE\_ID=store\_123

SEDIFEX\_INTEGRATION\_API\_KEY=sk\_live\_xxx

```



1\. Choose one auth mode:

&#x20;  - \*\*Admin master key mode:\*\* set Firebase Functions param `SEDIFEX\_INTEGRATION\_API\_KEY` (can fetch all stores from integration products endpoints when `storeId` is omitted).

&#x20;  - \*\*Store key mode:\*\* create a store integration key from Sedifex Account settings (must include that `storeId`; access is store-scoped).

2\. Store keys server-side only (never in browser bundles).

3\. Call authenticated endpoints with:

&#x20;  - `x-api-key: <master\_or\_store\_integration\_key>`

&#x20;  - `X-Sedifex-Contract-Version: 2026-04-13`

4\. Rotate keys regularly (recommended quarterly or immediately on incident).



\## 2) Versioning contract



\- Current contract version: `2026-04-13`.

\- Request header: `X-Sedifex-Contract-Version`.

\- Response headers:

&#x20; - `x-sedifex-contract-version`

&#x20; - `x-sedifex-request-id`

\- If versions mismatch, API returns `400`:



```json

{

&#x20; "error": "contract-version-mismatch",

&#x20; "expectedVersion": "2026-04-13",

&#x20; "receivedVersion": "2026-01-01"

}

```



\## 3) Endpoint response shapes



\### `GET /v1/products` (public marketplace feed)



Query parameters:



\- `sort`: `store-diverse` | `newest` | `price` | `featured`

&#x20; - `store-diverse` groups products by `storeId`, sorts within each store by `featuredRank desc`, then `updatedAt desc`, and interleaves stores round-robin before pagination.

\- `page`: 1-based page number (default `1`).

\- `pageSize` or `limit`: products per page (default `24`, max `60`).

\- `maxPerStore` (optional): cap how many products from the same store may appear on a single page.



```json

{

&#x20; "sort": "store-diverse",

&#x20; "page": 1,

&#x20; "pageSize": 24,

&#x20; "maxPerStore": 2,

&#x20; "total": 324,

&#x20; "products": \[

&#x20;   {

&#x20;     "id": "product\_1",

&#x20;     "storeId": "store\_123",

&#x20;     "storeName": "Sedifex Store",

&#x20;     "storeCity": "Accra",

&#x20;     "name": "Item",

&#x20;     "category": "Meals",

&#x20;     "description": "Description",

&#x20;     "price": 45,

&#x20;     "stockCount": 10,

&#x20;     "itemType": "product",

&#x20;     "imageUrl": "https://...",

&#x20;     "imageUrls": \["https://..."],

&#x20;     "imageAlt": "Item image",

&#x20;     "featuredRank": 12,

&#x20;     "updatedAt": "2026-04-13T00:00:00.000Z"

&#x20;   }

&#x20; ]

}

```



`storeName` and `storeCity` are included so marketplace consumers (e.g. Buy Sedifex) can render seller identity/location without making extra store lookup calls.



\### `GET /v1IntegrationProducts?storeId=<storeId>` (authenticated)



\- With a \*\*store key\*\*: `storeId` is required and only that store is returned.

\- With the \*\*admin master key\*\*:

&#x20; - include `storeId` to get one store, or

&#x20; - omit `storeId` to fetch products across all stores (`scope: "all-stores"` in response).



```json

{

&#x20; "storeId": "store\_123",

&#x20; "products": \[

&#x20;   {

&#x20;     "id": "product\_1",

&#x20;     "storeId": "store\_123",

&#x20;     "name": "Item",

&#x20;     "category": "Meals",

&#x20;     "description": "Description",

&#x20;     "price": 45,

&#x20;     "stockCount": 10,

&#x20;     "itemType": "product",

&#x20;     "imageUrl": "https://...",

&#x20;     "imageUrls": \["https://..."],

&#x20;     "imageAlt": "Item image",

&#x20;     "updatedAt": "2026-04-13T00:00:00.000Z"

&#x20;   }

&#x20; ],

&#x20; "publicProducts": \[],

&#x20; "publicServices": \[]

}

```



`publicProducts` and `publicServices` are convenience buckets derived from `itemType` so storefronts can render physical products and services in separate sections without extra client-side sorting.



\### `GET /api/public-blog?storeId=<storeId>\[\&slug=<postSlug>]` (public, no API key)



Use this endpoint when a store wants its website to \*\*pull published blog posts\*\* from Sedifex.



\- `storeId` is required.

\- `slug` is optional. If provided, Sedifex filters to one post slug.

\- Returns only posts with `status = "published"`.



Example list response:



```json

{

&#x20; "items": \[

&#x20;   {

&#x20;     "id": "post\_123",

&#x20;     "title": "How to choose the right product",

&#x20;     "slug": "how-to-choose-the-right-product",

&#x20;     "content": "<p>...</p>",

&#x20;     "linkUrl": "https://example.com/more-details",

&#x20;     "imageUrl": "https://storage.googleapis.com/.../blog-image.jpg",

&#x20;     "publishedAt": "2026-05-12T10:00:00.000Z"

&#x20;   }

&#x20; ]

}

```



\#### Blog pull integration steps (website)



1\. Save the store's `storeId` in your website backend config.

2\. Fetch posts server-side:

&#x20;  - `GET ${SEDIFEX\_SITE\_BASE\_URL}/api/public-blog?storeId=<storeId>`

3\. Cache response for 30-120 seconds to reduce repeated fetches.

4\. Render list cards (title, image, excerpt from content) and optionally deep-link by slug.

5\. For one post page, call:

&#x20;  - `GET ${SEDIFEX\_SITE\_BASE\_URL}/api/public-blog?storeId=<storeId>\&slug=<postSlug>`



\#### Minimal Node/Next.js server example



```ts

const base = process.env.SEDIFEX\_SITE\_BASE\_URL ?? 'https://www.sedifex.com'

const storeId = process.env.SEDIFEX\_STORE\_ID ?? ''



const res = await fetch(`${base}/api/public-blog?storeId=${encodeURIComponent(storeId)}`, {

&#x20; // next.js cache hint (optional)

&#x20; next: { revalidate: 60 },

})



if (!res.ok) throw new Error(`Blog pull failed: ${res.status}`)

const payload = await res.json()

const items = Array.isArray(payload.items) ? payload.items : \[]

```



\### `GET /v1IntegrationPromo?storeId=<storeId>` (authenticated) or `?slug=<promoSlug>` (public)



```json

{

&#x20; "storeId": "store\_123",

&#x20; "promo": {

&#x20;   "enabled": true,

&#x20;   "slug": "my-store",

&#x20;   "title": "Promo title",

&#x20;   "summary": "Promo summary",

&#x20;   "startDate": "2026-04-01",

&#x20;   "endDate": "2026-04-30",

&#x20;   "websiteUrl": "https://example.com",

&#x20;   "youtubeUrl": null,

&#x20;   "youtubeEmbedUrl": null,

&#x20;   "youtubeChannelId": null,

&#x20;   "youtubeVideos": \[],

&#x20;   "imageUrl": null,

&#x20;   "imageAlt": null,

&#x20;   "phone": "+233...",

&#x20;   "storeName": "Sedifex Store",

&#x20;   "updatedAt": "2026-04-13T00:00:00.000Z"

&#x20; }

}

```



\### `GET /v1IntegrationAvailability?storeId=<storeId>\&serviceId=<serviceId>\&from=<ISO>\&to=<ISO>` (authenticated)



\- Returns session/class slots for service-type offerings.

\- `serviceId`, `from`, and `to` are optional filters.

\- `attributes` is a flexible object for industry-specific fields (for example: school grade level or travel pickup point).



```json

{

&#x20; "storeId": "store\_123",

&#x20; "serviceId": "service\_abc",

&#x20; "from": "2026-04-20T00:00:00.000Z",

&#x20; "to": "2026-04-30T23:59:59.000Z",

&#x20; "slots": \[

&#x20;   {

&#x20;     "id": "slot\_1",

&#x20;     "storeId": "store\_123",

&#x20;     "serviceId": "service\_abc",

&#x20;     "startAt": "2026-04-22T10:00:00.000Z",

&#x20;     "endAt": "2026-04-22T11:00:00.000Z",

&#x20;     "timezone": "Africa/Accra",

&#x20;     "capacity": 20,

&#x20;     "seatsBooked": 8,

&#x20;     "seatsRemaining": 12,

&#x20;     "status": "open",

&#x20;     "attributes": {

&#x20;       "level": "Beginner"

&#x20;     },

&#x20;     "updatedAt": "2026-04-13T00:00:00.000Z"

&#x20;   }

&#x20; ]

}

```



\### `GET /integrationGallery?storeId=<storeId>` (public via store/slug resolution)



\- Returns published gallery images sorted by `sortOrder asc`.

\- Useful for `/integrationGallery` page sections on partner websites.



```json

{

&#x20; "storeId": "store\_123",

&#x20; "gallery": \[

&#x20;   {

&#x20;     "id": "gallery\_1",

&#x20;     "url": "https://...",

&#x20;     "alt": "Front store display",

&#x20;     "caption": "Grand opening",

&#x20;     "sortOrder": 1,

&#x20;     "isPublished": true,

&#x20;     "createdAt": "2026-04-13T00:00:00.000Z",

&#x20;     "updatedAt": "2026-04-13T00:00:00.000Z"

&#x20;   }

&#x20; ]

}

```



\### `GET /integrationCustomers?storeId=<storeId>` (authenticated)



\- Returns up to 500 customers for the store, sorted by latest update.

\- Useful for `/integrationCustomers` sync/import views.



```json

{

&#x20; "storeId": "store\_123",

&#x20; "customers": \[

&#x20;   {

&#x20;     "id": "cust\_1",

&#x20;     "storeId": "store\_123",

&#x20;     "name": "Ada Mensah",

&#x20;     "displayName": "Ada",

&#x20;     "phone": "+233201234567",

&#x20;     "email": "ada@example.com",

&#x20;     "notes": null,

&#x20;     "tags": \["vip"],

&#x20;     "birthdate": null,

&#x20;     "createdAt": "2026-04-01T10:00:00.000Z",

&#x20;     "updatedAt": "2026-04-13T10:00:00.000Z",

&#x20;     "debt": {

&#x20;       "outstandingCents": 5000,

&#x20;       "dueDate": "2026-04-20T00:00:00.000Z",

&#x20;       "lastReminderAt": null

&#x20;     }

&#x20;   }

&#x20; ]

}

```



\### `GET /integrationTopSelling?storeId=<storeId>\&days=30\&limit=10` (authenticated)



\- Aggregates `saleItems` over a rolling window (`days`, min 1 max 365).

\- `limit` is clamped between 1 and 50.

\- Useful for `/integrationTopSelling` widgets and merchandising blocks.



```json

{

&#x20; "storeId": "store\_123",

&#x20; "windowDays": 30,

&#x20; "generatedAt": "2026-04-13T00:00:00.000Z",

&#x20; "topSelling": \[

&#x20;   {

&#x20;     "productId": "product\_1",

&#x20;     "name": "Item",

&#x20;     "category": "Meals",

&#x20;     "imageUrl": "https://...",

&#x20;     "imageUrls": \["https://..."],

&#x20;     "imageAlt": "Item image",

&#x20;     "itemType": "product",

&#x20;     "qtySold": 42,

&#x20;     "grossSales": 1890,

&#x20;     "lastSoldAt": "2026-04-12T18:00:00.000Z"

&#x20;   }

&#x20; ]

}

```



\### `GET /integrationTikTokVideos?storeId=<storeId>` (authenticated)



\- Returns published TikTok videos sorted by `sortOrder asc`, then recency.

\- Useful for `/integrationTikTokVideos` embeds.



```json

{

&#x20; "storeId": "store\_123",

&#x20; "videos": \[

&#x20;   {

&#x20;     "id": "tt\_1",

&#x20;     "videoId": "7390000000000000000",

&#x20;     "embedUrl": "https://www.tiktok.com/embed/v2/7390000000000000000",

&#x20;     "permalink": "https://www.tiktok.com/@store/video/7390000000000000000",

&#x20;     "caption": "New arrivals this week",

&#x20;     "thumbnailUrl": "https://...",

&#x20;     "duration": 24,

&#x20;     "viewCount": 1200,

&#x20;     "likeCount": 220,

&#x20;     "commentCount": 12,

&#x20;     "shareCount": 7,

&#x20;     "sortOrder": 1,

&#x20;     "publishedAt": "2026-04-12T12:00:00.000Z",

&#x20;     "createdAt": "2026-04-12T12:00:00.000Z",

&#x20;     "updatedAt": "2026-04-13T08:00:00.000Z"

&#x20;   }

&#x20; ]

}

```



\## 3.1) Integration page steps for `/integrationGallery`, `/integrationCustomers`, `/integrationTopSelling`, `/integrationTikTokVideos`



Use this sequence when wiring those integration pages/widgets in external websites:



1\. Load env config (`SEDIFEX\_API\_BASE\_URL`, `SEDIFEX\_STORE\_ID`, `SEDIFEX\_INTEGRATION\_API\_KEY`).

2\. Build headers:

&#x20;  - `x-api-key: <integration\_key>`

&#x20;  - `X-Sedifex-Contract-Version: 2026-04-13`

&#x20;  - `Accept: application/json`

3\. Issue GET requests with `?storeId=<storeId>`:

&#x20;  - `/integrationGallery`

&#x20;  - `/integrationCustomers`

&#x20;  - `/integrationTopSelling?days=30\&limit=10` (adjust as needed)

&#x20;  - `/integrationTikTokVideos`

4\. Normalize and cache:

&#x20;  - Gallery/videos: preserve `sortOrder`; filter to published records only.

&#x20;  - Customers/top-selling: dedupe by `id`/`productId`; sort by latest `updatedAt`/`lastSoldAt`.

5\. Fallback safely:

&#x20;  - Keep local fallback data for UI continuity.

&#x20;  - Retry idempotent GET failures with backoff and log `x-sedifex-request-id`.



\### `GET /v1IntegrationBookings?storeId=<storeId>\&status=<status>\&serviceId=<serviceId>` (authenticated)



\- Lists website-originated bookings/registrations.

\- `status` and `serviceId` filters are optional.



\### `POST /v1IntegrationBookings?storeId=<storeId>` (authenticated)



\- Creates a booking/registration from a website form submission.

\- Request body supports:

&#x20; - `serviceId` (recommended; if omitted, Sedifex tries to resolve from `slotId` or `BOOKING\_DEFAULT\_SERVICE\_ID`)

&#x20; - `slotId` (optional; when supplied, capacity is validated; aliases `slotID` and `slot\_id` are also accepted)

&#x20; - `customer` (`name` / `phone` / `email`, at least one required)

&#x20; - `quantity` (optional, defaults to `1`)

&#x20; - `notes` (optional)

&#x20; - `attributes` (optional flexible object for vertical-specific fields)

\- Service resolution order:

&#x20; 1. Explicit `serviceId` from request payload

&#x20; 2. `serviceId` inferred from the selected `slotId`

&#x20; 3. Firebase param `BOOKING\_DEFAULT\_SERVICE\_ID`

\- If service cannot be resolved, API returns:

&#x20; - `400` with `error: "service-not-resolved"`

&#x20; - message: `"Service could not be resolved. Configure BOOKING\_DEFAULT\_SERVICE\_ID or provide serviceId."`

\- Customer auto-mapping:

&#x20; - When `customer.phone` or `customer.email` is provided, Sedifex automatically upserts the contact into the store `customers` collection.

&#x20; - Existing customer records are matched by `storeId + phone` first, then `storeId + email`.

&#x20; - New customer records are tagged with `source: "integrationBooking"` for later segmentation.



\#### Booking canonical field map (for website developers)



To prevent sync mismatches between different form builders, use these canonical keys in booking payloads and/or map your website labels to them in \*\*Settings → Integrations → Booking Mapping\*\*.



| Canonical key | Purpose | Common website aliases |

|---|---|---|

| `customerName` | Booker full name | `name`, `fullName`, `clientName` |

| `customerPhone` | Booker phone | `phone`, `phoneNumber`, `mobile`, `whatsapp` |

| `customerEmail` | Booker email | `email`, `emailAddress` |

| `serviceName` | Product/service selected | `productName`, `service\_note\_name` |

| `bookingDate` | Booking date | `date` |

| `bookingTime` | Booking time | `time` |

| `branchLocationId` | Internal branch/store location id | `branchId`, `locationId`, `storeBranchId` |

| `branchLocationName` | Human-readable branch name | `branchName`, `storeBranch`, `locationName` |

| `eventLocation` | Where event takes place | `eventVenue`, `venue`, `eventAddress` |

| `customerStayLocation` | Where customer is staying | `stayLocation`, `hotelLocation`, `guestLocation` |

| `paymentMethod` | How customer pays | `payment\_method`, `paymentType` |

| `paymentAmount` | Amount charged/paid | `amount`, `total`, `price` |



\*\*Legacy compatibility:\*\* `preferredBranch` and `depositAmount` are still supported, but new implementations should prefer `branchLocationId`/`branchLocationName` and `paymentAmount`.



\#### Example request body (recommended shape)



```json

{

&#x20; "serviceId": "svc\_event\_001",

&#x20; "slotId": "slot\_2026\_08\_01\_10\_00",

&#x20; "customer": {

&#x20;   "name": "Ada Mensah",

&#x20;   "phone": "+233201234567",

&#x20;   "email": "ada@example.com"

&#x20; },

&#x20; "quantity": 2,

&#x20; "notes": "Need projector setup",

&#x20; "paymentMethod": "bank\_transfer",

&#x20; "paymentAmount": 250,

&#x20; "branchLocationId": "branch\_accra\_airport",

&#x20; "branchLocationName": "Airport Branch",

&#x20; "eventLocation": "National Theatre, Accra",

&#x20; "customerStayLocation": "Labadi Beach Hotel",

&#x20; "attributes": {

&#x20;   "source": "wordpress\_booking\_form",

&#x20;   "campaign": "summer\_launch"

&#x20; }

}

```



\## 4) Deduplication and caching



\- Deduplicate by product `id` (and optionally `updatedAt` when merging data sources).

\- Recommended cache policy:

&#x20; - Products/top-selling: 30s cache + 120s stale-while-revalidate.

&#x20; - Promo/gallery: 60s cache + 300s stale-while-revalidate.

\- Always keep a small fallback dataset so storefront pages can render during transient failures.



\## 5) Error handling



Common status codes:



\- `400` malformed request (`missing-token-or-store`, `contract-version-mismatch`)

\- `401` invalid integration token

\- `404` unknown store/promo slug

\- `405` unsupported method



Client guidance:



1\. Retry idempotent GET failures with exponential backoff.

2\. Include and log `x-sedifex-request-id` for support/tracing.

3\. On `401`, rotate or re-issue key and retry.

4\. On `contract-version-mismatch`, deploy client version compatible with `expectedVersion`.



\## 6) Migration when fields are added



\- Additive fields can appear at any time in the same contract version.

\- Consumers should ignore unknown fields.

\- For breaking changes, Sedifex will publish a new contract version and allow overlap during migration.



\## 7) Shared types



Use `shared/integrationTypes.ts` as the shared source of truth for:



\- `IntegrationProduct`

\- `IntegrationPromo`

\- `IntegrationProductsResponse`

\- `IntegrationPromoResponse`





\## 8) Client website communication contract (Partner Spec v1)



For partner websites, keep checkout communication limited to three endpoints and one webhook contract.



This contract supports both \*\*product sales\*\* and \*\*service bookings\*\*. Set `orderType` accordingly (`product` or `service`) and consume `bookingStatus` when the transaction represents a booking.



\### Canonical IDs (required on every transaction)



Persist all three IDs together for reconciliation and support:



\- `reference`: Paystack/Sedifex payment reference (authoritative payment lookup key).

\- `sedifexOrderId`: internal Sedifex order/booking id.

\- `clientOrderId`: partner website order id.



For service bookings, include your booking identifier in `clientOrderId` (or in `metadata.bookingId`) so customer support can reconcile website bookings to Sedifex records.



\## 9) Checkout pricing + fulfillment contract (Website ↔ Sedifex)



Use this section when wiring storefront checkout so Sedifex remains the source of truth for totals.



\### MVP decisions (current)



\- Refunds are out of scope for this version.

\- Paystack processing fee is recovered from the customer by adding `processing\_fee\_to\_add` at checkout.

\- Delivery fee is conditional:

&#x20; - `PICKUP` → no delivery fee.

&#x20; - `DELIVERY` → delivery fee is calculated and added as a separate charge.

\- Tax is read from inventory/service item configuration where set.



\### Canonical checkout fields (use these exact names)



\- `fulfillment\_type` (`PICKUP` | `DELIVERY`)

\- `subtotal`

\- `tax\_total`

\- `delivery\_fee`

\- `pre\_processing\_total`

\- `processing\_fee\_to\_add`

\- `final\_total`

\- `pricing\_snapshot`

\- `payment\_reference`

\- `payment\_status`

\- `order\_status`



All monetary fields must be integers in minor units (for example, NGN kobo).



\### Required endpoint sequence



1\. `POST /checkout/preview`

&#x20;  - Website sends cart, fulfillment choice, and delivery context.

&#x20;  - Sedifex calculates and returns full pricing breakdown.

2\. `POST /checkout/create`

&#x20;  - Sedifex recalculates server-side, stores immutable `pricing\_snapshot`, and initializes Paystack with `final\_total`.

3\. `POST /payments/paystack/webhook`

&#x20;  - Sedifex verifies signature/reference/amount and marks order paid.

4\. `GET /orders/{order\_id}`

&#x20;  - Website fetches latest order/payment status for confirmation page.



\### Request/response reference



`POST /checkout/preview` request:



```json

{

&#x20; "merchant\_id": "m\_123",

&#x20; "currency": "NGN",

&#x20; "fulfillment\_type": "PICKUP",

&#x20; "delivery\_address\_id": null,

&#x20; "items": \[

&#x20;   { "type": "PRODUCT", "item\_id": "p\_1", "qty": 2 },

&#x20;   { "type": "SERVICE", "item\_id": "s\_7", "qty": 1 }

&#x20; ]

}

```



`POST /checkout/preview` response:



```json

{

&#x20; "pricing\_version": "2026-05-12-v1",

&#x20; "subtotal": 2500000,

&#x20; "tax\_total": 187500,

&#x20; "delivery\_fee": 0,

&#x20; "pre\_processing\_total": 2687500,

&#x20; "processing\_fee\_to\_add": 45000,

&#x20; "final\_total": 2732500,

&#x20; "breakdown": \[

&#x20;   { "code": "SUBTOTAL", "amount": 2500000 },

&#x20;   { "code": "TAX", "amount": 187500 },

&#x20;   { "code": "DELIVERY", "amount": 0 },

&#x20;   { "code": "PROCESSING\_FEE", "amount": 45000 }

&#x20; ]

}

```



\### Calculation order (authoritative)



1\. Resolve line prices and quantities → `subtotal`.

2\. Apply item tax rules from inventory/services → `tax\_total`.

3\. Apply fulfillment:

&#x20;  - `PICKUP` → `delivery\_fee = 0`.

&#x20;  - `DELIVERY` → compute delivery fee from configured rules.

4\. Compute:

&#x20;  - `pre\_processing\_total = subtotal + tax\_total + delivery\_fee`

5\. Compute processor recovery:

&#x20;  - `processing\_fee\_to\_add = estimate\_processing\_fee(pre\_processing\_total)`

6\. Compute:

&#x20;  - `final\_total = pre\_processing\_total + processing\_fee\_to\_add`



Sedifex must recompute these values on `checkout/create`; website-provided totals are never trusted.



\### Website rendering rules



\- Always render values returned from Sedifex (no client-side fee math).

\- Show delivery line only when `fulfillment\_type = DELIVERY`.

\- Always show processing fee line when `processing\_fee\_to\_add > 0`.

\- Re-run preview when cart, fulfillment type, or delivery address changes.



\### Validation and error contract



\- `DELIVERY\_ADDRESS\_REQUIRED` when delivery is selected without required address fields.

\- `INVALID\_FULFILLMENT\_TYPE` for unsupported fulfillment values.

\- `PRICE\_CHANGED\_REVIEW\_CART` when catalog prices changed between preview and create.

\- `PAYMENT\_AMOUNT\_MISMATCH` when webhook paid amount differs from stored `final\_total`.



\### Implementation checklist for integration teams



1\. Store merchant config (`storeId`, API key, contract version).

2\. Build server-side adapter for preview/create/order-status calls.

3\. Add checkout UI toggle for pickup vs delivery.

4\. Bind UI totals to Sedifex response fields (`subtotal`, `tax\_total`, `delivery\_fee`, `processing\_fee\_to\_add`, `final\_total`).

5\. Persist IDs for reconciliation:

&#x20;  - `payment\_reference`

&#x20;  - `sedifexOrderId`

&#x20;  - `clientOrderId`

6\. Handle webhook-driven paid state before showing final success.

7\. Log `x-sedifex-request-id` on failures for support.



\### `POST /integration/checkout/create` (authenticated)



Purpose: client website server asks Sedifex to create a hosted checkout session.



Headers:



\- `x-api-key: <integration\_key>`

\- `X-Sedifex-Contract-Version: 2026-04-13`

\- `Content-Type: application/json`



Request body:



```json

{

&#x20; "storeId": "store\_123",

&#x20; "clientOrderId": "WEB-98452",

&#x20; "orderType": "product",

&#x20; "currency": "GHS",

&#x20; "items": \[

&#x20;   {

&#x20;     "id": "product\_1",

&#x20;     "name": "Item A",

&#x20;     "unitPrice": 45,

&#x20;     "qty": 2

&#x20;   }

&#x20; ],

&#x20; "amount": 90,

&#x20; "customer": {

&#x20;   "email": "buyer@example.com",

&#x20;   "phone": "+233200000000",

&#x20;   "name": "Buyer Name"

&#x20; },

&#x20; "returnUrl": "https://clientsite.com/payment/return",

&#x20; "metadata": {

&#x20;   "channel": "client-website",

&#x20;   "clientWebsiteId": "site\_01"

&#x20; }

}

```



Success response:



```json

{

&#x20; "ok": true,

&#x20; "reference": "store\_123\_1746880000000",

&#x20; "sedifexOrderId": "ord\_01JV...",

&#x20; "authorizationUrl": "https://checkout.paystack.com/...",

&#x20; "expiresAt": "2026-05-10T12:45:00Z"

}

```



\### `GET /integration/orders/:reference` (authenticated)



Purpose: partner poll endpoint to verify outcome when webhook is delayed/unavailable.



Success response:



```json

{

&#x20; "ok": true,

&#x20; "reference": "store\_123\_1746880000000",

&#x20; "sedifexOrderId": "ord\_01JV...",

&#x20; "storeId": "store\_123",

&#x20; "clientOrderId": "WEB-98452",

&#x20; "orderType": "product",

&#x20; "paymentStatus": "success",

&#x20; "orderStatus": "confirmed",

&#x20; "bookingStatus": null,

&#x20; "amount": 90,

&#x20; "currency": "GHS",

&#x20; "updatedAt": "2026-05-10T12:51:10Z"

}

```

\### POST /integration/webhooks/payment-status` (Sedifex outbound webhook)

For website bookings using Sedifex checkout,  standardize it like this:



When booking is first created:



bookingStatus = "booked"

paymentCollectionMode = "online\_checkout"

paymentStatus = "checkout\_created" or pending



After customer lands on return URL:



do not mark paid yet



After Sedifex receives confirmed webhook:



paymentStatus = "confirmed"

paymentConfirmedAt = now

store reference, sedifexOrderId, clientOrderId  . the return url make sure it works and lets us know the trwam has their data. YOu can proviode whatsapp or email for furhter enquries



rename that pre-checkout sedifexOrderId variable to bookingId , do not pretend you have a real sedifexOrderId until checkout returns one



Patch the website-to-Sedifex booking creation path to write syncStatus: 'pending' and syncRequestedAt when it creates/updates integrationBookings docs.



\### `POST /integration/webhooks/payment-status` (Sedifex outbound webhook)



Purpose: Sedifex sends final payment/order state updates to partner websites.



Delivery headers:



\- `Content-Type: application/json`

\- `X-Sedifex-Event: payment.succeeded | payment.failed | order.confirmed | booking.confirmed`

\- `X-Sedifex-Delivery-Id: <uuid>`

\- `X-Sedifex-Timestamp: <unix-ms>`

\- `X-Sedifex-Signature: sha256=<hmac\_of\_raw\_body>`

\- `X-Sedifex-Contract-Version: 2026-04-13`



Webhook payload:



```json

{

&#x20; "event": "payment.succeeded",

&#x20; "deliveryId": "d\_01JV....",

&#x20; "sentAt": "2026-05-10T12:51:04Z",

&#x20; "storeId": "store\_123",

&#x20; "reference": "store\_123\_1746880000000",

&#x20; "sedifexOrderId": "ord\_01JV...",

&#x20; "clientOrderId": "WEB-98452",

&#x20; "orderType": "product",

&#x20; "amount": 90,

&#x20; "currency": "GHS",

&#x20; "paymentStatus": "success",

&#x20; "paidAt": "2026-05-10T12:50:31Z",

&#x20; "fees": 1.2,

&#x20; "netAmount": 88.8

}

```



Partner receiver requirements:



1\. Return `2xx` in under 5 seconds.

2\. Process idempotently on `reference + event` (or `deliveryId`).

3\. Verify HMAC signature using the shared webhook secret.



Retry policy (when non-2xx or timeout): `1m`, `5m`, `30m`, `2h`, `12h`.



\### Golden path sequence



1\. Partner website fetches catalog via `/v1IntegrationProducts` (server-side) or `/integrationPublicCatalog` (public mode).

2\. Buyer selects product/service.

3\. Partner server calls `POST /integration/checkout/create`.

4\. Buyer completes payment on returned Paystack `authorizationUrl`.

5\. Paystack webhook updates Sedifex internal payment state.

6\. Sedifex emits `POST /integration/webhooks/payment-status` to partner website.

7\. Partner website updates local order status and storefront UI.

8\. If webhook is delayed, partner polls `GET /integration/orders/:reference`.



\### Service booking integration flow



Use this exact flow when the website is selling \*\*services\*\* (`orderType: "service"`).



\*\*Step 1: Create the booking\*\*



`POST /v1IntegrationBookings?storeId=store\_123`



```json

{

&#x20; "serviceId": "svc\_travel\_001",

&#x20; "customer": {

&#x20;   "name": "Ada Mensah",

&#x20;   "phone": "+233201234567",

&#x20;   "email": "ada@example.com"

&#x20; },

&#x20; "bookingDate": "2026-08-01",

&#x20; "bookingTime": "10:00 AM",

&#x20; "notes": "Schengen support",

&#x20; "paymentMethod": "paystack",

&#x20; "paymentAmount": 250,

&#x20; "attributes": {

&#x20;   "source": "website\_booking\_form"

&#x20; }

}

```



Store the returned `bookingId`.



\*\*Step 2: Create hosted checkout\*\*



`POST /integration/checkout/create`



```json

{

&#x20; "storeId": "store\_123",

&#x20; "clientOrderId": "BOOKING-bk\_001",

&#x20; "orderType": "service",

&#x20; "currency": "GHS",

&#x20; "amount": 250,

&#x20; "customer": {

&#x20;   "email": "ada@example.com",

&#x20;   "phone": "+233201234567",

&#x20;   "name": "Ada Mensah"

&#x20; },

&#x20; "returnUrl": "https://clientsite.com/payment/return",

&#x20; "metadata": {

&#x20;   "bookingId": "bk\_001",

&#x20;   "channel": "client-website"

&#x20; }

}

```



Redirect the customer to the returned `authorizationUrl`.



\*\*Step 3: Confirm final status\*\*



Do \*\*not\*\* trust browser return alone. Confirm with:



\- Sedifex payment webhook (`POST /integration/webhooks/payment-status` delivery), or

\- `GET /integration/orders/:reference`



\*\*Step 4: Update website UI\*\*



Render booking/payment state from Sedifex values:



\- `pending`

\- `awaiting\_verification`

\- `partial`

\- `confirmed`

\- `cancelled`



\### Security and go-live checklist



\- Keep Sedifex API key server-side only (never in browser code).

\- Persist `reference`, `sedifexOrderId`, and `clientOrderId` before redirecting checkout.

\- Treat Sedifex webhook events as authoritative final state.

\- Validate webhook signature and timestamp tolerance.

\- Force-test retry path by returning `500` once from webhook receiver.

\- Validate reconciliation export includes `reference`, amounts, and final status.



\## Booking + Payment state model (service bookings)



Sedifex now tracks \*\*independent\*\* booking and payment states:

\- `bookingStatus`: `booked | cancelled | rescheduled`

\- `paymentCollectionMode`: `online\_checkout | manual\_transfer | momo\_manual | cash | free | unknown`

\- `paymentStatus`: `not\_required | pending | checkout\_created | awaiting\_verification | partial | confirmed | failed | expired | rejected | refunded`

\- `customerPaymentClaim`: `not\_claimed | claimed\_paid | claimed\_partial | not\_paid`



\### Security rules

\- Website/public booking submissions are \*\*never\*\* allowed to self-set `paymentStatus=confirmed`.

\- A customer claim like “I paid” is stored as `customerPaymentClaim=claimed\_paid` and `paymentStatus=awaiting\_verification`.

\- Checkout `returnUrl` only means redirect completed; it is \*\*not\*\* payment proof.

\- Authoritative payment truth is from webhook confirmation and/or `GET /integration/orders/:reference`.



\### Service checkout linkage

`POST /integration/checkout/create` supports `orderType=service` and metadata (`bookingId`, `clientOrderId`). Sedifex stores and reconciles: `bookingId`, `reference`, `sedifexOrderId`, `clientOrderId`.



\### Manual verification

Use `POST /integration/booking/payment/verify` from trusted server/admin flows:

\- `action=confirm` -> sets `paymentStatus=confirmed` (or `partial` when outstanding remains)

\- `action=partial` -> sets `paymentStatus=partial`

\- `action=reject` -> sets `paymentStatus=rejected`



\### Flat Apps Script payload additions

Apps Script webhook targets continue receiving \*\*flat payloads\*\* and now include:

`bookingStatus`, `paymentCollectionMode`, `paymentStatus`, `customerPaymentClaim`, `paymentReference`, `manualPaymentReference`, `sedifexOrderId`, `clientOrderId`, `paymentConfirmedAt`, `paymentVerifiedAt`, `depositAmount`, `paymentAmount`, `amountOutstanding`, etc.



\### Example Apps Script payloads



```json

{"eventType":"payment\_pending","bookingStatus":"booked","paymentCollectionMode":"online\_checkout","paymentStatus":"pending"}

{"eventType":"payment\_awaiting\_verification","bookingStatus":"booked","paymentCollectionMode":"manual\_transfer","paymentStatus":"awaiting\_verification","customerPaymentClaim":"claimed\_paid"}

{"eventType":"payment\_confirmed","bookingStatus":"booked","paymentCollectionMode":"online\_checkout","paymentStatus":"confirmed"}

{"eventType":"payment\_partial","bookingStatus":"booked","paymentCollectionMode":"manual\_transfer","paymentStatus":"partial","depositAmount":50,"paymentAmount":100,"amountOutstanding":50}

```



