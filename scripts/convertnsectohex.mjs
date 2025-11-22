import { nip19 } from 'nostr-tools'
import { hex } from '@scure/base'

const nsec = 'nsec15h3t7k2z09qt92eq3l2sptyhrlz3hvweevmuq382tlsq56s6ej2q7mshn0' // 👈 REMPLACE par ta vraie nsec

try {
  const decoded = nip19.decode(nsec)
  const hexKey = hex.encode(decoded.data)

  console.log('\n✅ Conversion réussie!')
  console.log('\nClé privée hex (64 caractères):')
  console.log(hexKey)
  console.log('\nLongueur:', hexKey.length, 'caractères')
  console.log('\nCopie cette valeur ☝️ dans ESCROW_WALLET_PRIVATE_KEY sur Vercel\n')
} catch (error) {
  console.error('❌ Erreur:', error.message)
}