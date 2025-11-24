/**
 * Active Listings API
 *
 * Returns all active listings from escrow system (deposited or pending)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAllEscrowListings } from './_lib/escrowStore'

interface ListingResponse {
  punkId: string
  price: string // bigint as string
  seller: string // sellerArkAddress
  sellerPubkey: string
  escrowAddress: string
  status: 'pending' | 'deposited'
  createdAt: number
  depositedAt?: number
  compressedMetadata?: string // Compressed punk metadata (hex)
  punkVtxoOutpoint: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('📋 Fetching active listings...')

    // Get all active listings from blob (deposited or pending)
    let allListings
    try {
      allListings = await getAllEscrowListings()
      console.log(`   Active listings in store: ${allListings.length}`)
    } catch (blobError: any) {
      console.error('❌ Failed to read from Vercel Blob:', blobError.message)
      console.error('   Error details:', blobError)
      throw new Error(`Vercel Blob error: ${blobError.message}`)
    }

    // Convert to listings response format
    const listings: ListingResponse[] = allListings.map(listing => ({
      punkId: listing.punkId,
      price: listing.price,
      seller: listing.sellerArkAddress,
      sellerPubkey: listing.sellerPubkey,
      escrowAddress: listing.escrowAddress,
      status: listing.status,
      createdAt: listing.createdAt,
      depositedAt: listing.depositedAt,
      compressedMetadata: listing.compressedMetadata,
      punkVtxoOutpoint: listing.punkVtxoOutpoint
    }))

    console.log('✅ Active listings fetched successfully')
    console.log(`   Total listings: ${listings.length}`)

    return res.status(200).json({
      success: true,
      listings
    })

  } catch (error: any) {
    console.error('❌ Error fetching listings:', error)
    console.error('   Full error:', error)

    // If Vercel Blob is not configured, return empty listings
    if (error.message?.includes('Vercel Blob not configured') ||
        error.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      console.log('⚠️ Vercel Blob not configured, returning empty listings')
      return res.status(200).json({
        success: true,
        listings: []
      })
    }

    return res.status(500).json({
      error: 'Failed to fetch listings',
      details: error.message
    })
  }
}
