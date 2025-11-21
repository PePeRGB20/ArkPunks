/**
 * Escrow Buy API
 *
 * POST /api/escrow/buy
 *
 * Allows a buyer to purchase a punk that is held in escrow.
 *
 * NOTE: This endpoint is not yet implemented. Purchases must be handled manually for now.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getEscrowListing } from './_lib/escrowStore'

interface BuyRequest {
  punkId: string
  buyerPubkey: string
  buyerArkAddress: string
  paymentTxid: string // TXID of the buyer's payment to escrow
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { punkId } = req.body as BuyRequest

    // Get escrow listing to verify it exists
    const listing = getEscrowListing(punkId)
    if (!listing) {
      return res.status(404).json({ error: 'Punk not found in escrow' })
    }

    // Return "not implemented" for now
    // Manual process: Buyer sends payment to escrow address,
    // then admin manually transfers punk and payment
    return res.status(501).json({
      error: 'Automatic purchases not yet implemented',
      message: 'Please contact the seller directly to complete the purchase',
      listing: {
        punkId: listing.punkId,
        price: listing.price,
        escrowAddress: listing.escrowAddress,
        sellerAddress: listing.sellerArkAddress
      }
    })

  } catch (error: any) {
    console.error('❌ Error processing purchase:', error)
    return res.status(500).json({
      error: 'Failed to process purchase',
      details: error.message
    })
  }
}
