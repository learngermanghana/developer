#!/usr/bin/env node
/* eslint-disable no-console */
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

function toNullableString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeSlugPart(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildPublicSlug(storeData, storeId) {
  const explicit = toNullableString(storeData.promoSlug)
  if (explicit) return normalizeSlugPart(explicit)

  const candidates = [
    toNullableString(storeData.displayName),
    toNullableString(storeData.name),
    storeId,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const normalized = normalizeSlugPart(candidate)
    if (normalized) return normalized
  }
  return null
}

function buildStoreMeta(storeData, storeId) {
  const storeName = toNullableString(storeData.displayName) ?? toNullableString(storeData.name)
  const storePhone = toNullableString(storeData.phone)
  const storeCity = toNullableString(storeData.city)
  const storeEmail =
    toNullableString(storeData.ownerEmail) ?? toNullableString(storeData.email)
  const slug = buildPublicSlug(storeData, storeId)

  return {
    storeName,
    storePhone,
    storeCity,
    storeEmail,
    websiteLink: slug ? `https://www.sedifex.com/${encodeURIComponent(slug)}` : null,
  }
}

async function run() {
  const productsSnapshot = await db.collection('products').get()
  console.log(
    `[backfillProductStoreMeta] scanning ${productsSnapshot.size} products`,
  )

  const storeIds = new Set()
  for (const product of productsSnapshot.docs) {
    const storeId = toNullableString(product.get('storeId'))
    if (storeId) storeIds.add(storeId)
  }
  console.log(
    `[backfillProductStoreMeta] loading metadata for ${storeIds.size} stores`,
  )

  const storeMetaById = new Map()
  for (const storeId of storeIds) {
    const storeSnapshot = await db.collection('stores').doc(storeId).get()
    const storeData = storeSnapshot.exists ? storeSnapshot.data() || {} : {}
    storeMetaById.set(storeId, buildStoreMeta(storeData, storeId))
  }

  let updated = 0
  let skipped = 0
  let batch = db.batch()
  let opCount = 0

  for (const product of productsSnapshot.docs) {
    const storeId = toNullableString(product.get('storeId'))
    if (!storeId) {
      skipped += 1
      continue
    }

    const meta = storeMetaById.get(storeId)
    if (!meta) {
      skipped += 1
      continue
    }

    const updates = {
      ...meta,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    batch.set(product.ref, updates, { merge: true })
    updated += 1
    opCount += 1

    if (opCount >= 450) {
      await batch.commit()
      batch = db.batch()
      opCount = 0
    }
  }

  if (opCount > 0) {
    await batch.commit()
  }

  console.log(
    `[backfillProductStoreMeta] done. updated=${updated}, skipped=${skipped}, total=${productsSnapshot.size}`,
  )
}

run().catch(error => {
  console.error('[backfillProductStoreMeta] failed', error)
  process.exit(1)
})
