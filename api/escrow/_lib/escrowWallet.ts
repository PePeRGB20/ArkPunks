/**
 * Escrow Wallet Management
 *
 * This module manages the server-side Arkade wallet used for escrow transactions.
 * The wallet holds punks temporarily until they are sold.
 *
 * SECURITY: The private key is stored in Vercel Environment Variables
 */

import { ArkadeWallet } from '@ark-os/wallet'

// Get escrow wallet private key from environment
const ESCROW_PRIVATE_KEY = process.env.ESCROW_WALLET_PRIVATE_KEY

if (!ESCROW_PRIVATE_KEY) {
  console.warn('⚠️ ESCROW_WALLET_PRIVATE_KEY not set - escrow functions will fail')
}

let escrowWallet: ArkadeWallet | null = null

/**
 * Get or create the escrow wallet instance
 */
export async function getEscrowWallet(): Promise<ArkadeWallet> {
  if (!ESCROW_PRIVATE_KEY) {
    throw new Error('Escrow wallet not configured - missing ESCROW_WALLET_PRIVATE_KEY')
  }

  if (!escrowWallet) {
    // Import wallet from private key
    escrowWallet = await ArkadeWallet.fromPrivateKey(ESCROW_PRIVATE_KEY)
    console.log('🔐 Escrow wallet loaded:', escrowWallet.address.slice(0, 20) + '...')
  }

  return escrowWallet
}

/**
 * Get the escrow wallet address (for receiving punk VTXOs)
 */
export async function getEscrowAddress(): Promise<string> {
  const wallet = await getEscrowWallet()
  return wallet.address
}

/**
 * Check if escrow wallet has received a specific VTXO
 */
export async function hasReceivedVTXO(vtxoOutpoint: string): Promise<boolean> {
  const wallet = await getEscrowWallet()
  const vtxos = await wallet.getVtxos()

  return vtxos.some(v => v.outpoint === vtxoOutpoint)
}

/**
 * Transfer punk VTXO from escrow to buyer
 */
export async function transferPunkToBuyer(
  vtxoOutpoint: string,
  buyerAddress: string,
  punkValue: bigint = 10000n
): Promise<string> {
  const wallet = await getEscrowWallet()

  // Send the punk VTXO to the buyer
  const txid = await wallet.send(buyerAddress, punkValue)

  console.log(`📤 Transferred punk to ${buyerAddress.slice(0, 20)}...`)
  console.log(`   TX ID: ${txid}`)

  return txid
}

/**
 * Send payment to seller (minus marketplace fee)
 */
export async function payoutToSeller(
  sellerAddress: string,
  amount: bigint,
  feePercent: number = 0.5
): Promise<string> {
  const wallet = await getEscrowWallet()

  // Calculate fee and payout
  const fee = (amount * BigInt(Math.floor(feePercent * 100))) / 10000n
  const payout = amount - fee

  console.log(`💰 Paying out ${payout} sats to seller (${fee} sats fee)`)

  // Send payout to seller
  const txid = await wallet.send(sellerAddress, payout)

  console.log(`✅ Payout sent to ${sellerAddress.slice(0, 20)}...`)
  console.log(`   TX ID: ${txid}`)

  return txid
}
