/**
 * Auto-Whitelist List API
 *
 * Returns the list of all whitelisted punk IDs.
 * Used by the frontend to validate punks without server signatures.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list, head } from '@vercel/blob'

interface WhitelistEntry {
  punkId: string
  submittedAt: number
  submitterPubkey?: string
}

interface WhitelistStore {
  entries: WhitelistEntry[]
  lastUpdated: number
}

const BLOB_FILENAME = 'auto-whitelist.json'

// In-memory cache
let whitelistCache: WhitelistStore | null = null
let lastFetchAttempt: number = 0
const FETCH_RETRY_DELAY = 5000 // 5 seconds between fetch attempts

/**
 * Read whitelist from Vercel Blob
 */
async function readWhitelist(): Promise<WhitelistStore> {
  // Return cached value if available
  if (whitelistCache) {
    return whitelistCache
  }

  // Rate limit fetch attempts
  const now = Date.now()
  if (now - lastFetchAttempt < FETCH_RETRY_DELAY) {
    console.log('⏭️  Skipping fetch (too soon since last attempt)')
    return { entries: [], lastUpdated: Date.now() }
  }

  lastFetchAttempt = now

  try {
    const { blobs } = await list()
    const whitelistBlob = blobs.find(b => b.pathname === BLOB_FILENAME)

    if (!whitelistBlob) {
      console.log('📝 No whitelist blob found')
      return { entries: [], lastUpdated: Date.now() }
    }

    // Try using downloadUrl property if available
    const url = (whitelistBlob as any).downloadUrl || whitelistBlob.url

    console.log(`📥 Fetching whitelist from: ${url.substring(0, 50)}...`)
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const text = await response.text()
    const store: WhitelistStore = JSON.parse(text)

    // Cache successfully fetched whitelist
    whitelistCache = store

    return store
  } catch (error) {
    console.warn('Failed to read whitelist, returning empty:', error)
    return { entries: [], lastUpdated: Date.now() }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📋 Auto-whitelist list endpoint called')

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const store = await readWhitelist()

    console.log(`✅ Returning ${store.entries.length} whitelisted punk(s)`)

    return res.status(200).json({
      punkIds: store.entries.map(e => e.punkId),
      count: store.entries.length,
      lastUpdated: store.lastUpdated
    })

  } catch (error: any) {
    console.error('❌ Error reading whitelist:', error)
    return res.status(500).json({
      error: 'Failed to read whitelist',
      details: error.message,
      punkIds: []
    })
  }
}
