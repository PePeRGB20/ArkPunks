/**
 * Escrow Buy API
 *
 * POST /api/escrow/buy
 *
 * Allows a buyer to purchase a punk that is held in escrow.
 * Executes the atomic swap: buyer pays, gets punk; seller gets payment.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { transferPunkToBuyer, payoutToSeller, getEscrowAddress } from './_lib/escrowWallet'
import { getEscrowListing, markAsSold } from './_lib/escrowStore'

interface BuyRequest {
  punkId: string
  buyerPubkey: string
  buyerArkAddress: string
  paymentTxid: string // TXID of the buyer's payment to escrow
}

const MARKETPLACE_FEE_PERCENT = 0.5 // 0.5% fee

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      punkId,
      buyerPubkey,
      buyerArkAddress,
      paymentTxid
    } = req.body as BuyRequest

    // Validate required fields
    if (!punkId || !buyerPubkey || !buyerArkAddress || !paymentTxid) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['punkId', 'buyerPubkey', 'buyerArkAddress', 'paymentTxid']
      })
    }

    // Get escrow listing
    const listing = getEscrowListing(punkId)
    if (!listing) {
      return res.status(404).json({ error: 'Punk not found in escrow' })
    }

    // Check if listing is in correct status
    if (listing.status !== 'deposited') {
      return res.status(400).json({
        error: `Punk not available for purchase (status: ${listing.status})`,
        status: listing.status
      })
    }

    console.log(`🛒 Processing purchase of punk ${punkId}`)
    console.log(`   Price: ${listing.price} sats`)
    console.log(`   Buyer: ${buyerArkAddress.slice(0, 20)}...`)
    console.log(`   Payment TXID: ${paymentTxid}`)

    // TODO: Verify payment was actually received
    // For now, we trust the buyer's provided TXID

    const price = BigInt(listing.price)
    const punkValue = 10000n // Standard punk VTXO value

    // Step 1: Transfer punk to buyer
    console.log('📤 Step 1: Transferring punk to buyer...')
    const punkTransferTxid = await transferPunkToBuyer(
      listing.punkVtxoOutpoint,
      buyerArkAddress,
      punkValue
    )

    // Step 2: Pay seller (minus fee)
    console.log('💰 Step 2: Paying seller...')
    const sellerPayoutTxid = await payoutToSeller(
      listing.sellerArkAddress,
      price,
      MARKETPLACE_FEE_PERCENT
    )

    // Step 3: Mark as sold
    markAsSold(punkId, buyerArkAddress, buyerPubkey)

    // Calculate actual amounts
    const fee = (price * BigInt(Math.floor(MARKETPLACE_FEE_PERCENT * 100))) / 10000n
    const sellerPayout = price - fee

    console.log(`✅ Sale completed for punk ${punkId}`)
    console.log(`   Buyer received punk: ${punkTransferTxid}`)
    console.log(`   Seller received: ${sellerPayout} sats (${fee} sats fee)`)

    return res.status(200).json({
      success: true,
      punkId,
      transactions: {
        punkTransfer: punkTransferTxid,
        sellerPayout: sellerPayoutTxid
      },
      amounts: {
        price: listing.price,
        sellerPayout: sellerPayout.toString(),
        marketplaceFee: fee.toString()
      },
      message: 'Purchase successful! You now own this punk.'
    })

  } catch (error: any) {
    console.error('❌ Error processing purchase:', error)
    return res.status(500).json({
      error: 'Failed to process purchase',
      details: error.message
    })
  }
}
