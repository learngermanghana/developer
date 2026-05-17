---
title: Sedifex Platform Updates 2026
description: Current public integration model for client websites, orders, bookings, payments, webhooks, and developer setup.
---

# Sedifex Platform Updates 2026

This document summarizes the public Sedifex platform model for external developers building client websites, WordPress stores, booking forms, and backend integrations.

Internal Sedifex team-only systems are not documented here.

## 1. Source-of-truth model

Use this mapping for public/client integrations:

| Domain | Source-of-truth location | Notes |
|---|---|---|
| Product orders from client websites | `integrationOrders` | Product checkout records should appear in Online Orders. |
| Pay-on-delivery product orders | `integrationOrders` | Still an order record even without online payment. |
| Service bookings from client websites | `integrationBookings` | Appointments, school registrations, service requests, and scheduled bookings. |
| Lead-only requests | `checkoutRequests` | Enquiries that are not paid orders or confirmed bookings. |
| Webhook logs | `integrationWebhookEvents` | Debug/audit only, not the customer order record. |

Do not store product purchases as bookings. Do not treat webhook logs as the permanent source of truth.

## 2. Contract versioning

Current public integration contract: `2026-04-13`.

Send it as a header:

```http
X-Sedifex-Contract-Version: 2026-04-13
```

Do not add the contract date to the URL path.

## 3. Client website checkout model

For client websites, use this flow:

```txt
Browse products/services
-> Add to cart or booking form
-> Website backend validates request
-> Website backend calls Sedifex
-> Payment/booking/order is recorded in Sedifex
-> Customer sees confirmation/status
```

Keep integration keys on the server only.

## 4. Product order guidance

Product purchases should create or update `integrationOrders`.

Recommended metadata:

- `storeId`
- `merchantId`
- `clientOrderId`
- `sourceChannel: client_website`
- `sourceLabel`
- `customer`
- `items`
- `payment.reference`
- `delivery`

## 5. Service booking guidance

Service bookings, appointments, school registrations, and travel/service requests should use `integrationBookings`.

Recommended metadata:

- `serviceId`
- `serviceName`
- `bookingDate`
- `bookingTime`
- `customer.name`
- `customer.phone`
- `customer.email`
- `payment.method`
- `payment.amount`
- `attributes.source`
- `attributes.branchLocationId`
- `attributes.notes`

## 6. Paystack split checkout

Online payments that should split between Sedifex and the merchant must use the dedicated checkout-create URL described in `docs/paystack-split-checkout-url.md`.

## 7. Webhooks

Public product webhooks may emit:

- `product.created`
- `product.updated`
- `product.deleted`

Webhook consumers should verify `X-Sedifex-Signature`, store `X-Sedifex-Event-Id` for idempotency, and return `2xx` only after durable processing or queueing.

See `docs/webhooks-signature-verification.md`.

## 8. WordPress and website integrations

For WordPress:

- `docs/wordpress-install-guide.md`
- `docs/wordpress-plugin/sedifex-sync.php`

For Next.js/client websites:

- `docs/integration-quickstart.md`
- `docs/client-website-cart-design-guide.md`
- `docs/checkout-preview-reference.md`

## 9. Go-live checklist

Before launching a client website integration:

- Integration key is stored server-side only.
- `X-Sedifex-Contract-Version` header is sent.
- `storeId` is correct.
- Product/service IDs are normalized before checkout.
- Checkout/create URL is configured if online payment is used.
- Booking payloads use `integrationBookings`, not product order records.
- Product purchases use `integrationOrders`, not bookings.
- Webhooks verify signatures.
- Logs capture `x-sedifex-request-id`.
- Customer success page shows reference, amount, and friendly status.
