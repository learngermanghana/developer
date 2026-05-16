# Sedifex Integration API Guide (v1)

This guide explains how third-party clients should authenticate, call endpoints, cache/deduplicate responses, and migrate safely as the API evolves.

> Latest platform reference: see **Sedifex Platform Updates 2026** for the current source-of-truth model covering Online Orders, client website checkout, Sedifex Market checkout, service bookings, product engagement, moderation, Firestore rules, and go-live checklists.

## Current source-of-truth model

Use this mapping for all integrations:

| Domain | Source of truth | Dashboard surface |
|---|---|---|
| Product orders from Sedifex Market | `integrationOrders` | Online Orders |
| Product orders from client websites | `integrationOrders` | Online Orders |
| Pay-on-delivery product orders | `integrationOrders` | Online Orders → Pay on Delivery |
| Service bookings from Sedifex Market | `integrationBookings` | Bookings + Online Orders |
| Service bookings from client websites | `integrationBookings` | Bookings + Online Orders |
| Lead-only requests | `checkoutRequests` | Leads/support workflow |
| Product comments/favorites | `engagement_*` collections/API | Product Engagement |
| Webhook logs | `integrationWebhookEvents` | Debug/audit only |

Do not use `integrationBookings` for product purchases. Do not use webhook logs as the order record. Sedifex remains the authoritative record for checkout, booking, payment, and engagement state.

## 1) Authentication and API keys

### Required integration secrets/config

Set these values in your website/server environment before calling Sedifex integration endpoints:

- `SEDIFEX_INTEGRATION_API_KEY` or `SEDIFEX_INTEGRATION_KEY` → your integration key.
- `SEDIFEX_API_BASE_URL` or `SEDIFEX_INTEGRATION_API_BASE_URL` → API base URL, typically `https://us-central1-sedifex-web.cloudfunctions.net`.
- `SEDIFEX_STORE_ID` → store id to query in `?storeId=<storeId>`.

Example server-side env:

```bash
SEDIFEX_API_BASE_URL=https://us-central1-sedifex-web.cloudfunctions.net
SEDIFEX_STORE_ID=store_123
SEDIFEX_INTEGRATION_API_KEY=sk_live_xxx
SEDIFEX_CONTRACT_VERSION=2026-04-13
```

Rules:

1. Store keys server-side only. Never expose integration keys in browser bundles.
2. Call authenticated endpoints with:
   - `x-api-key: <integration_key>`
   - `X-Sedifex-Contract-Version: 2026-04-13`
3. Rotate keys regularly.
4. Log `x-sedifex-request-id` on failures.

## 2) Versioning contract

- Current contract version: `2026-04-13`.
- Request header: `X-Sedifex-Contract-Version`.
- Response headers:
  - `x-sedifex-contract-version`
  - `x-sedifex-request-id`

If versions mismatch, API may return:

```json
{
  "error": "contract-version-mismatch",
  "expectedVersion": "2026-04-13",
  "receivedVersion": "2026-01-01"
}
```

## 3) Catalog endpoints

### `GET /v1/products` public marketplace feed

Query parameters:

- `sort`: `store-diverse` | `newest` | `price` | `featured`
- `page`: 1-based page number.
- `pageSize` or `limit`: products per page.
- `maxPerStore`: optional cap per store on one page.

Response shape:

```json
{
  "sort": "store-diverse",
  "page": 1,
  "pageSize": 24,
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
      "updatedAt": "2026-04-13T00:00:00.000Z"
    }
  ]
}
```

### `GET /v1IntegrationProducts?storeId=<storeId>` authenticated catalog

Recommended for merchant websites.

```json
{
  "storeId": "store_123",
  "products": [],
  "publicProducts": [],
  "publicServices": []
}
```

Use:

- `publicProducts` for physical/product checkout pages.
- `publicServices` for services, classes, appointments, and registrations.

## 4) Product checkout from websites

For simple product websites, put checkout directly on the product page. A separate checkout page is only needed for multi-product cart flows.

Recommended product page fields:

```txt
Quantity
Full name
Phone
Email
Delivery location
Payment method
Order notes
Pay online
Pay on delivery
WhatsApp enquiry
```

### Product online payment

Use:

```http
POST /integration/checkout/create
```

Example payload:

```json
{
  "storeId": "store_123",
  "merchantId": "store_123",
  "clientOrderId": "WEB-PAY-1778870000000",
  "orderType": "product",
  "sourceChannel": "client_website",
  "sourceLabel": "Client Website",
  "currency": "GHS",
  "cart": [
    {
      "productId": "product_1",
      "merchantId": "store_123",
      "quantity": 1,
      "type": "PRODUCT"
    }
  ],
  "customer": {
    "name": "Buyer Name",
    "email": "buyer@example.com",
    "phone": "+233200000000"
  },
  "delivery": {
    "location": "Accra",
    "notes": "Call before delivery"
  },
  "returnUrl": "https://clientsite.com/payment/return",
  "metadata": {
    "channel": "client_website",
    "sourceChannel": "client_website"
  }
}
```

Success response should include a checkout URL:

```json
{
  "ok": true,
  "reference": "store_123_1778870000000",
  "sedifexOrderId": "ord_...",
  "authorizationUrl": "https://checkout.paystack.com/..."
}
```

### Product pay on delivery

Use:

```http
POST /integration/orders/request
```

Example payload:

```json
{
  "merchantId": "store_123",
  "storeId": "store_123",
  "productId": "product_1",
  "productName": "Product name",
  "quantity": 1,
  "unitPrice": 70,
  "currency": "GHS",
  "sourceChannel": "client_website",
  "sourceLabel": "Client Website",
  "clientOrderId": "WEB-POD-1778870000000",
  "customer": {
    "name": "Buyer Name",
    "email": "buyer@example.com",
    "phone": "+233200000000"
  },
  "delivery": {
    "location": "Accra",
    "notes": "Call before delivery"
  }
}
```

Current launch behavior:

```txt
paymentCollectionMode: pay_on_delivery
paymentStatus: pending_cash_collection
orderStatus: pending_delivery
feePolicy.policyKey: sedifex_free_pay_on_delivery_v1
```

Pay on delivery is free during launch:

```json
{
  "policyKey": "sedifex_free_pay_on_delivery_v1",
  "customerProcessingFeeMajor": 0,
  "sedifexCommissionMajor": 0,
  "commissionCollectionMode": "free_launch_period"
}
```

## 5) Service booking flows

Services are not product orders. Save them to:

```txt
integrationBookings
```

### Manual service booking

Use:

```http
POST /v1IntegrationBookings?storeId=<storeId>
```

or the configured service booking request endpoint.

Example:

```json
{
  "serviceId": "svc_001",
  "serviceName": "Consultation",
  "sourceChannel": "client_website",
  "sourceLabel": "Client Website",
  "clientOrderId": "BOOKING-001",
  "customer": {
    "name": "Ada Mensah",
    "phone": "+233201234567",
    "email": "ada@example.com"
  },
  "booking": {
    "preferredDate": "2026-08-01",
    "preferredTime": "10:00",
    "preferredBranch": "Accra Branch",
    "notes": "First appointment"
  },
  "payment": {
    "mode": "manual",
    "currency": "GHS"
  }
}
```

Recommended status:

```txt
bookingStatus: pending_store_confirmation
paymentCollectionMode: manual | manual_transfer | cash
paymentStatus: pending_manual | awaiting_verification
```

### Service booking with online payment

Recommended sequence:

```txt
1. Create booking first.
2. Store bookingId/clientOrderId.
3. Create checkout with orderType=service and metadata.bookingId.
4. Redirect customer to Paystack.
5. Confirm final payment state by webhook or order-status polling.
```

Do not mark payment confirmed from browser return alone.

## 6) Status labels for customer UIs

Display friendly labels instead of raw statuses.

| Internal status | Customer label |
|---|---|
| `pending_cash_collection` | Pay on delivery |
| `pending_delivery` | Waiting for store delivery |
| `pending_store_confirmation` | Waiting for store confirmation |
| `pending_manual` | Manual payment pending |
| `pending_payment` | Waiting for payment |
| `cash_collected` | Payment collected on delivery |
| `confirmed_by_store` | Confirmed by store |
| `delivered` | Delivered |
| `completed` | Completed |
| `cancelled_by_store` | Cancelled by store |

## 7) Online Orders dashboard

Merchants see external checkout activity in:

```txt
Online Orders
/online-orders
```

Tabs:

```txt
All Product Orders
Service Bookings
Sedifex Market
Client Website
Pay on Delivery
Manual Payment
Online Paid
```

Legacy route:

```txt
/marketplace-orders → /online-orders
```

During launch, stores can view and contact customers, but Sedifex support controls official marketplace/order confirmation.

## 8) Product engagement: comments and favorites

Sedifex now supports cross-platform product engagement.

All platforms should resolve to:

```ts
canonicalProductKey = `${storeId}:${sourceProductId}`
```

Collections:

```txt
engagement_threads/{canonicalProductKey}
engagement_comments/{commentId}
engagement_favorites/{canonicalProductKey_userId}
```

### Comment shape

```ts
{
  canonicalProductKey: string;
  storeId: string;
  sourceProductId: string;
  publicProductId?: string | null;
  body: string;
  authorDisplayName: string;
  originPlatform: 'sedifexmarket' | 'storefront' | 'website_api';
  status: 'pending' | 'approved' | 'rejected';
  moderationStatus: 'pending' | 'approved' | 'rejected';
  visibility: 'public' | 'store_only';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Favorite shape

```ts
{
  canonicalProductKey: string;
  storeId: string;
  sourceProductId: string;
  userId: string;
  originPlatform: 'sedifexmarket' | 'storefront' | 'website_api';
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Engagement API shape

Sedifex Market fallback:

```txt
GET  /api/engagement/comments
POST /api/engagement/comments
GET  /api/engagement/summary
POST /api/engagement/reactions
```

Recommended central Sedifex API:

```txt
GET    /v1/engagement/comments
POST   /v1/engagement/comments
PATCH  /v1/engagement/comments/{id}
GET    /v1/engagement/summary
POST   /v1/engagement/favorites
DELETE /v1/engagement/favorites
POST   /v1/engagement/resolve
```

Example comment write payload:

```json
{
  "public_product_id": "PUBLIC_PRODUCT_DOC_ID",
  "store_id": "STORE_ID",
  "source_product_id": "SEDIFEX_PRODUCT_ID",
  "text": "I like this product"
}
```

## 9) Product Engagement dashboard

Merchants moderate comments in:

```txt
Product Engagement
/product-engagement
```

Actions:

```txt
Approve → status: approved, visibility: public
Hide    → status: rejected, visibility: store_only
Reject  → status: rejected, visibility: store_only
```

## 10) Firestore rules and indexes

Core repo includes engagement rules/indexes:

```txt
firestore.rules
firestore.indexes.json
```

Important indexes:

```txt
engagement_comments: canonicalProductKey ASC, createdAt DESC
engagement_comments: storeId ASC, createdAt DESC
engagement_comments: storeId ASC, status ASC, createdAt DESC
engagement_favorites: canonicalProductKey ASC, active ASC
engagement_favorites: storeId ASC, updatedAt DESC
engagement_threads: storeId ASC, updatedAt DESC
```

Deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 11) Public blog integration

Use this endpoint when a store wants its website to pull published blog posts from Sedifex:

```txt
GET /api/public-blog?storeId=<storeId>
GET /api/public-blog?storeId=<storeId>&slug=<postSlug>
```

Responses include:

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

## 12) Other integration endpoints

### `GET /v1IntegrationPromo?storeId=<storeId>`

Returns promo profile and campaign data.

### `GET /integrationGallery?storeId=<storeId>`

Returns published gallery images.

### `GET /integrationCustomers?storeId=<storeId>`

Returns store customers for authenticated integrations.

### `GET /integrationTopSelling?storeId=<storeId>&days=30&limit=10`

Returns top-selling product analytics.

## 13) Webhook and status verification

Browser return from Paystack is not final proof.

Authoritative confirmation comes from:

```txt
Paystack webhook → Sedifex payment verification
GET /integration/orders/:reference
Sedifex outbound webhook to partner website, if configured
```

Partner websites should process webhook/status updates idempotently using:

```txt
reference + event
```

or:

```txt
deliveryId
```

## 14) Go-live checklist

Before launch, confirm:

- Products load from Sedifex catalog, not stale local arrays.
- API keys are server-side only.
- Product orders write to `integrationOrders`.
- Service bookings write to `integrationBookings`.
- Online payment uses `POST /integration/checkout/create`.
- Pay on delivery uses `POST /integration/orders/request`.
- Website sends `sourceChannel: client_website`.
- Website sends `clientOrderId` and stores Sedifex `reference`.
- Product checkout collects phone and delivery location.
- Comments/favorites resolve with `storeId + sourceProductId`.
- Store can see results in Sedifex dashboard:
  - Online Orders
  - Product Engagement
  - Bookings
