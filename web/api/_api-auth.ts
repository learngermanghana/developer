import type { VercelRequest } from '@vercel/node'
import { getAuth } from 'firebase-admin/auth'
import { getAdmin } from './_firebase-admin.js'
import { db } from './_firebase-admin.js'

export type ApiAuthedUser = {
  uid: string
  email: string
}

export async function requireApiUser(req: VercelRequest): Promise<ApiAuthedUser> {
  const authHeader = req.headers.authorization
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('missing-auth')
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) throw new Error('missing-auth')

  const decoded = await getAuth(getAdmin()).verifyIdToken(token)
  if (!decoded.uid) throw new Error('invalid-auth')

  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : '',
  }
}

function normalizeStoreIdCandidate(candidate: unknown): string {
  if (typeof candidate !== 'string') return ''
  return candidate.trim()
}

function extractStoreId(record: Record<string, unknown>): string {
  const candidates = [
    record.storeId,
    record.storeID,
    record.store_id,
    record.workspaceSlug,
    record.workspaceId,
    record.workspace_id,
    record.workspaceUid,
    record.workspace_uid,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeStoreIdCandidate(candidate)
    if (normalized) return normalized
  }

  return ''
}

export async function requireStoreMembership(uid: string, storeId: string): Promise<void> {
  const normalizedStoreId = storeId.trim()
  if (!normalizedStoreId) throw new Error('invalid-store-id')

  const membershipSnaps = await db()
    .collection('teamMembers')
    .where('uid', '==', uid)
    .limit(50)
    .get()

  const hasMembership = membershipSnaps.docs.some((docSnap) => {
    const data = (docSnap.data() ?? {}) as Record<string, unknown>
    return extractStoreId(data) === normalizedStoreId
  })

  if (!hasMembership) throw new Error('store-access-denied')
}
