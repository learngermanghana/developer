import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireApiUser, requireStoreMembership } from '../_api-auth.js'
import {
  GOOGLE_REQUIRED_SCOPE,
  getGoogleOAuthStateForStore,
  hasScope,
  type GoogleIntegration,
} from '../_google-oauth.js'

function requireStoreId(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('invalid-store-id')
  return raw.trim()
}

const ALL_INTEGRATIONS: GoogleIntegration[] = ['ads', 'business', 'merchant']

function parseRequestedIntegrations(rawIntegration: unknown, rawIntegrations: unknown): GoogleIntegration[] {
  const requested = Array.isArray(rawIntegrations) ? rawIntegrations : [rawIntegration]
  const unique = new Set<GoogleIntegration>()
  for (const entry of requested) {
    if (entry === 'ads' || entry === 'business' || entry === 'merchant') unique.add(entry)
  }
  return unique.size ? Array.from(unique) : ALL_INTEGRATIONS
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

    return res.status(200).json({
      connected,
      grantedScopes,
      integrations,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'status-failed'
    if (message === 'missing-auth' || message === 'invalid-auth') return res.status(401).json({ error: 'Unauthorized' })
    if (message === 'store-access-denied') return res.status(403).json({ error: 'Forbidden' })
    return res.status(400).json({ error: message })
  }
}
