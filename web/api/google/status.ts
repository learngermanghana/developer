import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../_firebase-admin.js'
import { requireApiUser, requireStoreMembership } from '../_api-auth.js'
import {
  GOOGLE_REQUIRED_SCOPE,
  getGoogleOAuthStateForStore,
  hasScope,
  type GoogleIntegration,
} from '../_google-oauth.js'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_MERCHANT_API_BASE = 'https://shoppingcontent.googleapis.com/content/v2.1'

function requireStoreId(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('invalid-store-id')
  return raw.trim()
}

const ALL_INTEGRATIONS: GoogleIntegration[] = ['ads', 'business', 'merchant']

type ValidationSummary = {
  missingTitle: number
  missingDescription: number
  missingImage: number
  missingPrice: number
  missingBrand: number
  missingGtinOrMpnOrSku: number
  blockingCount: number
}

function parseRequestedIntegrations(rawIntegration: unknown, rawIntegrations: unknown): GoogleIntegration[] {
  const requested = Array.isArray(rawIntegrations) ? rawIntegrations : [rawIntegration]
  const unique = new Set<GoogleIntegration>()
  for (const entry of requested) {
    if (entry === 'ads' || entry === 'business' || entry === 'merchant') unique.add(entry)
  }
  return unique.size ? Array.from(unique) : ALL_INTEGRATIONS
}

function toValidationSummary(raw: unknown): ValidationSummary {
  const summary = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    missingTitle: typeof summary.missingTitle === 'number' ? summary.missingTitle : 0,
    missingDescription: typeof summary.missingDescription === 'number' ? summary.missingDescription : 0,
    missingImage: typeof summary.missingImage === 'number' ? summary.missingImage : 0,
    missingPrice: typeof summary.missingPrice === 'number' ? summary.missingPrice : 0,
    missingBrand: typeof summary.missingBrand === 'number' ? summary.missingBrand : 0,
    missingGtinOrMpnOrSku: typeof summary.missingGtinOrMpnOrSku === 'number' ? summary.missingGtinOrMpnOrSku : 0,
    blockingCount: typeof summary.blockingCount === 'number' ? summary.blockingCount : 0,
  }
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseExpiryMillis(value: unknown): number {
  if (!value) return 0
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === 'object') {
    const candidate = value as { toMillis?: () => number }
    if (typeof candidate.toMillis === 'function') return candidate.toMillis()
  }
  return 0
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_ADS_CLIENT_ID?.trim() || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() || ''
  if (!clientId || !clientSecret) throw new Error('google-oauth-config-missing')
  return { clientId, clientSecret }
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const { clientId, clientSecret } = getOAuthConfig()
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new Error(`token-refresh-failed:${String(payload.error || response.status)}`)

  const accessToken = normalizeString(payload.access_token)
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : Number(payload.expires_in || 0)
  if (!accessToken) throw new Error('token-refresh-missing-access-token')
  return { accessToken, expiresAt: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3600_000) }
}

async function canCallMerchantApi(accessToken: string, merchantId: string): Promise<boolean> {
  const authInfoRes = await fetch(`${GOOGLE_MERCHANT_API_BASE}/accounts/authinfo`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
  })
  if (!authInfoRes.ok) return false

  const productsRes = await fetch(`${GOOGLE_MERCHANT_API_BASE}/${merchantId}/products?maxResults=1`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
  })
  return productsRes.ok
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' })

  try {
    const user = await requireApiUser(req)
    const storeId = requireStoreId(req.body?.storeId)
    const requestedIntegrations = parseRequestedIntegrations(req.body?.integration, req.body?.integrations)
    await requireStoreMembership(user.uid, storeId)

    const oauthState = await getGoogleOAuthStateForStore(storeId)
    const granted = oauthState.grantedScopes
    const grantedScopes = Array.from(granted)
    const connected = oauthState.connected
    const integrations = requestedIntegrations.reduce(
      (acc, integration) => {
        const hasRequiredScope = hasScope(granted, GOOGLE_REQUIRED_SCOPE[integration])
        acc[integration] = {
          connected: connected && hasRequiredScope,
          hasRequiredScope,
        }
        return acc
      },
      {} as Partial<Record<GoogleIntegration, { connected: boolean; hasRequiredScope: boolean }>>,
    )

    const merchantHasScope = hasScope(granted, GOOGLE_REQUIRED_SCOPE.merchant)
    const settingsSnap = await db().collection('storeSettings').doc(storeId).get()
    const settings = (settingsSnap.data() ?? {}) as Record<string, unknown>
    const integrationsRoot = (settings.integrations ?? {}) as Record<string, unknown>
    const googleOAuth = (integrationsRoot.googleOAuth ?? {}) as Record<string, unknown>
    const googleMerchant = (integrationsRoot.googleMerchant ?? {}) as Record<string, unknown>
    const googleShopping = (settings.googleShopping ?? {}) as Record<string, unknown>
    const shoppingStatus = (googleShopping.status ?? {}) as Record<string, unknown>

    const oauthConnected = Object.keys(googleOAuth).length > 0
    const hasContentScope = merchantHasScope
    const merchantId = normalizeString(googleMerchant.selectedMerchantId)
    const hasSelectedMerchant = merchantId.length > 0
    const refreshToken = normalizeString(googleMerchant.refreshToken)
    const hasRefreshToken = refreshToken.length > 0
    const validationSummary = toValidationSummary(shoppingStatus.validationSummary)
    let merchantConnected = false

    if (oauthConnected && hasContentScope && hasSelectedMerchant && hasRefreshToken) {
      let accessToken = normalizeString(googleMerchant.accessToken)
      const expiresAt = parseExpiryMillis(googleMerchant.expiresAt)
      const tokenExpiringSoon = expiresAt > 0 && expiresAt <= Date.now() + 30_000

      if (!accessToken || tokenExpiringSoon) {
        const refreshed = await refreshAccessToken(refreshToken)
        accessToken = refreshed.accessToken
        await db().collection('storeSettings').doc(storeId).set(
          {
            integrations: {
              googleMerchant: {
                accessToken: refreshed.accessToken,
                expiresAt: new Date(refreshed.expiresAt),
                updatedAt: new Date(),
              },
            },
          },
          { merge: true },
        )
      }

      merchantConnected = await canCallMerchantApi(accessToken, merchantId)
    }

    let merchantState:
      | 'google_not_connected'
      | 'merchant_scope_missing'
      | 'merchant_account_not_selected'
      | 'refresh_token_missing'
      | 'merchant_connected'
      | 'product_sync_blocked_validation'
      | 'sync_ready'

    if (!oauthConnected) {
      merchantState = 'google_not_connected'
    } else if (!hasContentScope) {
      merchantState = 'merchant_scope_missing'
    } else if (!hasSelectedMerchant) {
      merchantState = 'merchant_account_not_selected'
    } else if (!hasRefreshToken) {
      merchantState = 'refresh_token_missing'
    } else if (!merchantConnected) {
      merchantState = 'merchant_connected'
    } else if (validationSummary.blockingCount > 0) {
      merchantState = 'product_sync_blocked_validation'
    } else {
      merchantState = 'sync_ready'
    }

    const syncReady = merchantState === 'sync_ready'

    return res.status(200).json({
      connected,
      grantedScopes,
      integrations,
      merchant: {
        state: merchantState,
        googleConnected: oauthConnected,
        hasMerchantScope: hasContentScope,
        merchantAccountSelected: hasSelectedMerchant,
        merchantId,
        refreshTokenPresent: hasRefreshToken,
        merchantConnected,
        syncReady,
        validationSummary,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'status-failed'
    if (message === 'missing-auth' || message === 'invalid-auth') return res.status(401).json({ error: 'Unauthorized' })
    if (message === 'store-access-denied') return res.status(403).json({ error: 'Forbidden' })
    return res.status(400).json({ error: message })
  }
}
