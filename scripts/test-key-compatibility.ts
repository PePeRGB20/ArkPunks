/**
 * Test Key Compatibility
 *
 * This script tests if a Nostr nsec key from arkade.money wallet
 * produces the same Arkade address when used with the SDK.
 *
 * Usage:
 *   tsx scripts/test-key-compatibility.ts <your-nsec-key>
 */

async function testKeyCompatibility() {
  const nsecFromArgs = process.argv[2]

  if (!nsecFromArgs || !nsecFromArgs.startsWith('nsec')) {
    console.log('❌ Usage: tsx scripts/test-key-compatibility.ts <your-nsec-key>')
    console.log('   Example: tsx scripts/test-key-compatibility.ts nsec1abc...')
    console.log('')
    console.log('💡 To get your nsec from arkade.money:')
    console.log('   1. Open arkade.money wallet')
    console.log('   2. Go to Settings')
    console.log('   3. Export/Show private key (nsec format)')
    console.log('   4. Run this script with that nsec')
    process.exit(1)
  }

  try {
    console.log('🔍 Testing Nostr key compatibility with Arkade SDK...\n')

    // Import required libraries
    const { nip19 } = await import('nostr-tools')
    const { Wallet, SingleKey } = await import('@arkade-os/sdk')

    // Step 1: Decode nsec to hex
    console.log('Step 1: Decoding nsec key...')
    const decoded = nip19.decode(nsecFromArgs)

    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec key')
    }

    const privateKeyHex = decoded.data as string
    console.log(`   ✅ Private key (hex): ${privateKeyHex.slice(0, 16)}...`)
    console.log(`   (Full hex length: ${privateKeyHex.length} chars = ${privateKeyHex.length / 2} bytes)`)

    // Step 2: Create SDK identity
    console.log('\nStep 2: Creating Arkade SDK identity...')
    const identity = SingleKey.fromHex(privateKeyHex)
    console.log('   ✅ Identity created')

    // Step 3: Create wallet (testnet)
    console.log('\nStep 3: Creating Arkade wallet (testnet)...')
    const wallet = await Wallet.create({
      identity,
      esploraUrl: 'https://mutinynet.com/api',
      arkServerUrl: 'https://mutinynet.arkade.sh',
    })
    console.log('   ✅ Wallet created')

    // Step 4: Get addresses
    console.log('\nStep 4: Getting wallet addresses...')
    const arkadeAddress = await wallet.getAddress()
    const boardingAddress = await wallet.getBoardingAddress()

    console.log(`   Arkade Address: ${arkadeAddress}`)
    console.log(`   Boarding Address: ${boardingAddress}`)

    // Step 5: Check balance
    console.log('\nStep 5: Checking balance...')
    const balance = await wallet.getBalance()
    console.log(`   Balance: ${balance.available} sats`)
    console.log(`   Total: ${balance.total} sats`)

    // Results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('   COMPATIBILITY TEST RESULTS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('✅ SUCCESS! Your nsec key works with Arkade SDK!\n')
    console.log('📋 Addresses derived from your key:')
    console.log(`   Arkade:  ${arkadeAddress}`)
    console.log(`   Boarding: ${boardingAddress}`)
    console.log('')

    console.log('🎯 Next steps:')
    console.log('1. Compare these addresses with your arkade.money wallet')
    console.log('2. If they MATCH ✅ → Use this nsec as ESCROW_WALLET_PRIVATE_KEY')
    console.log('3. If they DIFFER ❌ → Need to investigate key derivation difference')
    console.log('')

    console.log('📝 To use this key for escrow:')
    console.log(`   ESCROW_WALLET_PRIVATE_KEY=${nsecFromArgs}`)
    console.log(`   ESCROW_WALLET_ADDRESS=${arkadeAddress}`)
    console.log('')

  } catch (error: any) {
    console.error('\n❌ Error during compatibility test:', error.message)
    console.error('')
    console.error('Possible issues:')
    console.error('- Invalid nsec format')
    console.error('- Network connection problem')
    console.error('- SDK version incompatibility')
    console.error('')
    console.error('Full error:', error)
    process.exit(1)
  }
}

// Run the test
testKeyCompatibility().catch(console.error)
