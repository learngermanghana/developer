#!/usr/bin/env node
/* eslint-disable no-console */
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

async function run() {
  const snapshot = await db.collection('products').get()
  console.log(`[migrateProductImageFields] scanning ${snapshot.size} products`)

  let updated = 0
  let skipped = 0
  let batch = db.batch()
  let ops = 0

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() || {}
    const updates = {}

    if (!Object.prototype.hasOwnProperty.call(data, 'imageUrl')) {
      updates.imageUrl = null
    }

    const hasImageUrl = typeof data.imageUrl === 'string' && data.imageUrl.trim() !== ''
    const hasImageAlt = typeof data.imageAlt === 'string' && data.imageAlt.trim() !== ''
    const name = typeof data.name === 'string' ? data.name.trim() : ''

    if (!Object.prototype.hasOwnProperty.call(data, 'imageAlt') && hasImageUrl && !hasImageAlt) {
      updates.imageAlt = name || null
    }

    if (Object.keys(updates).length === 0) {
      skipped += 1
      continue
    }

    batch.set(docSnap.ref, updates, { merge: true })
    updated += 1
    ops += 1

    if (ops === 450) {
      await batch.commit()
      batch = db.batch()
      ops = 0
    }
  }

  if (ops > 0) {
    await batch.commit()
  }

  console.log(
    `[migrateProductImageFields] done. updated=${updated}, skipped=${skipped}, total=${snapshot.size}`,
  )
}

run().catch(error => {
  console.error('[migrateProductImageFields] failed', error)
  process.exit(1)
})
