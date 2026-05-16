---
title: Sedifex Platform Updates 2026
description: Current source-of-truth integration model for Sedifex Market, client websites, orders, bookings, payments, engagement, and dashboard moderation.
---

# Sedifex Platform Updates 2026

This document summarizes the latest Sedifex platform updates and how developers should integrate with Sedifex going forward.

Sedifex is now designed as the **source of truth** for commerce, service bookings, marketplace checkout, merchant website checkout, and product engagement.

## 1. Source-of-truth model

Use this mapping everywhere:

| Domain | Source-of-truth location | Notes |
|---|---|---|
| Product orders | `integrationOrders` | Sedifex Market product orders and merchant website product checkout orders. |
| Service bookings | `integrationBookings` | Sedifex Market services, merchant website services, school registrations, appointments, and manual service requests. |
| Lead-only requests | `checkoutRequests` | Enquiries that are not paid orders or bookings. |
| Payment/webhook logs | `integrationWebhookEvents` | Event logs only. Do not treat this as the order record. |
| Product comments | `engagement_comments` | Cross-platform comments from Sedifex Market and merchant websites. |
| Product favorites | `engagement_favorites` | Cross-platform favorites/reactions. |
| Engagement summary | `engagement_threads` | Aggregates by canonical product key. |

Do **not** create separate permanent order/comment systems on merchant websites. Websites should submit to Sedifex and read status back from Sedifex.

## 2. Dashboard update: Online Orders

The old marketplace-only view has been reframed as:

```txt
Online Orders
```

Route:

```txt
/online-orders
```

Legacy route:

```txt
/marketplace-orders → redirects to /online-orders
```

The Online Orders dashboard is the merchant view for all external commerce activity:

```txt
All Product Orders
Service Bookings
Sedifex Market
Client Website
Pay on Delivery
Manual Payment
Online Paid
```

It reads from:

```txt
integrationOrders
integrationBookings
```

During launch, Sedifex controls confirmation/follow-up. Stores can view and contact customers, but Sedifex support manages marketplace confirmation to avoid uncontrolled status changes.

## 3. Required channel metadata

Every external order/booking should save enough metadata for support and reporting.

Required/recommended fields:

```ts
{
  sourceChannel: 'sedifex_market' | 'client_website' | 'sedifex_custom_page';
  source_channel: string;
  sourceLabel: string;
  source_label: string;
  orderType: 'product' | 'service';
  clientOrderId: string;
  client_order_id: string;
  sedifexOrderId: string;
  reference: string;
  storeId: string;
  merchantId: string;
}
```

Recommended source labels:

```txt
Sedifex Market
Client Website
Sedifex Public Page
Hajia Slay Shop Website
```

## 4. Product checkout model

### 4.1 Sedifex Market product checkout

Customer buys on Sedifex Market:

```txt
Sedifex Market product page
→ product order request
→ integrationOrders
→ Online Orders dashboard
```

Online payment:

```txt
paymentCollectionMode: online_checkout
paymentStatus: pending | success | confirmed
orderStatus: processing | confirmed | delivered
sourceChannel: sedifex_market
```

Pay on delivery:

```txt
paymentCollectionMode: pay_on_delivery
paymentStatus: pending_cash_collection
orderStatus: pending_delivery
sourceChannel: sedifex_market
feePolicy.policyKey: sedifex_free_pay_on_delivery_v1
```

### 4.2 Merchant website product checkout

Merchant websites should fetch products from Sedifex and submit orders back to Sedifex.

Recommended website flow:

```txt
1. Fetch catalog server-side from Sedifex.
2. Render product page.
3. Place checkout directly on the product page.
4. Customer selects Online Payment or Pay on Delivery.
5. Website server submits order to Sedifex.
6. Sedifex creates integrationOrders record.
7. Store sees it in Online Orders.
```

For simple storefronts, an inline product-page checkout is preferred over a separate checkout page. A separate `/checkout` route is only needed later for a full multi-product cart flow.

### 4.3 Product pay-on-delivery request

Use the product order request endpoint for pay-on-delivery/manual delivery orders.

```http
POST /integration/orders/request
```

Example payload:

```json
{
  "merchantId": "STORE_ID",
  "storeId": "STORE_ID",
  "productId": "SEDIFEX_PRODUCT_ID",
  "productName": "Product name",
  "quantity": 1,
  "unitPrice": 70,
  "currency": "GHS",
  "sourceChannel": "client_website",
  "sourceLabel": "Hajia Slay Shop Website",
  "clientOrderId": "HAJ-POD-1778870000000",
  "customer": {
    "name": "Buyer Name",
    "email": "buyer@example.com",
    "phone": "+233200000000"
  },
  "delivery": {
    "location": "Accra, Ghana",
    "notes": "Call before delivery"
  }
}
```

Expected Sedifex behavior:

```txt
Creates integrationOrders
Calculates subtotal from product price × quantity
Sets fee policy to free launch for pay on delivery
Shows under Online Orders → Pay on Delivery
```

## 5. Payment fee model

Online payments keep the standardized checkout fee model.

Pay on delivery is free during launch:

```ts
{
  policyKey: 'sedifex_free_pay_on_delivery_v1',
  customerProcessingFeeMajor: 0,
  sedifexCommissionMajor: 0,
  customerPaysProcessingFee: false,
  merchantPaysCommission: false,
  commissionCollectionMode: 'free_launch_period'
}
```

Later, Sedifex can introduce a pay-on-delivery commission or subscription rule, but the current launch behavior is free.

## 6. Service booking model

Services should be treated as bookings, not product orders.

Use:

```txt
integrationBookings
```

Service booking flow:

```txt
Customer selects service
→ create booking first
→ optional checkout if online payment is enabled
→ webhook confirms payment
→ store sees booking in Online Orders and Bookings
```

Manual service booking:

```txt
bookingStatus: pending_store_confirmation
paymentCollectionMode: manual | manual_transfer | cash
paymentStatus: pending_manual | awaiting_verification
orderType: service
sourceChannel: sedifex_market | client_website
```

Online service booking:

```txt
bookingStatus: pending_store_confirmation
paymentCollectionMode: online_checkout
paymentStatus: pending | checkout_created | confirmed
orderType: service
reference: Sedifex/Paystack reference
```

For service bookings, do not trust browser return alone. Final state must come from Sedifex webhook verification or order/status polling.

## 7. Customer-facing status labels

Customer apps should display friendly labels instead of raw internal statuses.

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

## 8. Product engagement model

Sedifex now supports cross-platform product engagement.

Product comments/favorites can come from:

```txt
Sedifex Market
Merchant websites
Sedifex custom/public pages
```

They all resolve to the same canonical key:

```ts
canonicalProductKey = `${storeId}:${sourceProductId}`
```

Collections:

```txt
engagement_threads/{canonicalProductKey}
engagement_comments/{commentId}
engagement_favorites/{canonicalProductKey_userId}
```

### Comment fields

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

### Favorite fields

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

## 9. Engagement API shape

Sedifex Market currently supports a local fallback API if a central engagement API base URL is not configured:

```txt
GET  /api/engagement/comments
POST /api/engagement/comments
GET  /api/engagement/summary
POST /api/engagement/reactions
```

Recommended central Sedifex API names:

```txt
GET    /v1/engagement/comments
POST   /v1/engagement/comments
PATCH  /v1/engagement/comments/{id}
GET    /v1/engagement/summary
POST   /v1/engagement/favorites
DELETE /v1/engagement/favorites
POST   /v1/engagement/resolve
```

Comment list query should accept:

```txt
public_product_id
store_id
source_product_id
```

Example write payload:

```json
{
  "public_product_id": "PUBLIC_PRODUCT_DOC_ID",
  "store_id": "STORE_ID",
  "source_product_id": "SEDIFEX_PRODUCT_ID",
  "text": "I like this product"
}
```

## 10. Product Engagement dashboard

Sedifex dashboard now includes:

```txt
Product Engagement
/product-engagement
```

Stores can moderate comments from their store:

```txt
Approve
Hide
Reject
```

Moderation behavior:

```txt
Approve → status: approved, visibility: public
Hide    → status: rejected, visibility: store_only
Reject  → status: rejected, visibility: store_only
```

## 11. Firestore rules and indexes

The Sedifex core repo includes rules/indexes for engagement:

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

## 12. Client website checkout recommendation

For simple product websites, use product-page checkout instead of a separate checkout page.

Recommended product page sections:

```txt
Product details
Quantity
Full name
Phone
Email
Delivery location
Payment method
Pay online
Pay on delivery
WhatsApp enquiry
```

The website should:

```txt
Fetch catalog from Sedifex server-side
Keep API keys server-side only
Use product.id/sourceProductId from Sedifex
Submit checkout/order to Sedifex
Save sourceChannel: client_website
Show status from Sedifex
```

## 13. Environment variables for merchant websites

```bash
SEDIFEX_API_BASE_URL=https://us-central1-sedifex-web.cloudfunctions.net
SEDIFEX_STORE_ID=STORE_ID
SEDIFEX_INTEGRATION_KEY=sk_live_xxx
SEDIFEX_CONTRACT_VERSION=2026-04-13
SEDIFEX_ENGAGEMENT_API_BASE_URL=https://api.sedifex.com/v1/engagement
```

For Sedifex Market:

```bash
NEXT_PUBLIC_SEDIFEX_ENGAGEMENT_API_BASE_URL=https://api.sedifex.com/v1/engagement
SEDIFEX_ENGAGEMENT_API_BASE_URL=https://api.sedifex.com/v1/engagement
```

If engagement env vars are omitted, Sedifex Market can use its local fallback API.

## 14. Go-live checklist

Before launching a website integration:

- Products load from Sedifex catalog, not a stale local array.
- Product orders write to `integrationOrders`.
- Service bookings write to `integrationBookings`.
- Payment keys are server-side only.
- Online payment uses Sedifex checkout/create and webhook confirmation.
- Pay on delivery uses `/integration/orders/request`.
- Website sends `sourceChannel: client_website`.
- Website sends `clientOrderId` and keeps Sedifex `reference`.
- Customer phone and delivery location are collected for product orders.
- Engagement comments/favorites use `storeId + sourceProductId`.
- Store can see results in Sedifex dashboard:
  - Online Orders
  - Product Engagement
  - Bookings

## 15. Recommended status flow

Product pay-on-delivery:

```txt
pending_cash_collection + pending_delivery
→ Sedifex follow-up
→ delivered/cash_collected later
```

Product online payment:

```txt
pending_payment
→ payment webhook success
→ confirmed
→ delivered
```

Service booking:

```txt
pending_store_confirmation
→ confirmed_by_store or Sedifex follow-up
→ completed
```

During launch, Sedifex support should manage confirmation so merchants do not accidentally change official marketplace/order state too early.
