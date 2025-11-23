/**
 * Fix Sold Event API
 *
 * POST /api/escrow/fix-sold-event
 *
 * Republishes a sold event with correct KIND and metadata
 * Use this to fix transactions that happened before the kind mismatch was fixed
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getEscrowListing, ESCROW_PRIVATE_KEY } from './_lib/escrowStore.js'

interface FixRequest {
  punkId: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔧 Fix sold event endpoint called')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { punkId } = req.body as FixRequest

    if (!punkId) {
      return res.status(400).json({ error: 'Missing punkId' })
    }

    // Get listing from blob
    const listing = await getEscrowListing(punkId)
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found in blob' })
    }

    if (listing.status !== 'sold') {
      return res.status(400).json({ error: `Listing status is ${listing.status}, not sold` })
    }

    if (!listing.buyerPubkey) {
      return res.status(400).json({ error: 'No buyer pubkey in listing' })
    }

    console.log(`🔧 Fixing sold event for punk ${punkId}`)
    console.log(`   Seller: ${listing.sellerPubkey}`)
    console.log(`   Buyer: ${listing.buyerPubkey}`)
    console.log(`   Price: ${listing.price} sats`)

    // Fetch original listing event to get metadata
    const { SimplePool, finalizeEvent } = await import('nostr-tools')
    const { hex } = await import('@scure/base')

    const RELAYS = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://nostr.wine',
      'wss://relay.snort.social'
    ]
    const KIND_PUNK_LISTING = 1401
    const KIND_PUNK_SOLD = 1402  // Correct kind

    const pool = new SimplePool()

    // Get compressed metadata from listing event
    console.log('   🔍 Fetching listing event for metadata...')
    const listingEvents = await pool.querySync(RELAYS, {
      kinds: [KIND_PUNK_LISTING],
      authors: [listing.sellerPubkey],
      limit: 100
    })

    const listingEvent = listingEvents.find(e => {
      const punkIdTag = e.tags.find(t => t[0] === 'punk_id')
      return punkIdTag && punkIdTag[1] === punkId
    })

    let compressedMetadata = ''
    if (listingEvent) {
      const compressedTag = listingEvent.tags.find(t => t[0] === 'compressed')
      if (compressedTag) {
        compressedMetadata = compressedTag[1]
        console.log(`   ✅ Found compressed metadata (${compressedMetadata.length} chars)`)
      }
    }

    if (!compressedMetadata) {
      console.warn('   ⚠️  Could not find compressed metadata - publishing without it')
    }

    // Publish corrected sold event
    const currentNetwork = process.env.VITE_ARKADE_NETWORK || 'mainnet'

    const soldEventTemplate = {
      kind: KIND_PUNK_SOLD,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'arkade-punk-sold'],
        ['punk_id', punkId],
        ['seller', listing.sellerPubkey],
        ['buyer', listing.buyerPubkey],
        ['price', listing.price],
        ['txid', listing.paymentTransferTxid || 'unknown'],
        ['network', currentNetwork],
        ...(compressedMetadata ? [['compressed', compressedMetadata]] : [])
      ],
      content: `Punk ${punkId} sold via escrow for ${listing.price} sats (CORRECTED EVENT)`
    }

    const signedEvent = finalizeEvent(soldEventTemplate, hex.decode(ESCROW_PRIVATE_KEY))

    await Promise.any(pool.publish(RELAYS, signedEvent))
    pool.close(RELAYS)

    console.log('✅ Corrected sold event published!')

    return res.status(200).json({
      success: true,
      message: 'Sold event republished with correct kind and metadata',
      eventId: signedEvent.id,
      kind: signedEvent.kind,
      hasMetadata: !!compressedMetadata
    })

  } catch (error: any) {
    console.error('❌ Error fixing sold event:', error)
    return res.status(500).json({
      error: 'Failed to fix sold event',
      details: error.message
    })
  }
}
