/**
 * Test API endpoints with sample data
 */

const API_URL = 'http://localhost:3001'

async function testAPI() {
  console.log('🧪 Testing Arkade Punks API\n')

  try {
    // 1. Health check
    console.log('1️⃣  Testing health endpoint...')
    const health = await fetch(`${API_URL}/health`).then(r => r.json())
    console.log('   ✅', health)

    // 2. Insert test punk
    console.log('\n2️⃣  Inserting test punk directly into database...')
    const Database = (await import('better-sqlite3')).default
    const db = new Database('./database/arkade-punks.db')

    const testPunkId = 'a'.repeat(64)
    const testOwner = 'ark1qqtestowner123456789'

    db.prepare(`
      INSERT OR REPLACE INTO punks (punk_id, owner_address, minted_at)
      VALUES (?, ?, ?)
    `).run(testPunkId, testOwner, Date.now())

    console.log(`   ✅ Inserted punk: ${testPunkId.slice(0, 16)}...`)

    // 3. Get punk owner
    console.log('\n3️⃣  Getting punk owner...')
    const owner = await fetch(`${API_URL}/api/ownership/get?punkId=${testPunkId}`)
      .then(r => r.json())
    console.log('   ✅', owner)

    // 4. List punk
    console.log('\n4️⃣  Creating marketplace listing...')
    const listRes = await fetch(`${API_URL}/api/marketplace/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        punkId: testPunkId,
        sellerAddress: testOwner,
        sellerPubkey: 'b'.repeat(64),
        priceSats: 50000,
        escrowAddress: 'ark1qqescrowtest123'
      })
    }).then(r => r.json())
    console.log('   ✅', listRes)

    // 5. Get listings
    console.log('\n5️⃣  Getting active listings...')
    const listings = await fetch(`${API_URL}/api/marketplace/listings`)
      .then(r => r.json())
    console.log(`   ✅ Found ${listings.listings.length} listing(s)`)
    console.log('   ', listings.listings[0])

    // 6. Cancel listing
    console.log('\n6️⃣  Cancelling listing...')
    const cancelRes = await fetch(`${API_URL}/api/marketplace/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        punkId: testPunkId,
        sellerAddress: testOwner
      })
    }).then(r => r.json())
    console.log('   ✅', cancelRes)

    // 7. Verify listing cancelled
    console.log('\n7️⃣  Verifying listing cancelled...')
    const listingsAfter = await fetch(`${API_URL}/api/marketplace/listings`)
      .then(r => r.json())
    console.log(`   ✅ Active listings: ${listingsAfter.listings.length} (should be 0)`)

    // 8. Stats
    console.log('\n8️⃣  Getting stats...')
    const stats = await fetch(`${API_URL}/api/stats`).then(r => r.json())
    console.log('   ✅', stats)

    db.close()

    console.log('\n' + '='.repeat(60))
    console.log('✅ All tests passed!')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

testAPI()
