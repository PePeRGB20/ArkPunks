<template>
  <div class="wallet-connect">
    <div v-if="!connected" class="connect-section">
      <h3>Connect Wallet</h3>
      <p class="subtitle">Connect to Arkade {{ config.network }}</p>

      <div class="connect-options">
        <button @click="createNewWallet" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Creating...' : 'Create New Wallet' }}
        </button>

        <button @click="importWallet" class="btn btn-secondary" :disabled="loading">
          Import Existing Wallet
        </button>
      </div>

      <div v-if="showImport" class="import-form">
        <div class="import-tabs">
          <button
            @click="importMode = 'key'"
            :class="{ active: importMode === 'key' }"
            class="tab-button"
          >
            Private Key
          </button>
          <button
            @click="importMode = 'file'"
            :class="{ active: importMode === 'file' }"
            class="tab-button"
          >
            Import File
          </button>
        </div>

        <div v-if="importMode === 'key'">
          <label>
            Private Key (hex):
            <input
              v-model="importPrivateKey"
              type="password"
              placeholder="64 character hex string"
              maxlength="64"
            />
          </label>
          <button @click="doImport" class="btn btn-primary" :disabled="!isValidHex">
            Import
          </button>
        </div>

        <div v-else class="import-file-section">
          <label class="file-upload-label">
            📁 Select exported wallet file (.json):
            <input
              type="file"
              accept=".json"
              @change="handleFileImport"
              class="file-input"
            />
          </label>
          <p class="import-hint">
            Select the wallet JSON file you exported previously. This will restore your wallet and all minted punks.
          </p>
        </div>

        <button @click="showImport = false" class="btn btn-secondary" style="margin-top: 12px;">
          Cancel
        </button>
      </div>

      <div class="network-info">
        <p>Network: <strong>{{ config.network }}</strong></p>
        <p>Server: <a :href="config.arkServerUrl" target="_blank">{{ config.arkServerUrl }}</a></p>
      </div>
    </div>

    <div v-else class="wallet-info">
      <!-- Compact Header -->
      <div class="wallet-compact-header">
        <div class="compact-balance" @click="expanded = !expanded">
          <span class="balance-label">💰</span>
          <span class="balance-value">{{ formatSats(balance.total) }} sats</span>
          <span v-if="!expanded" class="expand-hint">({{ possibleMints }} {{ possibleMints === 1 ? 'punk' : 'punks' }}) ▼</span>
          <span v-else class="expand-hint">▲</span>
        </div>
        <button @click="disconnect" class="btn-disconnect-compact">×</button>
      </div>

      <!-- Expanded Details (collapsible) -->
      <div v-if="expanded" class="wallet-details-expanded"
        :class="{ 'expanded': expanded }">
        <div class="info-header">
          <h3>Wallet Details</h3>
        </div>

      <!-- Funding guide for new wallets -->
      <div v-if="balance.total === 0n" class="funding-guide">
        <h4>💸 Fund Your Wallet</h4>
        <p class="guide-intro">
          Send Bitcoin instantly to your Arkade address from any Arkade wallet.<br/>
          <strong>It's instant and free!</strong>
        </p>

        <div class="qr-section">
          <div class="qr-code">
            <canvas ref="qrCanvas"></canvas>
          </div>
          <div class="address-box">
            <code>{{ arkadeAddress }}</code>
            <button @click="copyArkadeAddress" class="btn-copy-inline">📋</button>
          </div>
        </div>

        <div class="guide-tip">
          <strong>💡 Don't have Bitcoin in Arkade yet?</strong><br/>
          Use the official <a href="https://arkade.money" target="_blank" rel="noopener">Arkade Wallet</a> to:
          <ul>
            <li>🌐 On-ramp from on-chain Bitcoin</li>
            <li>⚡ Fund via Lightning (Boltz plugin)</li>
            <li>🚀 Instant, feeless transfers between Arkade wallets</li>
          </ul>
          <p class="guide-note">
            Minimum: {{ formatSats(minVtxoValue) }} sats | Recommended: 20,000+ sats for multiple punks
          </p>
        </div>
      </div>

      <div class="info-details">
        <div class="detail-row">
          <span class="label">Arkade Address:</span>
          <span class="value monospace">{{ formatAddress(arkadeAddress) }}</span>
          <button @click="copyArkadeAddress" class="btn-copy">📋</button>
        </div>

        <!-- Nostr Public Key (for receiving punk transfers) -->
        <div class="nostr-pubkey-section">
          <button @click="showNostrPubkey = !showNostrPubkey" class="btn-toggle-nostr">
            {{ showNostrPubkey ? '▼' : '▶' }} Nostr Public Key (for receiving transfers)
          </button>

          <div v-if="showNostrPubkey" class="nostr-pubkey-content">
            <p class="nostr-hint">
              Share this <strong>npub</strong> key with others so they can send you punks directly.<br>
              This is your Nostr public identifier (compatible with all Nostr apps).
            </p>
            <div class="nostr-pubkey-box">
              <code class="nostr-pubkey-value">{{ nostrPubkey }}</code>
              <button @click="copyNostrPubkey" class="btn-copy-inline">📋</button>
            </div>
          </div>
        </div>

        <div class="detail-row">
          <span class="label">Balance:</span>
          <span class="value">
            <span class="balance-amount">{{ formatSats(balance.total) }}</span> sats
          </span>
        </div>

        <div class="detail-row">
          <span class="label">Available for mint:</span>
          <span class="value">
            {{ formatSats(balance.available) }} sats
            <span class="mints-available">({{ possibleMints }} {{ possibleMints === 1 ? 'punk' : 'punks' }})</span>
          </span>
        </div>

        <div class="detail-row">
          <span class="label">VTXOs:</span>
          <span class="value">{{ vtxoCount }}</span>
        </div>

        <div class="detail-row">
          <span class="label">Status:</span>
          <span class="value">
            <span v-if="canMintPunks" class="status-ready">Ready to mint 🎨</span>
            <span v-else class="status-need-funds">Need funds</span>
          </span>
        </div>
      </div>

      <div class="wallet-actions">
        <button @click="refreshBalance" class="btn btn-secondary" :disabled="refreshing">
          {{ refreshing ? 'Refreshing...' : '🔄 Refresh' }}
        </button>

        <button @click="runDiagnostics" class="btn btn-diagnostic">
          🔍 Nostr Diagnostic
        </button>

        <button @click="exportWallet" class="btn btn-export">
          💾 Export Wallet
        </button>

        <button @click="showExitModal = true" class="btn btn-exit-l1">
          🟠 Exit to L1
        </button>
      </div>

      <!-- L1 Exit Modal -->
      <div v-if="showExitModal" class="modal-overlay" @click="showExitModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>🟠 Exit Arkade to Bitcoin L1</h3>
            <button @click="showExitModal = false" class="btn-close">×</button>
          </div>

          <div class="modal-body">
            <div class="warning-box">
              <p><strong>⚠️ Important:</strong> Before exiting Arkade, we'll publish your punks to Nostr.</p>
              <p>This ensures your punks remain recoverable after converting VTXOs to standard Bitcoin UTXOs.</p>
            </div>

            <div v-if="userPunksForExit.length > 0" class="exit-punks-list">
              <h4>Punks to Preserve:</h4>
              <div class="punk-exit-items">
                <div v-for="punk in userPunksForExit" :key="punk.punkId" class="punk-exit-item">
                  <img :src="punk.metadata.imageUrl" :alt="punk.metadata.name" class="punk-exit-thumb" />
                  <div class="punk-exit-info">
                    <div class="punk-exit-name">{{ punk.metadata.name }}</div>
                    <div class="punk-exit-id">{{ punk.punkId.slice(0, 16) }}...</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="no-punks-message">
              <p>No punks found in your wallet.</p>
            </div>

            <div class="exit-address-input">
              <label>
                <strong>Bitcoin L1 Destination Address:</strong>
                <input
                  v-model="exitL1Address"
                  type="text"
                  placeholder="bc1q..."
                  class="input-address"
                />
              </label>
              <p class="input-hint">
                Enter the Bitcoin address where you'll receive the funds after exiting Arkade.
              </p>
            </div>

            <div v-if="exitPreparationStatus" class="exit-status">
              <p :class="exitPreparationSuccess ? 'status-success' : 'status-error'">
                {{ exitPreparationStatus }}
              </p>
            </div>
          </div>

          <div class="modal-footer">
            <button
              @click="prepareExit"
              :disabled="!exitL1Address || preparingExit || userPunksForExit.length === 0"
              class="btn btn-primary"
            >
              {{ preparingExit ? 'Publishing to Nostr...' : '1️⃣ Prepare Exit (Publish to Nostr)' }}
            </button>

            <button
              v-if="exitPreparationSuccess"
              @click="performActualExit"
              class="btn btn-exit"
            >
              2️⃣ Proceed with L1 Exit
            </button>

            <button @click="showExitModal = false" class="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
      </div>
      <!-- End expanded details -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  clearIdentity,
  createArkadeWallet,
  getWalletInfo,
  type ArkadeWalletInterface,
  type WalletBalance
} from '@/utils/arkadeWallet'
import { getActiveConfig, getNetworkParams } from '@/config/arkade'
import { hex } from '@scure/base'
import QRCode from 'qrcode'
import { generatePunkImage } from '@/utils/generator'
import { getPublicKey, nip19 } from 'nostr-tools'
import { queryAllPunkMints, queryPunksByPubkey, queryPunksByAddress } from '@/utils/nostrDiagnostics'
import { prepareL1Exit, getExitStatusMessage, type PunkExitInfo } from '@/utils/arkadeExit'

const config = getActiveConfig()
const params = getNetworkParams()

const connected = ref(false)
const loading = ref(false)
const refreshing = ref(false)
const showImport = ref(false)
const importPrivateKey = ref('')
const importMode = ref<'key' | 'file'>('key')
const showNostrPubkey = ref(false)
const expanded = ref(false) // Wallet details collapsed by default

// L1 Exit modal state
const showExitModal = ref(false)
const exitL1Address = ref('')
const preparingExit = ref(false)
const exitPreparationStatus = ref('')
const exitPreparationSuccess = ref(false)

const qrCanvas = ref<HTMLCanvasElement | null>(null)
const walletAddress = ref('')
const boardingAddress = ref('') // bc1p... address for on-chain boarding
const arkadeAddress = ref('') // ark... address for native off-chain transfers
const balance = ref<WalletBalance>({
  boarding: 0n,
  available: 0n,
  settled: 0n,
  preconfirmed: 0n,
  recoverable: 0n,
  total: 0n
})
const vtxoCount = ref(0)

let wallet: ArkadeWalletInterface | null = null

const minVtxoValue = params.minVtxoValue

const canMintPunks = computed(() => balance.value.available >= minVtxoValue)

const possibleMints = computed(() => {
  return Number(balance.value.available / minVtxoValue)
})

const isValidHex = computed(() => {
  return /^[0-9a-fA-F]{64}$/.test(importPrivateKey.value)
})

const nostrPubkey = computed(() => {
  const privateKeyHex = localStorage.getItem('arkade_wallet_private_key')
  if (!privateKeyHex) return ''

  try {
    const pubkeyHex = getPublicKey(hex.decode(privateKeyHex))
    // Convert to npub (Bech32 format) - standard Nostr format
    return nip19.npubEncode(pubkeyHex)
  } catch (error) {
    console.error('Failed to derive Nostr pubkey:', error)
    return ''
  }
})

const userPunksForExit = computed(() => {
  try {
    const punksJson = localStorage.getItem('arkade_punks')
    if (!punksJson) return []

    const allPunks = JSON.parse(punksJson)

    // Filter punks owned by this wallet
    return allPunks.filter((punk: any) => punk.owner === walletAddress.value)
  } catch (error) {
    console.error('Failed to load punks for exit:', error)
    return []
  }
})

async function createNewWallet() {
  loading.value = true

  try {
    const identity = await generateIdentity()
    saveIdentity(identity)

    wallet = await createArkadeWallet(identity)
    await updateWalletInfo()

    connected.value = true
  } catch (error) {
    console.error('Failed to create wallet:', error)
    alert('Failed to create wallet. See console for details.')
  } finally {
    loading.value = false
  }
}

function importWallet() {
  showImport.value = true
}

async function doImport() {
  if (!isValidHex.value) return

  loading.value = true

  try {
    const privateKey = hex.decode(importPrivateKey.value)
    const { schnorr } = await import('@noble/secp256k1')
    const publicKey = schnorr.getPublicKey(privateKey)

    const identity = { privateKey, publicKey }
    saveIdentity(identity)

    wallet = await createArkadeWallet(identity)
    await updateWalletInfo()

    connected.value = true
    showImport.value = false
    importPrivateKey.value = ''
  } catch (error) {
    console.error('Failed to import wallet:', error)
    alert('Failed to import wallet. Check your private key.')
  } finally {
    loading.value = false
  }
}

async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  loading.value = true

  try {
    const text = await file.text()
    const walletData = JSON.parse(text)

    console.log('📦 Importing wallet from file:', walletData)

    // Validate file structure
    if (!walletData.wallet?.privateKey) {
      throw new Error('Invalid wallet file: missing private key')
    }

    // Import private key
    const privateKey = hex.decode(walletData.wallet.privateKey)
    const { schnorr } = await import('@noble/secp256k1')
    const publicKey = schnorr.getPublicKey(privateKey)

    const identity = { privateKey, publicKey }
    saveIdentity(identity)

    // Restore punks to localStorage
    if (walletData.punks && Array.isArray(walletData.punks)) {
      console.log(`📦 Restoring ${walletData.punks.length} punk(s)...`)

      // Reconstruct full metadata structure with regenerated images
      const punksToSave = walletData.punks.map((punk: any) => {
        const type = punk.type
        const attributes = punk.attributes || []
        const background = punk.background

        // Regenerate image URL from traits
        const imageUrl = generatePunkImage(type, attributes, background)

        return {
          punkId: punk.punkId,
          name: punk.name,
          description: punk.description,
          imageUrl, // Regenerated image
          traits: {
            type,
            attributes,
            background
          },
          mintDate: punk.mintDate,
          vtxoOutpoint: punk.vtxoOutpoint
        }
      })

      localStorage.setItem('arkade_punks', JSON.stringify(punksToSave))
      console.log('✅ Punks restored to localStorage with regenerated images')
    }

    wallet = await createArkadeWallet(identity)
    await updateWalletInfo()

    connected.value = true
    showImport.value = false

    alert(`✅ Wallet imported successfully!\n\n${walletData.punks?.length || 0} punk(s) restored.`)

    // Reload page to refresh punk gallery
    setTimeout(() => window.location.reload(), 500)
  } catch (error: any) {
    console.error('Failed to import wallet file:', error)
    alert(`Failed to import wallet file: ${error.message}`)
  } finally {
    loading.value = false
    // Reset file input
    target.value = ''
  }
}

function disconnect() {
  clearIdentity()
  wallet = null
  connected.value = false
  walletAddress.value = ''
  boardingAddress.value = ''
  arkadeAddress.value = ''
  balance.value = {
    boarding: 0n,
    available: 0n,
    settled: 0n,
    preconfirmed: 0n,
    recoverable: 0n,
    total: 0n
  }
  vtxoCount.value = 0
}

async function refreshBalance() {
  if (!wallet) return

  refreshing.value = true

  try {
    await updateWalletInfo()
    console.log('✅ Balance refreshed')
  } catch (error) {
    console.error('Failed to refresh balance:', error)
  } finally {
    refreshing.value = false
  }
}

async function generateQRCode(retryCount = 0) {
  console.log('🔍 Attempting to generate QR code... (attempt', retryCount + 1, ')')
  console.log('   arkadeAddress:', arkadeAddress.value)
  console.log('   qrCanvas ref:', qrCanvas.value)
  console.log('   balance.total:', balance.value.total)

  if (!arkadeAddress.value) {
    console.warn('⚠️ Cannot generate QR: arkadeAddress is empty')
    return
  }

  if (!qrCanvas.value) {
    console.warn('⚠️ Cannot generate QR: qrCanvas ref is not available')

    // Retry up to 5 times with increasing delay
    if (retryCount < 5) {
      const delay = (retryCount + 1) * 100 // 100ms, 200ms, 300ms, etc.
      console.log(`   Retrying in ${delay}ms...`)
      setTimeout(() => generateQRCode(retryCount + 1), delay)
    } else {
      console.error('❌ Failed to generate QR code after 5 attempts - canvas not available')
    }
    return
  }

  try {
    await QRCode.toCanvas(qrCanvas.value, arkadeAddress.value, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
    console.log('✅ QR code generated successfully for:', arkadeAddress.value)
  } catch (error) {
    console.error('❌ Failed to generate QR code:', error)
  }
}

async function updateWalletInfo() {
  if (!wallet) return

  const info = await getWalletInfo(wallet)
  walletAddress.value = info.address
  boardingAddress.value = wallet.boardingAddress || '' // bc1p... for on-chain boarding
  arkadeAddress.value = wallet.arkadeAddress || '' // ark... for native transfers
  balance.value = info.balance
  vtxoCount.value = info.vtxoCount

  console.log('📍 Addresses updated:')
  console.log('   Arkade (native):', arkadeAddress.value)
  console.log('   Boarding (on-chain):', boardingAddress.value)

  // Generate QR code when address is available
  if (arkadeAddress.value && balance.value.total === 0n) {
    await nextTick()
    // Give Vue extra time to render the canvas in the DOM
    setTimeout(() => generateQRCode(), 50)
  }
}

function formatAddress(addr: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`
}

function formatSats(sats: bigint): string {
  return sats.toLocaleString()
}

async function copyAddress() {
  if (!walletAddress.value) return

  try {
    await navigator.clipboard.writeText(walletAddress.value)
    alert('Address copied to clipboard!')
  } catch {
    console.error('Failed to copy address')
  }
}

async function copyArkadeAddress() {
  if (!arkadeAddress.value) return

  try {
    await navigator.clipboard.writeText(arkadeAddress.value)
    alert('⚡ Arkade address copied!')
  } catch {
    console.error('Failed to copy Arkade address')
  }
}

async function copyNostrPubkey() {
  if (!nostrPubkey.value) return

  try {
    await navigator.clipboard.writeText(nostrPubkey.value)
    alert('📋 Nostr npub copied! Share this with others to receive punk transfers.')
  } catch {
    console.error('Failed to copy Nostr pubkey')
  }
}

async function runDiagnostics() {
  try {
    console.log('🔍 Running Nostr diagnostics...')
    console.log('━'.repeat(60))

    // Get current identity
    const privateKeyHex = localStorage.getItem('arkade_wallet_private_key')
    if (!privateKeyHex) {
      console.error('❌ No private key found')
      return
    }

    const pubkeyHex = getPublicKey(hex.decode(privateKeyHex))

    console.log('📋 Your Identity:')
    console.log('   Nostr pubkey (hex):', pubkeyHex)
    console.log('   Nostr pubkey (npub):', nip19.npubEncode(pubkeyHex))
    console.log('   Bitcoin address:', walletAddress.value)
    console.log('')

    // Query all punks on Nostr
    const allPunks = await queryAllPunkMints()
    console.log('')

    if (allPunks.length > 0) {
      // Query punks for this specific user
      console.log('━'.repeat(60))
      await queryPunksByPubkey(pubkeyHex)
      console.log('')
      await queryPunksByAddress(walletAddress.value)
    }

    console.log('━'.repeat(60))
    console.log('✅ Diagnostic complete - check console output above')

    alert(`🔍 Nostr Diagnostic Complete!\n\nFound ${allPunks.length} total punks on Nostr.\n\nCheck the browser console (F12) for detailed analysis.`)
  } catch (error) {
    console.error('❌ Diagnostic failed:', error)
    alert('Diagnostic failed. Check console for details.')
  }
}

async function copyBoardingAddress() {
  if (!boardingAddress.value) return

  try {
    await navigator.clipboard.writeText(boardingAddress.value)
    alert('⚡ Boarding address copied! Use this for on-chain funding.')
  } catch {
    console.error('Failed to copy boarding address')
  }
}

function exportWallet() {
  try {
    // Get wallet keys from localStorage
    const privateKey = localStorage.getItem('arkade_wallet_private_key')
    const publicKey = localStorage.getItem('arkade_wallet_public_key')

    // Get punks from localStorage
    const punksJson = localStorage.getItem('arkade_punks')
    const punks = punksJson ? JSON.parse(punksJson) : []

    // Get current config
    const network = config.network

    // Create export object
    const exportData = {
      exportDate: new Date().toISOString(),
      network: network,
      wallet: {
        privateKey: privateKey || 'Not found',
        publicKey: publicKey || 'Not found',
        address: walletAddress.value,
        boardingAddress: boardingAddress.value
      },
      balance: {
        available: balance.value.available.toString(),
        boarding: balance.value.boarding.toString(),
        total: balance.value.total.toString(),
        vtxoCount: vtxoCount.value
      },
      punks: punks.map((punk: any) => ({
        punkId: punk.punkId,
        name: punk.name,
        type: punk.traits?.type,
        attributes: punk.traits?.attributes || [],
        background: punk.traits?.background,
        description: punk.description,
        mintDate: punk.mintDate || new Date().toISOString(),
        vtxoOutpoint: punk.vtxoOutpoint
      })),
      totalPunksMinted: punks.length,
      notes: [
        "⚠️ KEEP THIS FILE SECURE - Contains private key",
        "ArkPunks wallet with 6-byte compression on Arkade Protocol",
        "To restore: Import private key in ArkPunks interface"
      ]
    }

    // Create blob and download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arkade-wallet-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    alert('✅ Wallet exported!\n\n⚠️ Keep this file safe - it contains your private key!')
  } catch (error) {
    console.error('Export failed:', error)
    alert('Failed to export wallet. See console for details.')
  }
}

async function prepareExit() {
  preparingExit.value = true
  exitPreparationStatus.value = ''
  exitPreparationSuccess.value = false

  try {
    // Prepare punk data for exit
    const punkExitData: PunkExitInfo[] = userPunksForExit.value.map((punk: any) => ({
      punkId: punk.punkId,
      owner: punk.owner,
      vtxoOutpoint: punk.vtxoOutpoint,
      compressedData: punk.compressedData || '000000000000' // Fallback if missing
    }))

    if (punkExitData.length === 0) {
      exitPreparationStatus.value = 'No punks to prepare for exit.'
      return
    }

    // Publish exit events to Nostr
    const result = await prepareL1Exit(punkExitData, exitL1Address.value, 'unilateral')

    exitPreparationStatus.value = getExitStatusMessage(
      result.publishedCount,
      result.failedCount,
      userPunksForExit.value.length
    )
    exitPreparationSuccess.value = result.success

    if (result.success) {
      console.log('✅ Exit preparation complete!')
      console.log('   Published:', result.publishedCount)
      console.log('   Failed:', result.failedCount)
      console.log('   Details:', result.details)

      alert(`✅ Exit Prepared!\n\n${result.publishedCount} punk(s) published to Nostr.\n\nYou can now proceed with the L1 exit.`)
    }
  } catch (error) {
    console.error('❌ Exit preparation failed:', error)
    exitPreparationStatus.value = `❌ Error: ${error}`
    exitPreparationSuccess.value = false
    alert(`Failed to prepare exit: ${error}`)
  } finally {
    preparingExit.value = false
  }
}

async function performActualExit() {
  const confirmed = confirm(
    `🟠 Bitcoin L1 Exit\n\n` +
    `You are about to exit Arkade and convert your VTXOs to standard Bitcoin UTXOs.\n\n` +
    `✅ Your ${userPunksForExit.value.length} punk(s) have been published to Nostr and are safe!\n\n` +
    `Destination: ${exitL1Address.value}\n\n` +
    `⚠️ This action cannot be undone. Continue?`
  )

  if (!confirmed) return

  try {
    console.log('🚀 Performing L1 exit...')
    console.log('   Destination:', exitL1Address.value)
    console.log('   Balance:', formatSats(balance.value.total), 'sats')

    // Note: Arkade SDK doesn't expose unilateralExit() directly yet
    // For now, we just show instructions
    alert(
      `🟠 L1 Exit Instructions\n\n` +
      `Your punks are now published to Nostr and linked to:\n` +
      `${exitL1Address.value}\n\n` +
      `To complete the exit:\n` +
      `1. Use the Arkade SDK's unilateral exit function\n` +
      `2. Your funds will be sent to the L1 address\n` +
      `3. Your punks can be recovered using your Nostr private key\n\n` +
      `Recovery pubkey: ${nostrPubkey.value.slice(0, 20)}...`
    )

    // Close modal
    showExitModal.value = false
  } catch (error) {
    console.error('❌ Exit failed:', error)
    alert(`Exit failed: ${error}`)
  }
}

// Watch for arkade address changes to generate QR code
watch(arkadeAddress, async (newAddress) => {
  if (newAddress && balance.value.total === 0n) {
    await nextTick()
    // Give Vue extra time to render the canvas in the DOM
    setTimeout(() => generateQRCode(), 50)
  }
})

// Check for existing wallet on mount
onMounted(async () => {
  const identity = loadIdentity()
  if (identity) {
    loading.value = true
    try {
      wallet = await createArkadeWallet(identity)
      await updateWalletInfo()
      connected.value = true
    } catch (error) {
      console.error('Failed to restore wallet:', error)
      clearIdentity()
    } finally {
      loading.value = false
    }
  }
})

// Expose wallet getter function to parent
function getWallet(): ArkadeWalletInterface | null {
  return wallet
}

// Expose wallet to parent
defineExpose({
  getWallet,
  wallet: computed(() => wallet),
  connected
})
</script>

<style scoped>
.wallet-connect {
  background: #1a1a1a;
  border: 2px solid #333;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

/* Compact Wallet Header */
.wallet-compact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.compact-balance {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  background: #2a2a2a;
  border-radius: 6px;
  flex: 1;
  transition: all 0.2s ease;
}

.compact-balance:hover {
  background: #333;
}

.balance-label {
  font-size: 20px;
}

.balance-value {
  color: #ff6b35;
  font-weight: bold;
  font-size: 16px;
}

.expand-hint {
  color: #888;
  font-size: 13px;
  margin-left: auto;
}

.btn-disconnect-compact {
  padding: 8px 12px;
  background: #444;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  transition: all 0.2s ease;
}

.btn-disconnect-compact:hover {
  background: #ef4444;
}

.wallet-details-expanded {
  animation: slideDown 0.3s ease;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #333;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h3 {
  margin: 0 0 8px 0;
  color: #fff;
}

.subtitle {
  color: #888;
  margin: 0 0 24px 0;
}

.connect-options {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #ff6b35;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #ff8555;
}

.btn-secondary {
  background: #333;
  color: #fff;
}

.btn-secondary:hover:not(:disabled) {
  background: #444;
}

.btn-export {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: 2px solid #764ba2;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  width: 100%;
}

.btn-export:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(118, 75, 162, 0.4);
}

.btn-diagnostic {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  border: 2px solid #d97706;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  width: 100%;
}

.btn-diagnostic:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.4);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-form {
  background: #2a2a2a;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 24px;
}

.import-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 2px solid #444;
}

.tab-button {
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: #888;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.tab-button.active {
  color: #ff6b35;
  border-bottom-color: #ff6b35;
}

.import-form label {
  display: block;
  color: #aaa;
  margin-bottom: 12px;
}

.import-form input[type="password"],
.import-form input[type="text"] {
  width: 100%;
  padding: 8px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  font-family: monospace;
  margin-top: 8px;
}

.import-file-section {
  padding: 16px 0;
}

.file-upload-label {
  display: block;
  padding: 24px;
  background: #1a1a1a;
  border: 2px dashed #444;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #aaa;
  margin-bottom: 12px;
}

.file-upload-label:hover {
  border-color: #ff6b35;
  background: #222;
}

.file-input {
  display: block;
  margin-top: 12px;
  color: #fff;
  cursor: pointer;
}

.file-input::file-selector-button {
  padding: 8px 16px;
  background: #ff6b35;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-weight: 500;
  margin-right: 12px;
}

.file-input::file-selector-button:hover {
  background: #ff8555;
}

.import-hint {
  color: #888;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.network-info {
  background: #2a2a2a;
  padding: 16px;
  border-radius: 6px;
  border-left: 4px solid #ff6b35;
}

.network-info p {
  margin: 4px 0;
  color: #aaa;
}

.network-info strong {
  color: #fff;
}

.network-info a {
  color: #ff6b35;
  text-decoration: none;
}

.network-info a:hover {
  text-decoration: underline;
}

.wallet-info {
  padding: 8px 0;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.btn-disconnect {
  padding: 8px 16px;
  background: #444;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}

.btn-disconnect:hover {
  background: #555;
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-row.highlight {
  background: rgba(255, 193, 7, 0.1);
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid #fbbf24;
}

/* Nostr Public Key Section */
.nostr-pubkey-section {
  margin: 16px 0;
  padding: 12px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
}

.btn-toggle-nostr {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: #6366f1;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-toggle-nostr:hover {
  color: #818cf8;
}

.nostr-pubkey-content {
  margin-top: 12px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 200px;
  }
}

.nostr-hint {
  color: #aaa;
  font-size: 13px;
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.nostr-pubkey-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 6px;
}

.nostr-pubkey-value {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: #6366f1;
  word-break: break-all;
  line-height: 1.4;
}

.label {
  color: #888;
  min-width: 80px;
}

.value {
  color: #fff;
  font-weight: 500;
}

.monospace {
  font-family: monospace;
  font-size: 14px;
}

.balance-amount {
  color: #ff6b35;
  font-size: 18px;
  font-weight: bold;
}

.balance-boarding {
  color: #fbbf24;
  font-size: 16px;
  font-weight: bold;
}

.balance-total {
  color: #4ade80;
  font-weight: bold;
}

.balance-onchain {
  color: #888;
  font-weight: normal;
}

.mints-available {
  color: #4ade80;
  font-weight: 600;
  margin-left: 8px;
}

.btn-copy {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-copy:hover {
  background: #333;
}

.status-ready {
  color: #4ade80;
}

.status-need-funds {
  color: #fbbf24;
}

.wallet-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.wallet-actions .btn {
  flex: 1;
}

.boarding-prompt {
  background: #2a2a2a;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  text-align: center;
  border: 2px solid #fbbf24;
}

.boarding-prompt p {
  color: #fff;
  margin: 0 0 8px 0;
  font-weight: bold;
}

.boarding-info {
  color: #aaa !important;
  font-weight: normal !important;
  font-size: 14px;
  margin-bottom: 12px !important;
}

.funding-prompt {
  background: #2a2a2a;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  text-align: center;
}

.funding-prompt p {
  color: #fbbf24;
  margin: 0 0 12px 0;
}

.info-box {
  background: #1a2332;
  border: 2px solid #4ade80;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.info-box.boarding-status {
  border-color: #fbbf24;
  background: #2a2416;
}

.info-box.boarding-status .info-title {
  color: #fbbf24;
}

.info-box.boarding-success {
  border-color: #4ade80;
  background: #1a2a1a;
}

.info-box.boarding-success .info-title {
  color: #4ade80;
}

.info-title {
  color: #4ade80;
  font-weight: bold;
  font-size: 16px;
  margin: 0 0 16px 0;
}

.info-text {
  color: #ccc;
  margin: 0 0 12px 0;
  line-height: 1.6;
}

.info-steps {
  color: #ddd;
  margin: 0;
  padding-left: 24px;
  line-height: 1.8;
}

.info-steps li {
  margin-bottom: 8px;
}

.info-steps strong {
  color: #fbbf24;
}

.info-steps a {
  color: #ff6b35;
  text-decoration: none;
  font-weight: bold;
}

.info-steps a:hover {
  text-decoration: underline;
}

/* Boarding alert */
.boarding-alert {
  background: linear-gradient(135deg, #2a2416 0%, #3a3020 100%);
  border: 2px solid #fbbf24;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  text-align: center;
}

.boarding-alert h4 {
  color: #fbbf24;
  margin: 0 0 12px 0;
  font-size: 18px;
}

.boarding-alert p {
  color: #ddd;
  margin: 0 0 16px 0;
}

.boarding-alert strong {
  color: #fff;
  font-size: 20px;
}

/* Funding guide */
.funding-guide {
  background: #1a1a1a;
  border: 2px solid #4ade80;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
}

.funding-guide h4 {
  color: #4ade80;
  margin: 0 0 12px 0;
  font-size: 18px;
}

.guide-intro {
  color: #ddd;
  margin: 0 0 24px 0;
  text-align: center;
  line-height: 1.6;
}

.guide-intro strong {
  color: #4ade80;
  font-size: 16px;
}

/* QR Code section */
.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.qr-code {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.qr-code canvas {
  display: block;
}

.guide-step {
  background: #2a2a2a;
  border-left: 4px solid #ff6b35;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;
}

.guide-step strong {
  color: #ff6b35;
  display: block;
  margin-bottom: 8px;
  font-size: 16px;
}

.guide-note {
  color: #aaa;
  font-size: 14px;
  margin: 8px 0 0 0;
  line-height: 1.6;
}

.guide-tip {
  background: #1a2a1a;
  border: 2px solid #4ade80;
  border-radius: 6px;
  padding: 20px;
  color: #ddd;
  text-align: left;
}

.guide-tip strong {
  color: #4ade80;
  font-size: 16px;
}

.guide-tip ul {
  margin: 12px 0;
  padding-left: 24px;
  list-style: none;
}

.guide-tip li {
  margin: 8px 0;
  line-height: 1.6;
  color: #ccc;
}

.guide-tip li::before {
  content: '→ ';
  color: #4ade80;
  font-weight: bold;
  margin-right: 8px;
}

.guide-tip a {
  color: #ff6b35;
  text-decoration: none;
  font-weight: bold;
}

.guide-tip a:hover {
  text-decoration: underline;
}

.address-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0a0a0a;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 12px;
  width: 100%;
  max-width: 500px;
}

.address-box code {
  flex: 1;
  color: #4ade80;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  word-break: break-all;
}

.btn-copy-inline {
  background: transparent;
  border: 1px solid #444;
  color: #fff;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-copy-inline:hover {
  background: #333;
  border-color: #ff6b35;
}

/* L1 Exit Button */
.btn-exit-l1 {
  background: linear-gradient(135deg, #f7931a 0%, #ff9500 100%);
  color: #fff;
  border: 2px solid #f7931a;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  width: 100%;
}

.btn-exit-l1:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(247, 147, 26, 0.4);
}

/* Exit Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #1a1a1a;
  border: 2px solid #f7931a;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(247, 147, 26, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  color: #f7931a;
  font-size: 24px;
}

.btn-close {
  background: transparent;
  border: none;
  color: #888;
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #ff6b35;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #333;
}

.warning-box {
  background: #2a1a0a;
  border: 2px solid #f7931a;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.warning-box p {
  color: #fbbf24;
  margin: 8px 0;
  line-height: 1.6;
}

.warning-box strong {
  color: #f7931a;
}

.exit-punks-list {
  margin: 20px 0;
}

.exit-punks-list h4 {
  color: #fff;
  margin: 0 0 12px 0;
  font-size: 16px;
}

.punk-exit-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 200px;
  overflow-y: auto;
  background: #2a2a2a;
  border-radius: 8px;
  padding: 12px;
}

.punk-exit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1a1a1a;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #444;
}

.punk-exit-thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  image-rendering: pixelated;
}

.punk-exit-info {
  flex: 1;
}

.punk-exit-name {
  color: #fff;
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 4px;
}

.punk-exit-id {
  color: #888;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.no-punks-message {
  text-align: center;
  padding: 40px 20px;
  color: #888;
}

.exit-address-input {
  margin: 20px 0;
}

.exit-address-input label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #fff;
}

.input-address {
  padding: 12px;
  background: #2a2a2a;
  border: 2px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  transition: border-color 0.2s;
}

.input-address:focus {
  outline: none;
  border-color: #f7931a;
}

.input-hint {
  color: #888;
  font-size: 13px;
  margin: 4px 0 0 0;
}

.exit-status {
  margin: 16px 0;
  padding: 12px;
  border-radius: 6px;
  font-weight: bold;
}

.status-success {
  background: #1a2a1a;
  border: 2px solid #4ade80;
  color: #4ade80;
}

.status-error {
  background: #2a1a1a;
  border: 2px solid #ff6b35;
  color: #ff6b35;
}

.btn-exit {
  background: linear-gradient(135deg, #ff6b35 0%, #ff8555 100%);
  color: #fff;
  border: 2px solid #ff6b35;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
}

.btn-exit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
}

@media (max-width: 768px) {
  .modal-content {
    max-width: 100%;
    margin: 20px;
  }

  .punk-exit-items {
    max-height: 150px;
  }
}
</style>
