# Checkout Preview Reference (Sedifex API ↔ Client Website)

This document explains how a client website should request a trusted checkout preview from Sedifex before creating payment.

## Purpose

The browser cart can show an estimated subtotal, but the trusted total should come from Sedifex/backend logic before payment.

Use checkout preview when you need to show:

- item subtotal
- service fee / transfer fee
- final customer total
- store amount
- validation errors before payment

## Endpoint

```txt
POST /integration/checkout/preview
```

Send the request from your website backend, not directly from the browser.

## Required headers

```http
x-api-key: <integration_key>
X-Sedifex-Contract-Version: 2026-04-13
Content-Type: application/json
Accept: application/json
```

## Request example

```json
{
  "storeId": "store_123",
  "merchantId": "store_123",
  "currency": "GHS",
  "fulfillment_type": "DELIVERY",
  "items": [
    {
      "type": "PRODUCT",
      "item_type": "product",
      "item_id": "product_1",
      "qty": 2
    }
  ],
  "customer": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "+233200000000"
  },
  "delivery": {
    "location": "Tema Community 25",
    "notes": "Call before delivery"
  },
  "sourceChannel": "client_website",
  "sourceLabel": "Client Website"
}
```

## Response example

```json
{
  "ok": true,
  "currency": "GHS",
  "subtotal": 200,
  "transferFee": 3.9,
  "customerTotal": 203.9,
  "sedifexServiceFee": 6,
  "storeReceives": 194,
  "items": [
    {
      "item_id": "product_1",
      "name": "Product name",
      "qty": 2,
      "unitPrice": 100,
      "lineTotal": 200
    }
  ]
}
```

## Validation rules

Your website backend should validate these before calling preview:

- `storeId` is configured.
- Integration key exists server-side.
- Cart is not empty.
- Quantity is at least `1`.
- Item IDs are raw Sedifex IDs, not display IDs with extra prefixes.
- Customer phone/email format is reasonable.

## ID normalization reminder

If your frontend display ID includes a store prefix, remove it before sending checkout data to Sedifex.

```ts
function normalizeSedifexItemId(rawId: string, storeId: string) {
  const id = rawId.trim()
  const prefix = `${storeId}_`
  return storeId && id.startsWith(prefix) ? id.slice(prefix.length) : id
}
```

## Recommended flow

```txt
Customer cart
  -> website backend validates cart
  -> website backend calls Sedifex checkout preview
  -> website shows trusted total
  -> customer confirms
  -> website backend calls checkout create
  -> customer pays
  -> Sedifex records order/payment state
```

## Related docs

- `docs/client-website-cart-design-guide.md`
- `docs/paystack-split-checkout-url.md`
- `docs/integration-api-guide.md`
