/**
 * Nostr Diagnostics - Debug tool to investigate missing punks
 */

import { SimplePool } from 'nostr-tools'

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://relay.snort.social'
]

const KIND_PUNK_MINT = 1337

/**
 * Query ALL punk mints on Nostr (regardless of owner)
 * This helps diagnose if punks exist at all
 */
export async function queryAllPunkMints() {
  const pool = new SimplePool()

  try {
    console.log('🔍 DIAGNOSTIC: Querying ALL punk mints on Nostr...')
    console.log('   Relays:', RELAYS)

    const allMints = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_MINT],
      '#t': ['arkade-punk'],
      limit: 100
    })

    console.log(`   Found ${allMints.length} total punk mint events across all relays`)

    if (allMints.length === 0) {
      console.warn('⚠️ NO PUNK MINTS FOUND ON ANY RELAY')
      console.warn('   This means either:')
      console.warn('   1. No punks have been published to Nostr yet')
      console.warn('   2. Relays are unreachable')
      console.warn('   3. Events were published with different tags')
      return []
    }

    // Group by author (pubkey)
    const byAuthor = new Map<string, number>()
    const byOwner = new Map<string, number>()
    const punkDetails: any[] = []

    for (const event of allMints) {
      // Count by author
      const count = byAuthor.get(event.pubkey) || 0
      byAuthor.set(event.pubkey, count + 1)

      // Count by owner tag
      const ownerTag = event.tags.find(t => t[0] === 'owner')
      if (ownerTag) {
        const owner = ownerTag[1]
        const ownerCount = byOwner.get(owner) || 0
        byOwner.set(owner, ownerCount + 1)
      }

      // Extract punk details
      const punkIdTag = event.tags.find(t => t[0] === 'punk_id')
      const vtxoTag = event.tags.find(t => t[0] === 'vtxo')
      const indexTag = event.tags.find(t => t[0] === 'index')

      punkDetails.push({
        punkId: punkIdTag?.[1] || 'unknown',
        author: event.pubkey,
        owner: ownerTag?.[1] || 'unknown',
        vtxo: vtxoTag?.[1] || 'unknown',
        index: indexTag?.[1] || 'unknown',
        timestamp: event.created_at,
        date: new Date(event.created_at * 1000).toISOString()
      })
    }

    console.log('\n📊 Punk Mints by Author (Nostr pubkey):')
    for (const [pubkey, count] of byAuthor.entries()) {
      console.log(`   ${pubkey.slice(0, 16)}... : ${count} punks`)
    }

    console.log('\n📊 Punk Mints by Owner (Bitcoin address):')
    for (const [owner, count] of byOwner.entries()) {
      console.log(`   ${owner.slice(0, 20)}... : ${count} punks`)
    }

    console.log('\n📋 All Punks (sorted by date):')
    punkDetails.sort((a, b) => a.timestamp - b.timestamp)
    for (const punk of punkDetails) {
      console.log(`   Punk ${punk.index}: ${punk.punkId.slice(0, 12)}...`)
      console.log(`      Author:  ${punk.author.slice(0, 16)}...`)
      console.log(`      Owner:   ${punk.owner.slice(0, 30)}...`)
      console.log(`      Date:    ${punk.date}`)
    }

    return punkDetails

  } catch (error) {
    console.error('❌ Diagnostic query failed:', error)
    return []
  } finally {
    pool.close(RELAYS)
  }
}

/**
 * Check if a specific Nostr pubkey has any punk mints
 */
export async function queryPunksByPubkey(pubkey: string) {
  const pool = new SimplePool()

  try {
    console.log(`🔍 DIAGNOSTIC: Querying punks for pubkey ${pubkey.slice(0, 16)}...`)

    const events = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_MINT],
      authors: [pubkey],
      limit: 100
    })

    console.log(`   Found ${events.length} punks for this pubkey`)

    return events

  } catch (error) {
    console.error('❌ Query failed:', error)
    return []
  } finally {
    pool.close(RELAYS)
  }
}

/**
 * Check if a specific Bitcoin address has any punk mints
 */
export async function queryPunksByAddress(address: string) {
  const pool = new SimplePool()

  try {
    console.log(`🔍 DIAGNOSTIC: Querying punks for address ${address.slice(0, 20)}...`)

    const events = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_MINT],
      '#owner': [address],
      limit: 100
    })

    console.log(`   Found ${events.length} punks for this address`)

    return events

  } catch (error) {
    console.error('❌ Query failed:', error)
    return []
  } finally {
    pool.close(RELAYS)
  }
}
