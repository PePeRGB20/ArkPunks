/**
 * Escrow Execute API
 *
 * POST /api/escrow/execute
 *
 * Executes the atomic swap for an escrow listing.
 * This is triggered by the buyer after sending payment.
 *
 * Steps:
 * 1. Verify both deposits received (punk VTXO + payment)
 * 2. Transfer punk to buyer
 * 3. Transfer payment (minus 1% fee) to seller
 * 4. Mark listing as sold
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getEscrowListing, updateEscrowStatus, ESCROW_PRIVATE_KEY } from './_lib/escrowStore.js'
import { getEscrowWallet } from './_lib/escrowArkadeWallet.js'

interface ExecuteRequest {
  punkId: string
  buyerPubkey: string // For verification
}

interface ExecuteResponse {
  success: boolean
  punkId: string
  punkTxid: string // Transaction ID for punk transfer to buyer
  paymentTxid: string // Transaction ID for payment to seller
  message: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('⚡ Escrow execute endpoint called')
  console.log('   Method:', req.method)

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { punkId, buyerPubkey } = req.body as ExecuteRequest

    console.log('   Execute request for punk:', punkId)
    console.log('   Buyer:', buyerPubkey?.slice(0, 16) + '...')

    // Validate required fields
    if (!punkId || !buyerPubkey) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['punkId', 'buyerPubkey']
      })
    }

    // Get escrow listing
    const listing = await getEscrowListing(punkId)
    if (!listing) {
      return res.status(404).json({ error: 'Punk not found in escrow' })
    }

    // Debug: Log full buyer verification details
    console.log('🔍 BUYER VERIFICATION:')
    console.log('   Request buyerPubkey:', buyerPubkey)
    console.log('   Stored buyerPubkey:', listing.buyerPubkey)
    console.log('   Match:', listing.buyerPubkey === buyerPubkey)

    // Verify buyer matches
    if (listing.buyerPubkey !== buyerPubkey) {
      return res.status(403).json({
        error: 'Not authorized - buyer mismatch',
        debug: {
          requestPubkey: buyerPubkey,
          storedPubkey: listing.buyerPubkey
        }
      })
    }

    // Check listing status
    if (listing.status === 'sold') {
      return res.status(409).json({ error: 'Punk already sold' })
    }

    if (listing.status === 'cancelled') {
      return res.status(410).json({ error: 'Listing cancelled' })
    }

    if (listing.status !== 'deposited') {
      return res.status(400).json({
        error: 'Deposits not complete',
        status: listing.status,
        message: 'Both seller and buyer must deposit funds before execution'
      })
    }

    console.log('✅ Verified: All deposits received')
    console.log('   Escrow address:', listing.escrowAddress)
    console.log('   Seller address:', listing.sellerArkAddress)
    console.log('   Buyer address:', listing.buyerAddress)

    // Calculate amounts
    const FEE_PERCENT = 1
    const price = BigInt(listing.price)
    const fee = (price * BigInt(Math.floor(FEE_PERCENT * 100))) / 10000n
    const sellerAmount = price - fee

    console.log(`   Price: ${price} sats`)
    console.log(`   Fee (${FEE_PERCENT}%): ${fee} sats`)
    console.log(`   Seller receives: ${sellerAmount} sats`)

    // Execute atomic swap using Arkade SDK
    console.log('⚡ Executing atomic swap with Arkade SDK...')

    // Initialize escrow wallet
    const escrowWallet = await getEscrowWallet()
    console.log('✅ Escrow wallet initialized')
    console.log('   Escrow address:', escrowWallet.arkadeAddress)

    // Check escrow balance
    const escrowBalance = await escrowWallet.getBalance()
    console.log('   Escrow balance:', escrowBalance.available.toString(), 'sats')

    // Verify escrow has enough funds to complete the swap
    // Need: punk amount (for buyer) + seller payment
    // For MVP: We're using regular sats transfers, not special punk VTXOs
    const totalNeeded = price + sellerAmount
    if (escrowBalance.available < totalNeeded) {
      throw new Error(
        `Insufficient escrow balance. Need ${totalNeeded} sats, have ${escrowBalance.available} sats. ` +
        `Both seller (punk deposit) and buyer (payment) must send funds to escrow before execution.`
      )
    }

    // Transfer 1: Send payment to seller (minus fee)
    console.log(`💸 Transferring ${sellerAmount} sats to seller: ${listing.sellerArkAddress}`)
    const paymentTxid = await escrowWallet.send(listing.sellerArkAddress, sellerAmount)
    console.log(`✅ Payment sent! Txid: ${paymentTxid}`)

    // Transfer 2: Send punk value to buyer
    // Note: For MVP, we're transferring the punk's value in sats
    // In the future, this would transfer the actual punk VTXO with tapscripts
    console.log(`💸 Transferring punk (${price} sats) to buyer: ${listing.buyerAddress}`)
    const punkTxid = await escrowWallet.send(listing.buyerAddress, price)
    console.log(`✅ Punk transferred! Txid: ${punkTxid}`)

    console.log('✅ Atomic swap completed successfully!')

    // Update listing status
    await updateEscrowStatus(punkId, 'sold', {
      soldAt: Date.now(),
      punkTransferTxid: punkTxid,
      paymentTransferTxid: paymentTxid
    })

    console.log('✅ Escrow execution completed')

    const response: ExecuteResponse = {
      success: true,
      punkId,
      punkTxid,
      paymentTxid,
      message: 'Atomic swap executed successfully'
    }

    return res.status(200).json(response)

  } catch (error: any) {
    console.error('❌ Error executing escrow swap:', error)
    return res.status(500).json({
      error: 'Failed to execute swap',
      details: error.message
    })
  }
}
