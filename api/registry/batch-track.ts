/**
 * Batch Punk Registry Tracking API
 *
 * Accepts multiple punk IDs in a single request for efficient migration.
 * This avoids race conditions from concurrent individual requests.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put, list } from '@vercel/blob'

interface RegistryEntry {
  punkId: string
  mintedAt: number
  minterPubkey?: string
  vtxo?: string
}

interface RegistryStore {
  entries: RegistryEntry[]
  lastUpdated: number
}

const BLOB_FILENAME = 'punk-registry.json'

/**
 * Read registry from Vercel Blob
 */
async function readRegistry(): Promise<RegistryStore> {
  try {
    const { blobs } = await list()
    const registryBlob = blobs.find(b => b.pathname === BLOB_FILENAME)

    if (!registryBlob) {
      console.log('📝 No registry blob found, creating new one')
      return { entries: [], lastUpdated: Date.now() }
    }

    const url = (registryBlob as any).downloadUrl || registryBlob.url
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const text = await response.text()
    const store: RegistryStore = JSON.parse(text)
    return store
  } catch (error) {
    console.warn('Failed to read registry, returning empty:', error)
    return { entries: [], lastUpdated: Date.now() }
  }
}

/**
 * Write registry to Vercel Blob
 */
async function writeRegistry(store: RegistryStore): Promise<void> {
  store.lastUpdated = Date.now()

  await put(BLOB_FILENAME, JSON.stringify(store, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
    allowOverwrite: true
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📦 Batch punk registry track endpoint called')

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { punks } = req.body

    if (!Array.isArray(punks) || punks.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid punks array',
        required: 'punks: Array<{ punkId, pubkey?, vtxo? }>'
      })
    }

    console.log(`📋 Batch registering ${punks.length} punks...`)

    // Load current registry
    const store = await readRegistry()
    const existingIds = new Set(store.entries.map(e => e.punkId))

    let addedCount = 0
    let skippedCount = 0

    // Add all new punks
    for (const punk of punks) {
      if (!punk.punkId || typeof punk.punkId !== 'string' || punk.punkId.length !== 64) {
        console.warn(`   ⚠️  Skipping invalid punkId: ${punk.punkId}`)
        continue
      }

      // Skip if already registered
      if (existingIds.has(punk.punkId)) {
        skippedCount++
        continue
      }

      store.entries.push({
        punkId: punk.punkId,
        mintedAt: Date.now(),
        minterPubkey: punk.pubkey,
        vtxo: punk.vtxo
      })

      existingIds.add(punk.punkId)
      addedCount++
    }

    // Save updated registry (single write operation!)
    await writeRegistry(store)

    console.log(`✅ Batch complete! Added: ${addedCount}, Skipped: ${skippedCount}, Total: ${store.entries.length}`)

    return res.status(200).json({
      success: true,
      added: addedCount,
      skipped: skippedCount,
      totalRegistered: store.entries.length,
      message: `Successfully registered ${addedCount} new punks`
    })

  } catch (error: any) {
    console.error('❌ Error in batch registration:', error)
    return res.status(500).json({
      error: 'Failed to batch register punks',
      details: error.message
    })
  }
}
