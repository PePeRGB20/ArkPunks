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
const KIND_PUNK_EXIT = 1341

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

/**
 * Query all L1 exit events across all relays
 */
export async function queryAllL1Exits() {
  const pool = new SimplePool()

  try {
    console.log('🔍 DIAGNOSTIC: Querying ALL L1 exit events on Nostr...')
    console.log('   Relays:', RELAYS)

    const allExits = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_EXIT],
      '#t': ['arkade-punk-exit'],
      limit: 100
    })

    console.log(`   Found ${allExits.length} total L1 exit events across all relays`)

    if (allExits.length === 0) {
      console.warn('⚠️ NO L1 EXIT EVENTS FOUND')
      console.warn('   This means no punks have been exited to L1 yet')
      return []
    }

    // Group by punk
    const byPunk = new Map<string, number>()
    const byL1Address = new Map<string, number>()
    const exitDetails: any[] = []

    for (const event of allExits) {
      const punkIdTag = event.tags.find(t => t[0] === 'punk_id')
      const toAddressTag = event.tags.find(t => t[0] === 'to_address')
      const fromVtxoTag = event.tags.find(t => t[0] === 'from_vtxo')
      const exitTypeTag = event.tags.find(t => t[0] === 'exit_type')

      if (punkIdTag) {
        const count = byPunk.get(punkIdTag[1]) || 0
        byPunk.set(punkIdTag[1], count + 1)
      }

      if (toAddressTag) {
        const count = byL1Address.get(toAddressTag[1]) || 0
        byL1Address.set(toAddressTag[1], count + 1)
      }

      exitDetails.push({
        punkId: punkIdTag?.[1] || 'unknown',
        author: event.pubkey,
        fromVtxo: fromVtxoTag?.[1] || 'unknown',
        toAddress: toAddressTag?.[1] || 'unknown',
        exitType: exitTypeTag?.[1] || 'unknown',
        timestamp: event.created_at,
        date: new Date(event.created_at * 1000).toISOString()
      })
    }

    console.log('\n📊 L1 Exits by Punk:')
    for (const [punkId, count] of byPunk.entries()) {
      console.log(`   ${punkId.slice(0, 16)}... : ${count} exit(s)`)
    }

    console.log('\n📊 L1 Exits by Bitcoin Address:')
    for (const [address, count] of byL1Address.entries()) {
      console.log(`   ${address.slice(0, 30)}... : ${count} punk(s)`)
    }

    console.log('\n📋 All L1 Exits (sorted by date):')
    exitDetails.sort((a, b) => a.timestamp - b.timestamp)
    for (const exit of exitDetails) {
      console.log(`   Punk: ${exit.punkId.slice(0, 12)}...`)
      console.log(`      From VTXO:  ${exit.fromVtxo.slice(0, 30)}...`)
      console.log(`      To L1:      ${exit.toAddress.slice(0, 40)}...`)
      console.log(`      Exit Type:  ${exit.exitType}`)
      console.log(`      Date:       ${exit.date}`)
      console.log('')
    }

    return exitDetails

  } catch (error) {
    console.error('❌ L1 exit query failed:', error)
    return []
  } finally {
    pool.close(RELAYS)
  }
}

/**
 * Recover punks for a specific L1 Bitcoin address
 * This is used after exiting Arkade to find your punks
 */
export async function recoverPunksByL1Address(l1Address: string) {
  const pool = new SimplePool()

  try {
    console.log(`🔍 RECOVERY: Searching for punks linked to L1 address...`)
    console.log(`   L1 Address: ${l1Address}`)

    const exitEvents = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_EXIT],
      '#to_address': [l1Address],
      limit: 100
    })

    console.log(`   Found ${exitEvents.length} punk(s) linked to this address`)

    if (exitEvents.length === 0) {
      console.warn('⚠️ No punks found for this L1 address')
      console.warn('   Make sure you published exit events before leaving Arkade')
      return []
    }

    console.log('\n📋 Your Punks on Bitcoin L1:')
    for (const event of exitEvents) {
      const punkIdTag = event.tags.find(t => t[0] === 'punk_id')
      const fromVtxoTag = event.tags.find(t => t[0] === 'from_vtxo')
      const dataTag = event.tags.find(t => t[0] === 'data')

      console.log(`   Punk ID: ${punkIdTag?.[1] || 'unknown'}`)
      console.log(`      From VTXO: ${fromVtxoTag?.[1] || 'unknown'}`)
      console.log(`      Data: ${dataTag?.[1] || 'unknown'}`)
      console.log(`      Published: ${new Date(event.created_at * 1000).toISOString()}`)
      console.log('')
    }

    return exitEvents

  } catch (error) {
    console.error('❌ Recovery failed:', error)
    return []
  } finally {
    pool.close(RELAYS)
  }
}

/**
 * Recover punks using Nostr private key (pubkey)
 */
export async function recoverPunksByNostrKey(pubkey: string) {
  const pool = new SimplePool()

  try {
    console.log(`🔍 RECOVERY: Searching for punks using Nostr key...`)
    console.log(`   Pubkey: ${pubkey.slice(0, 16)}...`)

    // Search for exit events signed by this key
    const exitEvents = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_EXIT],
      authors: [pubkey],
      limit: 100
    })

    console.log(`   Found ${exitEvents.length} exit event(s) signed by this key`)

    if (exitEvents.length > 0) {
      console.log('\n📋 L1 Exit Events:')
      for (const event of exitEvents) {
        const punkIdTag = event.tags.find(t => t[0] === 'punk_id')
        const toAddressTag = event.tags.find(t => t[0] === 'to_address')

        console.log(`   Punk: ${punkIdTag?.[1].slice(0, 16) || 'unknown'}...`)
        console.log(`      → L1 Address: ${toAddressTag?.[1] || 'unknown'}`)
        console.log('')
      }
    }

    // Also search for mints
    const mintEvents = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_MINT],
      authors: [pubkey],
      limit: 100
    })

    console.log(`   Found ${mintEvents.length} mint event(s) signed by this key`)

    return { exitEvents, mintEvents }

  } catch (error) {
    console.error('❌ Recovery failed:', error)
    return { exitEvents: [], mintEvents: [] }
  } finally {
    pool.close(RELAYS)
  }
}
