/**
 * Supply Cache API
 *
 * Returns the current punk supply from a server-side cache.
 * This ensures consistent counts across all clients and avoids
 * race conditions from concurrent Nostr relay queries.
 *
 * Cache is stored in-memory (serverless function stays warm for ~5 mins)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SimplePool } from 'nostr-tools'

const OFFICIAL_RELAY = 'wss://relay.damus.io'
const KIND_PUNK_MINT = 1400
const CACHE_DURATION_MS = 30000 // 30 seconds

interface SupplyCache {
  totalMinted: number
  maxPunks: number
  lastUpdated: number
  updatedBy?: string // User agent that triggered the update
}

// In-memory cache (persists while function is warm)
let memoryCache: SupplyCache | null = null

/**
 * Fetch fresh supply from Nostr relay
 */
async function fetchSupplyFromRelay(userAgent?: string): Promise<SupplyCache> {
  console.log('📡 Fetching fresh supply from Nostr relay...')
  console.log(`   Triggered by: ${userAgent || 'unknown'}`)

  const pool = new SimplePool()

  try {
    const allEvents = await pool.querySync([OFFICIAL_RELAY], {
      kinds: [KIND_PUNK_MINT],
      '#t': ['arkade-punk'],
      limit: 1100
    })

    console.log(`   Found ${allEvents.length} total events`)

    // Filter by network AND server signature (only official punks)
    const events = allEvents.filter(e => {
      const networkTag = e.tags.find(t => t[0] === 'network')
      const serverSigTag = e.tags.find(t => t[0] === 'server_sig')
      return networkTag?.[1] === 'mainnet' && serverSigTag
    })

    console.log(`   Found ${events.length} official punk events`)

    // Deduplicate by punkId (keep earliest)
    const punkMap = new Map()
    for (const event of events) {
      const punkIdTag = event.tags.find(t => t[0] === 'punk_id')
      if (!punkIdTag) continue

      const punkId = punkIdTag[1]
      const existing = punkMap.get(punkId)

      if (!existing || event.created_at < existing.created_at) {
        punkMap.set(punkId, event)
      }
    }

    const totalMinted = punkMap.size

    console.log(`✅ Loaded ${totalMinted} unique punks`)

    return {
      totalMinted,
      maxPunks: 1000,
      lastUpdated: Date.now(),
      updatedBy: userAgent
    }
  } finally {
    pool.close([OFFICIAL_RELAY])
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📊 Supply API called')
  console.log(`   User-Agent: ${req.headers['user-agent']}`)
  console.log(`   IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`)

  try {
    const now = Date.now()

    // Check if cache is fresh
    if (memoryCache && (now - memoryCache.lastUpdated) < CACHE_DURATION_MS) {
      const age = Math.floor((now - memoryCache.lastUpdated) / 1000)
      console.log(`✅ Serving cached supply (age: ${age}s)`)

      return res.status(200).json({
        totalMinted: memoryCache.totalMinted,
        maxPunks: memoryCache.maxPunks,
        cached: true,
        cacheAge: age
      })
    }

    // Cache expired or doesn't exist - fetch fresh data
    console.log('🔄 Cache expired or missing, fetching fresh data...')

    const freshSupply = await fetchSupplyFromRelay(req.headers['user-agent'])

    // Update in-memory cache
    memoryCache = freshSupply

    console.log(`✅ Cache updated: ${freshSupply.totalMinted} punks`)

    return res.status(200).json({
      totalMinted: freshSupply.totalMinted,
      maxPunks: freshSupply.maxPunks,
      cached: false,
      cacheAge: 0
    })

  } catch (error: any) {
    console.error('❌ Error in supply API:', error)

    return res.status(500).json({
      error: 'Failed to fetch supply',
      details: error.message,
      totalMinted: 0,
      maxPunks: 1000
    })
  }
}
