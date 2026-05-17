# Sedifex Integration API Guide (v1)

This public guide explains how partner websites and backend services should authenticate, call Sedifex endpoints, cache responses, create bookings/orders, and migrate safely as the API evolves.

Internal Sedifex team systems are intentionally excluded from this developer portal.

## Current source-of-truth model

Use this mapping for client/partner integrations:

| Domain | Source of truth | Dashboard surface |
|---|---|---|
| Product orders from client websites | `integrationOrders` | Online Orders |
| Pay-on-delivery product orders | `integrationOrders` | Online Orders / Pay on Delivery |
| Service bookings from client websites | `integrationBookings` | Bookings / Online Orders |
| Lead-only requests | `checkoutRequests` | Leads/support workflow |
| Product comments/favorites from external sites, where enabled | `engagement_*` collections/API | Product Engagement |
| Webhook logs | `integrationWebhookEvents` | Debug/audit only |

Do not use `integrationBookings` for product purchases. Do not use webhook logs as the order record. Sedifex remains the authoritative record for checkout, booking, payment, and engagement state.

## 1) Authentication and API keys

Set these values in your website/server environment before calling Sedifex integration endpoints:

```bash
SEDIFEX_API_BASE_URL=https://us-central1-sedifex-web.cloudfunctions.net
SEDIFEX_STORE_ID=<store_id>
SEDIFEX_INTEGRATION_API_KEY=<store_integration_key>
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

### `GET /v1IntegrationProducts?storeId=<storeId>`

Use this authenticated endpoint for client websites and partner backends.

Response includes product/service records such as:

```json
{
  "products": [
    {
      "id": "product_123",
      "storeId": "store_123",
      "name": "Product name",
      "category": "Category",
      "description": "Description",
      "price": 100,
      "stockCount": 12,
      "itemType": "product",
      "imageUrl": "https://...",
      "imageUrls": ["https://..."],
      "imageAlt": "Product image",
      "updatedAt": "2026-05-17T00:00:00.000Z"
    }
  ]
}
```

Recommended cache: `30–120` seconds for active catalogs.

### Promo/gallery reads

```txt
GET /v1IntegrationPromo?storeId=<storeId>
GET /integrationGallery?storeId=<storeId>
```

Use these for client website banners, promo pages, and image sections.

## 4) Checkout preview and checkout create

For product checkout, your website backend should call Sedifex. Do not call checkout endpoints directly from browser code.

Recommended backend flow:

1. Receive cart/customer details from the website.
2. Validate products/services and quantities server-side.
3. Normalize item IDs.
4. Call preview if you need a total before payment.
5. Call checkout create to receive a payment URL.
6. Redirect customer to Paystack or the configured payment flow.
7. Show order status from Sedifex after payment.

Core fields:

```json
{
  "storeId": "store_123",
  "merchantId": "store_123",
  "clientOrderId": "WEB-PAY-1778870000000",
  "sourceChannel": "client_website",
  "sourceLabel": "Client Website",
  "currency": "GHS",
  "items": [
    {
      "type": "PRODUCT",
      "item_type": "product",
      "item_id": "product_123",
      "qty": 1
    }
  ],
  "customer": {
    "name": "Customer Name",
    "email": "buyer@example.com",
    "phone": "+233200000000"
  },
  "returnUrl": "https://clientsite.com/checkout/success",
  "cancelUrl": "https://clientsite.com/checkout/failed"
}
```

For Paystack split checkout configuration, see `docs/paystack-split-checkout-url.md`.

## 5) POST /v1IntegrationBookings

Use bookings for services, appointments, classes, school registration, travel enquiries, and other time/slot-based flows.

Example request:

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
    "depositAmount": 0,
    "confirmed": false,
    "reference": "WEB-BOOKING-1778870000000"
  },
  "attributes": {
    "source": "client_website_booking_form",
    "branchLocationId": "branch_1",
    "eventLocation": "Tema",
    "customerStayLocation": "Community 25",
    "notes": "Optional notes"
  }
}
```

Recommended booking fields:

- `serviceId`
- `serviceName`
- `bookingDate`
- `bookingTime`
- `customer.name`
- `customer.email`
- `customer.phone`
- `payment.method`
- `payment.amount`
- `payment.confirmed`
- `attributes.source`
- `attributes.branchLocationId`
- `attributes.notes`

## 6) Webhooks

Sedifex product webhooks may emit:

- `product.created`
- `product.updated`
- `product.deleted`

Verify webhook signatures using the raw request body and the endpoint secret. See `docs/webhooks-signature-verification.md`.

Minimum handler behavior:

1. Accept only `POST` requests.
2. Verify `X-Sedifex-Signature`.
3. Store `X-Sedifex-Event-Id` for idempotency.
4. Return `2xx` quickly after durable processing or queueing.
5. Revalidate only the affected store/product pages.

## 7) Error handling

Recommended behavior:

- Treat `401/403` as key/config problems.
- Treat `400 contract-version-mismatch` as deployment/config mismatch.
- Treat `404` as endpoint/path/config mismatch.
- Treat `429/5xx` as retryable with backoff.
- Log `x-sedifex-request-id` whenever available.

## 8) Caching guidance

- Product/service catalog: `30–120` seconds.
- Promo/gallery: `60–300` seconds.
- Availability: shorter, depending on booking pressure.
- Checkout totals: do not rely on stale browser totals. Confirm server-side before payment.

## 9) Security checklist

- Keep keys server-side only.
- Do not put keys in `NEXT_PUBLIC_*` variables.
- Use one key per website/backend integration.
- Rotate keys on staff changes or incidents.
- Validate customer inputs before sending to Sedifex.
- Do not trust browser-calculated totals.
- Keep raw webhook body available for signature verification.

## 10) Related guides

- `docs/integration-contract.md`
- `docs/integration-quickstart.md`
- `docs/client-website-cart-design-guide.md`
- `docs/paystack-split-checkout-url.md`
- `docs/webhooks-signature-verification.md`
- `docs/wordpress-install-guide.md`
