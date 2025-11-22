/**
 * Migration Script: Populate Blob Registry
 *
 * One-time migration to populate the Vercel Blob registry with all existing
 * punks from the Nostr relay. After this, the blob becomes the source of truth.
 */

import { SimplePool } from 'nostr-tools'

const OFFICIAL_RELAY = 'wss://relay.damus.io'
const KIND_PUNK_MINT = 1400

console.log('🔄 Migrating punks from Nostr to Blob registry...')
console.log('')

const pool = new SimplePool()

try {
  // Fetch all punk mint events from Nostr
  console.log('📡 Fetching all punk events from Nostr relay...')
  const allEvents = await pool.querySync([OFFICIAL_RELAY], {
    kinds: [KIND_PUNK_MINT],
    '#t': ['arkade-punk'],
    limit: 2000
  })

  console.log(`   Found ${allEvents.length} total events`)

  // Filter for mainnet + server signature (official punks only)
  const officialEvents = allEvents.filter(e => {
    const networkTag = e.tags.find(t => t[0] === 'network')
    const serverSigTag = e.tags.find(t => t[0] === 'server_sig')
    return networkTag?.[1] === 'mainnet' && serverSigTag
  })

  console.log(`   ${officialEvents.length} events with server signatures`)

  // Deduplicate by punk_id (keep earliest)
  const punkMap = new Map()
  for (const event of officialEvents) {
    const punkIdTag = event.tags.find(t => t[0] === 'punk_id')
    const vtxoTag = event.tags.find(t => t[0] === 'vtxo')

    if (!punkIdTag) continue

    const punkId = punkIdTag[1]
    const existing = punkMap.get(punkId)

    if (!existing || event.created_at < existing.created_at) {
      punkMap.set(punkId, {
        punkId,
        mintedAt: event.created_at * 1000,
        minterPubkey: event.pubkey,
        vtxo: vtxoTag?.[1]
      })
    }
  }

  const uniquePunks = Array.from(punkMap.values())
  console.log(`   ${uniquePunks.length} unique punks`)
  console.log('')

  // Submit to blob registry in batches
  // Use production URL (change this if running locally)
  const API_URL = process.env.API_URL || 'https://arkpunks.com'

  console.log(`📤 Submitting ${uniquePunks.length} punks to blob registry at ${API_URL}...`)
  console.log('   Using batch endpoint to avoid race conditions')
  console.log('')

  try {
    // Send all punks in a single batch request (avoids race conditions)
    const response = await fetch(`${API_URL}/api/registry/batch-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        punks: uniquePunks
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    console.log('✅ Migration complete!')
    console.log(`   Added: ${data.added} new punks`)
    console.log(`   Skipped: ${data.skipped} duplicates`)
    console.log(`   Total registered: ${data.totalRegistered}`)
    console.log(`   Total in Nostr: ${uniquePunks.length}`)

  } catch (error) {
    console.error('❌ Batch registration failed:', error.message)
  }

} catch (error) {
  console.error('❌ Migration failed:', error)
} finally {
  pool.close([OFFICIAL_RELAY])
  process.exit(0)
}
