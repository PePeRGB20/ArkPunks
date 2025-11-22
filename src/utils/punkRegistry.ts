/**
 * Punk Registry - Manages the global supply cap
 *
 * Uses Nostr relays as the primary source of truth for global supply.
 * Falls back to localStorage if Nostr is unavailable.
 */

import { PUNK_SUPPLY_CONFIG } from '@/config/arkade'
import { getNostrSupply } from './nostrRegistry'

const GLOBAL_REGISTRY_KEY = 'arkade_punks_global_registry'
const REGISTRY_VERSION = 'v2' // Increment this to invalidate old localStorage data

// Cache for Nostr supply (refreshed periodically)
let nostrSupplyCache: {
  totalMinted: number
  punks: Array<{ punkId: string; owner: string; mintedAt: number }>
  lastFetch: number
} | null = null

const CACHE_DURATION = 30000 // 30 seconds

export interface GlobalPunkRegistry {
  version?: string
  totalMinted: number
  punks: {
    punkId: string
    owner: string
    mintedAt: string
  }[]
}

/**
 * Get the global punk registry
 */
function getGlobalRegistry(): GlobalPunkRegistry {
  if (typeof window === 'undefined') {
    return { version: REGISTRY_VERSION, totalMinted: 0, punks: [] }
  }

  const data = localStorage.getItem(GLOBAL_REGISTRY_KEY)
  if (!data) {
    return { version: REGISTRY_VERSION, totalMinted: 0, punks: [] }
  }

  try {
    const registry = JSON.parse(data)

    // Invalidate cache if version mismatch
    if (registry.version !== REGISTRY_VERSION) {
      console.log(`🔄 Registry version mismatch (${registry.version} → ${REGISTRY_VERSION}), clearing cache`)
      return { version: REGISTRY_VERSION, totalMinted: 0, punks: [] }
    }

    return registry
  } catch {
    return { version: REGISTRY_VERSION, totalMinted: 0, punks: [] }
  }
}

/**
 * Save the global punk registry
 */
function saveGlobalRegistry(registry: GlobalPunkRegistry): void {
  if (typeof window === 'undefined') return

  // Ensure version is set
  registry.version = REGISTRY_VERSION
  localStorage.setItem(GLOBAL_REGISTRY_KEY, JSON.stringify(registry))
}

/**
 * Check if we can mint more punks
 */
export function canMintMorePunks(): boolean {
  const registry = getGlobalRegistry()
  return registry.totalMinted < PUNK_SUPPLY_CONFIG.MAX_TOTAL_PUNKS
}

/**
 * Get the global supply from Nostr (with caching)
 */
async function getNostrSupplyWithCache(): Promise<{ totalMinted: number; punks: any[] }> {
  const now = Date.now()

  // Return cache if fresh
  if (nostrSupplyCache && (now - nostrSupplyCache.lastFetch) < CACHE_DURATION) {
    return {
      totalMinted: nostrSupplyCache.totalMinted,
      punks: nostrSupplyCache.punks
    }
  }

  // Fetch from Nostr
  try {
    const supply = await getNostrSupply()
    nostrSupplyCache = {
      totalMinted: supply.totalMinted,
      punks: supply.punks,
      lastFetch: now
    }
    return supply
  } catch (error) {
    console.error('Failed to fetch from Nostr, using localStorage fallback')
    const registry = getGlobalRegistry()
    return {
      totalMinted: registry.totalMinted,
      punks: registry.punks
    }
  }
}

/**
 * Get the number of punks minted so far
 * Now uses Nostr as primary source with localStorage fallback
 */
export function getTotalMintedPunks(): number {
  // Try to use cached Nostr data first
  if (nostrSupplyCache) {
    return nostrSupplyCache.totalMinted
  }

  // Fallback to localStorage
  const registry = getGlobalRegistry()
  return registry.totalMinted
}

/**
 * Refresh supply from Nostr (async version for components)
 */
export async function refreshSupplyFromNostr(): Promise<number> {
  const supply = await getNostrSupplyWithCache()
  return supply.totalMinted
}

/**
 * Get the maximum number of punks allowed
 */
export function getMaxPunks(): number {
  return PUNK_SUPPLY_CONFIG.MAX_TOTAL_PUNKS
}

/**
 * Register a new punk mint
 * Returns true if successful, false if cap is reached
 */
export function registerPunkMint(punkId: string, owner: string): boolean {
  const registry = getGlobalRegistry()

  // Check if we've reached the cap
  if (registry.totalMinted >= PUNK_SUPPLY_CONFIG.MAX_TOTAL_PUNKS) {
    return false
  }

  // Check if this punk ID already exists (prevent duplicates)
  const existingPunk = registry.punks.find(p => p.punkId === punkId)
  if (existingPunk) {
    console.warn('Punk already registered:', punkId)
    return false
  }

  // Register the new punk
  registry.totalMinted += 1
  registry.punks.push({
    punkId,
    owner,
    mintedAt: new Date().toISOString()
  })

  saveGlobalRegistry(registry)
  return true
}

/**
 * Get remaining punks that can be minted
 */
export function getRemainingPunks(): number {
  return PUNK_SUPPLY_CONFIG.MAX_TOTAL_PUNKS - getTotalMintedPunks()
}

/**
 * Check if a specific punk ID has been minted
 */
export function isPunkMinted(punkId: string): boolean {
  const registry = getGlobalRegistry()
  return registry.punks.some(p => p.punkId === punkId)
}

/**
 * Reset the global registry (for testing only!)
 */
export function resetGlobalRegistry(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(GLOBAL_REGISTRY_KEY)
  console.log('🔄 Global punk registry reset')
}
