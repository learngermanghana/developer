import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../_firebase-admin.js'
import { fetchGoogleAdsCampaignMetrics, getGoogleAdsAuthContext } from '../_google-ads.js'

function requireCronSecret(req: VercelRequest) {
  const expected = process.env.GOOGLE_ADS_SYNC_SECRET?.trim() || ''
  if (!expected) throw new Error('GOOGLE_ADS_SYNC_SECRET not set')

  const incoming =
    (typeof req.headers['x-google-ads-sync-secret'] === 'string' && req.headers['x-google-ads-sync-secret']) ||
    (typeof req.query.secret === 'string' && req.query.secret) ||
    ''

  if (incoming !== expected) throw new Error('unauthorized')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    requireCronSecret(req)

    const settingsSnaps = await db()
      .collection('storeSettings')
      .where('googleAdsAutomation.connection.connected', '==', true)
      .get()

    let scanned = 0
    let updated = 0

    for (const docSnap of settingsSnaps.docs) {
      scanned += 1

      const storeId = docSnap.id
      const settingsRef = db().doc(`storeSettings/${storeId}`)
      const settingsData = (docSnap.data() ?? {}) as Record<string, any>
      const campaign = (settingsData.googleAdsAutomation?.campaign ?? {}) as Record<string, any>

      try {
        const auth = await getGoogleAdsAuthContext(storeId)
        const metrics = await fetchGoogleAdsCampaignMetrics({
          customerId: auth.customerId,
          managerId: auth.managerId,
          accessToken: auth.accessToken,
          campaignId: typeof campaign.campaignId === 'string' ? campaign.campaignId : undefined,
        })

        await settingsRef.set(
          {
            googleAdsAutomation: {
              metrics: {
                spend: metrics.spend,
                leads: metrics.leads,
                cpa: metrics.cpa,
                syncedAt: FieldValue.serverTimestamp(),
              },
              jobs: {
                metricsSync: {
                  lastRunAt: FieldValue.serverTimestamp(),
                  status: 'ok',
                },
              },
            },
          },
          { merge: true },
        )

        updated += 1
      } catch (storeError) {
        await settingsRef.set(
          {
            googleAdsAutomation: {
              jobs: {
                metricsSync: {
                  lastRunAt: FieldValue.serverTimestamp(),
                  status: 'error',
                  message: storeError instanceof Error ? storeError.message.slice(0, 300) : 'sync-failed',
                },
              },
            },
          },
          { merge: true },
        )
      }
    }

    return res.status(200).json({ ok: true, scanned, updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'metrics-sync-failed'
    const code = message === 'unauthorized' ? 401 : 400
    return res.status(code).json({ error: message })
  }
}
