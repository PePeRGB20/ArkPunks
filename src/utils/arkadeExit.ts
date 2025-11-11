/**
 * Arkade L1 Exit Utilities
 *
 * Handles the process of exiting Arkade to Bitcoin L1 while preserving punk metadata
 * by publishing exit events to Nostr BEFORE the actual exit.
 */

import { publishPunkL1Exit } from './nostrRegistry'
import { loadIdentity } from './arkadeWallet'

export interface PunkExitInfo {
  punkId: string
  owner: string
  vtxoOutpoint: string
  compressedData: string
}

/**
 * Prepare all punks for L1 exit by publishing exit events to Nostr
 * This MUST be called BEFORE actually exiting Arkade
 *
 * @param punks - Array of punks to prepare for exit
 * @param destinationAddress - Bitcoin L1 address where funds will go
 * @param exitType - Type of exit (unilateral or collaborative)
 * @returns Success status and details
 */
export async function prepareL1Exit(
  punks: PunkExitInfo[],
  destinationAddress: string,
  exitType: 'unilateral' | 'collaborative' = 'unilateral'
): Promise<{
  success: boolean
  publishedCount: number
  failedCount: number
  details: string[]
}> {
  const identity = loadIdentity()

  if (!identity) {
    return {
      success: false,
      publishedCount: 0,
      failedCount: punks.length,
      details: ['❌ No Nostr identity found - cannot publish exit events']
    }
  }

  console.log('🚀 Preparing L1 Exit...')
  console.log(`   Destination: ${destinationAddress}`)
  console.log(`   Exit Type: ${exitType}`)
  console.log(`   Punks to exit: ${punks.length}`)
  console.log('')

  const results: string[] = []
  let publishedCount = 0
  let failedCount = 0

  for (const punk of punks) {
    try {
      console.log(`📡 Publishing exit event for punk ${punk.punkId.slice(0, 12)}...`)

      const published = await publishPunkL1Exit(
        punk.punkId,
        punk.vtxoOutpoint,
        destinationAddress,
        punk.compressedData,
        identity.privateKey,
        exitType
      )

      if (published) {
        publishedCount++
        results.push(`✅ ${punk.punkId.slice(0, 12)}... → ${destinationAddress.slice(0, 20)}...`)
        console.log(`   ✅ Published!`)
      } else {
        failedCount++
        results.push(`❌ ${punk.punkId.slice(0, 12)}... - Failed to publish`)
        console.log(`   ❌ Failed!`)
      }
    } catch (error) {
      failedCount++
      results.push(`❌ ${punk.punkId.slice(0, 12)}... - Error: ${error}`)
      console.error(`   ❌ Error:`, error)
    }

    console.log('')
  }

  console.log('━'.repeat(60))
  console.log(`📊 L1 Exit Preparation Complete`)
  console.log(`   Published: ${publishedCount}`)
  console.log(`   Failed: ${failedCount}`)
  console.log('━'.repeat(60))

  return {
    success: publishedCount > 0,
    publishedCount,
    failedCount,
    details: results
  }
}

/**
 * Get exit preparation status message for UI display
 */
export function getExitStatusMessage(
  publishedCount: number,
  failedCount: number,
  totalPunks: number
): string {
  if (publishedCount === 0) {
    return '❌ Failed to publish any exit events. Your punks may be lost if you proceed with the exit!'
  }

  if (failedCount > 0) {
    return `⚠️ Published ${publishedCount}/${totalPunks} exit events. ${failedCount} punk(s) may be lost if you proceed.`
  }

  return `✅ All ${publishedCount} punk(s) prepared for L1 exit!`
}

/**
 * Export wallet data before L1 exit (backup)
 * This creates a JSON backup that can be used to recover punks
 */
export function exportWalletBackup(punks: PunkExitInfo[], walletAddress: string): string {
  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    walletAddress,
    punks: punks.map(p => ({
      punkId: p.punkId,
      owner: p.owner,
      vtxoOutpoint: p.vtxoOutpoint,
      compressedData: p.compressedData
    })),
    note: 'ArkPunks L1 Exit Backup - Keep this safe to recover your punks!'
  }

  return JSON.stringify(backup, null, 2)
}
