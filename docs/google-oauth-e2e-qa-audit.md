# Sedifex Google OAuth Migration: End-to-End QA Checklist & Implementation Audit

## Scope reviewed

This audit covers the shared Google OAuth migration across:

- Shared OAuth start/callback/status APIs (`/api/google/oauth-start`, `/api/google/oauth-callback`, `/api/google/status`)
- Unified token persistence (`integrations.googleOAuth` + integration-specific mirrors)
- Ads, Business Profile, and Merchant connection experiences
- Reconnect/error handling and callback query cleanup
- Account Overview integration status behavior

Primary files reviewed:

- `web/api/_google-oauth.ts`
- `web/api/google/oauth-start.ts`
- `web/api/google/oauth-callback.ts`
- `web/api/google/status.ts`
- `web/src/api/googleIntegrations.ts`
- `web/src/utils/googleOAuthCallback.ts`
- `web/src/components/GoogleConnectionStatusCard.tsx`
- `web/src/components/GoogleIntegrationSettings.tsx`
- `web/src/pages/AdsCampaigns.tsx`
- `web/src/pages/GoogleBusinessProfile.tsx`
- `web/src/pages/GoogleShopping.tsx`
- `functions/src/googleBusinessProfile.ts`
- `functions/src/googleShopping.ts`

---

## Practical end-to-end manual QA checklist

> Run all cases in a staging project with a fresh test store and a dedicated Google test account. Keep browser DevTools open (Network + Application > Storage) and Firestore console open for verification.

### 0) Baseline setup (before every scenario)

- [ ] Confirm `APP_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and redirect URI env values are correct and match Google Cloud OAuth client settings.
- [ ] Verify test user is owner/admin of the store.
- [ ] Ensure no stale callback params in URL before starting (`googleOAuth`, `message`, `integrations`, etc.).
- [ ] In Firestore `storeSettings/{storeId}`, snapshot pre-test values under:
  - [ ] `integrations.googleOAuth`
  - [ ] `integrations.googleAds`
  - [ ] `integrations.googleBusinessProfile`
  - [ ] `integrations.googleMerchant`
  - [ ] `googleAdsAutomation.connection`
  - [ ] `googleShopping.connection`

---

### 1) Fresh store: no Google connection

**Goal:** First connect path works and status surfaces correctly.

- [ ] Open Account Overview → Integrations and verify all rows show not connected / needs permission.
- [ ] Open Ads page and click Connect (with valid Ads identity fields if required).
- [ ] Complete Google consent.
- [ ] Verify redirect lands on `.../account?tab=integrations` (or the initiating page depending flow) and success message is visible.
- [ ] Verify callback params are removed from URL after page hydration (history.replaceState behavior).
- [ ] Verify Firestore now has:
  - [ ] `integrations.googleOAuth.accessToken`
  - [ ] `integrations.googleOAuth.scope` containing adwords when Ads was requested
  - [ ] `integrations.googleAds.*` stamped
  - [ ] `googleAdsAutomation.connection.connected = true`
- [ ] Verify `POST /api/google/status` shows:
  - [ ] `connected = true`
  - [ ] `integrations.ads.hasRequiredScope = true`

---

### 2) Ads-only connection

**Goal:** Ads can be connected independently without forcing Business/Merchant scopes.

- [ ] Start OAuth with integration `ads` only.
- [ ] Confirm Google consent lists Ads scope (and base openid/email/profile).
- [ ] After callback, verify status card:
  - [ ] Ads = Connected
  - [ ] Business = Needs permission
  - [ ] Merchant = Needs permission
- [ ] Verify Ads campaign endpoints can proceed without `google-ads-not-connected`/missing-token errors.

---

### 3) Business-only connection

**Goal:** Business connection works and Business uploader unlocks.

- [ ] Start OAuth from Google Business Profile page.
- [ ] Confirm consent includes `business.manage`.
- [ ] After callback, verify Business page state shows connected and uploader section appears.
- [ ] Upload a test media item to a location.
- [ ] Confirm API does not return `google-business-not-connected` or `google-business-missing-tokens`.
- [ ] Confirm Ads and Merchant statuses remain Needs permission unless already granted.

---

### 4) Merchant-only connection

**Goal:** Merchant connect + selection and sync preconditions work.

- [ ] Start OAuth from Google Shopping page.
- [ ] Confirm consent includes `content` scope.
- [ ] If multiple Merchant accounts are available:
  - [ ] Verify selection UI appears.
  - [ ] Select one account and save.
  - [ ] Confirm connected merchant ID is rendered.
- [ ] Run incremental sync and confirm request succeeds or returns actionable feed errors (not auth errors).
- [ ] Confirm status card shows Merchant connected while other non-granted integrations remain Needs permission.

---

### 5) Incremental scope upgrades

**Goal:** Existing Google connection can add scopes without losing previous capability.

Example sequence: Ads-only → add Business → add Merchant.

- [ ] Connect Ads first.
- [ ] Start OAuth for Business next.
- [ ] Verify `integrations.googleOAuth.scope` now includes both adwords + business scopes.
- [ ] Verify Ads remains operational after Business upgrade (campaign metrics/calls still work).
- [ ] Start OAuth for Merchant and repeat verification.
- [ ] Verify final `/api/google/status` shows all requested integrations `hasRequiredScope=true`.
- [ ] Regression check: previously connected integrations remain connected after each upgrade.

---

### 6) Reconnect after token loss/revocation

**Goal:** Reauth UX and recovery are clear when refresh/access tokens become invalid.

- [ ] Simulate token loss (staging only) by removing/invalidating refresh token in Firestore.
- [ ] Trigger Ads/Business/Merchant operation that requires Google API.
- [ ] Verify UI shows reconnect guidance (e.g., “Reconnect Google” where reconnect-required error is inferred).
- [ ] Re-run OAuth and confirm operation succeeds afterward.
- [ ] Verify no stale error query params remain in URL after reconnect callback.

---

### 7) Callback param cleanup after redirect

**Goal:** OAuth callback params are one-time and cleared reliably.

- [ ] Complete a successful OAuth flow and inspect URL immediately after redirect.
- [ ] Confirm params are parsed into UI message.
- [ ] Confirm params are removed via history replacement:
  - [ ] `googleOAuth`
  - [ ] `integrations`
  - [ ] `message`
  - [ ] `merchantId`
  - [ ] `pendingSelectionId`
  - [ ] `refreshTokenMissing`
  - [ ] `storeId`
- [ ] Refresh page and verify message does not replay from stale query state.

---

### 8) Account Overview integration status consistency

**Goal:** Account Overview and per-product pages agree on status.

- [ ] On Account Overview → Google Integrations, record three statuses.
- [ ] Cross-check same store on Ads, Google Shopping, Google Business pages.
- [ ] Ensure each page’s CTA label matches status logic:
  - [ ] No shared Google connection: “Connect Google”
  - [ ] Shared connection but missing scope: “Grant ... access”
  - [ ] Scope present: “Connected” / upgrade-refresh CTA
- [ ] Verify status survives full refresh and navigation between tabs/pages.

---

## Most likely remaining failure points

1. **Refresh token can be lost on incremental consent responses that omit `refresh_token`.**
   - Historically, Google may omit `refresh_token` in some follow-up authorizations.
   - If overwritten/deleted, later token refresh fails and reconnect is forced unexpectedly.

2. **Scope/status drift between shared and integration-specific documents.**
   - Shared status is driven by `integrations.googleOAuth.scope`, while feature APIs may read integration-specific docs.
   - Any partial write or stale mirror may cause UI “connected” with backend auth failures.

3. **Reconnect detection relies on string matching for errors.**
   - `isReconnectRequiredError()` pattern matching can miss new provider error text variants.

4. **State expiration race (10-minute OAuth state TTL).**
   - Slow consent completion can produce `expired-state` and appear as a generic callback failure.

5. **Merchant multi-account handoff is sensitive to callback params.**
   - If param cleanup runs before processing (or if URL is modified by extensions), account selection can be skipped.

---

## Tiny production-readiness fixes

### Applied now

- **Preserve existing refresh tokens when Google token response omits `refresh_token`.**
  - `storeUnifiedGoogleTokens()` now reads existing integration tokens and keeps previous refresh token for shared OAuth, Ads, Business, and Merchant records instead of deleting it.
  - This reduces unexpected reconnect prompts after incremental scope upgrades.

### Recommended next tiny fixes (non-architectural)

1. Add a lightweight structured reconnect error code from backend APIs (instead of message parsing alone) and key UI reconnect CTA off code first, message second.
2. Add one integration test around `storeUnifiedGoogleTokens()` verifying “no new refresh token” preserves prior token.
3. Log an explicit metric/event for callback failures by reason (`invalid-state`, `expired-state`, `token-exchange-failed`) to speed incident triage.

---

## Quick implementation audit summary

- Shared OAuth flow is correctly centralized (`oauth-start` → Google consent → shared callback).
- Scope unioning supports incremental permission upgrades.
- Callback query parsing/cleanup is implemented in all major Google surfaces.
- Shared status endpoint correctly reports both overall connection and per-integration required-scope state.
- Cross-page status card design is consistent.
- Main risk was refresh-token durability during incremental upgrades; this is now patched.
