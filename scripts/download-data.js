/**
 * Download exported data from Vercel deployment
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXPORT_DIR = join(__dirname, '../data-export')

// Update this URL based on your Vercel deployment
const API_URL = process.argv[2] || 'http://localhost:5173'

async function downloadData() {
  console.log('📥 Downloading data from Vercel...')
  console.log(`   API URL: ${API_URL}`)

  try {
    const response = await fetch(`${API_URL}/api/export-all`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error('Export failed on server')
    }

    console.log(`✅ Data received (exported at: ${new Date(result.exportedAt).toISOString()})`)

    // Create export directory
    mkdirSync(EXPORT_DIR, { recursive: true })

    // Save each data file
    const files = {
      'punk-ownership.json': 'ownership.json',
      'escrow-listings.json': 'listings.json',
      'punk-registry.json': 'registry.json',
      'auto-whitelist.json': 'whitelist.json'
    }

    for (const [blobName, localName] of Object.entries(files)) {
      const data = result.data[blobName]

      if (!data) {
        console.warn(`⚠️  ${blobName}: Not found`)
        continue
      }

      const outputPath = join(EXPORT_DIR, localName)
      writeFileSync(outputPath, JSON.stringify(data, null, 2))

      // Show summary
      if (data.ownership) {
        const count = Object.keys(data.ownership).length
        console.log(`✅ ${localName}: ${count} punks saved`)
      } else if (data.listings) {
        const count = Object.keys(data.listings).length
        console.log(`✅ ${localName}: ${count} listings saved`)
      } else if (data.entries) {
        console.log(`✅ ${localName}: ${data.entries.length} entries saved`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 Download Complete!')
    console.log('='.repeat(60))

    const ownership = result.data['punk-ownership.json']
    if (ownership) {
      const count = Object.keys(ownership.ownership || {}).length
      console.log(`✅ Ownership: ${count} punks with owners`)
    }

    const listings = result.data['escrow-listings.json']
    if (listings) {
      const count = Object.keys(listings.listings || {}).length
      console.log(`✅ Listings: ${count} active marketplace listings`)
    }

    const registry = result.data['punk-registry.json']
    if (registry) {
      console.log(`✅ Registry: ${registry.entries?.length || 0} minted punks`)
    }

    console.log('='.repeat(60))
    console.log(`\n📁 Data saved to: ${EXPORT_DIR}`)

  } catch (error) {
    console.error('❌ Download failed:', error.message)
    process.exit(1)
  }
}

downloadData()
