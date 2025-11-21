# ArkPunks Escrow System

## Vue d'ensemble

Le système escrow permet aux vendeurs de lister des punks sur le marketplace **même quand ils sont offline**. Le serveur gère automatiquement les transactions en tenant le punk en garantie jusqu'à la vente.

## Architecture

```
┌─────────────┐           ┌──────────────┐           ┌─────────────┐
│   SELLER    │           │    ESCROW    │           │    BUYER    │
│             │           │   (SERVER)   │           │             │
└──────┬──────┘           └──────┬───────┘           └──────┬──────┘
       │                         │                          │
       │  1. List Punk (API)     │                          │
       ├────────────────────────>│                          │
       │  <escrow address>       │                          │
       │<────────────────────────┤                          │
       │                         │                          │
       │  2. Send Punk VTXO      │                          │
       ├────────────────────────>│                          │
       │                         │                          │
       │                         │  3. Buy Intent (API)     │
       │                         │<─────────────────────────┤
       │                         │  <payment instructions>  │
       │                         ├─────────────────────────>│
       │                         │                          │
       │                         │  4. Send Payment         │
       │                         │<─────────────────────────┤
       │                         │                          │
       │                         │  AUTOMATIC SWAP:         │
       │                         │  - Punk → Buyer          │
       │                         │  - Payment → Seller      │
       │                         │  - Fee → Escrow          │
       │                         │                          │
       │  5. Payment Received    │  5. Punk Received        │
       │<────────────────────────┤─────────────────────────>│
       │                         │                          │
```

## Composants

### 1. API Endpoints (`api/escrow/`)

#### `POST /api/escrow/list`
- Crée un listing escrow
- Retourne l'adresse escrow pour déposer le punk
- Stocke les détails du listing

**Request:**
```json
{
  "punkId": "abc123...",
  "sellerPubkey": "npub...",
  "sellerArkAddress": "ark1...",
  "price": "100000",
  "punkVtxoOutpoint": "txid:vout"
}
```

**Response:**
```json
{
  "success": true,
  "escrowAddress": "ark1qq4hfs...",
  "instructions": [
    "1. Send your punk VTXO to ark1qq4hfs...",
    "2. Once received, punk appears on marketplace",
    "3. When sold, you receive payment automatically"
  ]
}
```

#### `POST /api/escrow/buy`
- Enregistre l'intention d'achat
- Retourne les instructions de paiement
- Le reste est automatique!

**Request:**
```json
{
  "punkId": "abc123...",
  "buyerPubkey": "npub...",
  "buyerArkAddress": "ark1..."
}
```

**Response:**
```json
{
  "success": true,
  "totalWithFee": "100500",
  "fee": "500",
  "escrowAddress": "ark1qq4hfs...",
  "instructions": [
    "Send exactly 100,500 sats to ark1qq4hfs...",
    "Punk will be transferred automatically",
    "Seller receives 100,000 sats"
  ]
}
```

#### `GET /api/escrow/status?punkId=xxx`
- Vérifie le statut d'un listing
- Statuts: `pending`, `deposited`, `sold`, `cancelled`

#### `GET/POST /api/escrow/process`
- **Endpoint automatique** (appelé par Vercel Cron)
- Vérifie les dépôts et paiements
- Exécute les atomic swaps
- Fréquence: **toutes les minutes** (`* * * * *`)

### 2. Escrow Processor (`api/escrow/_lib/escrowProcessor.ts`)

Le processeur automatique qui:

1. **Détecte les dépôts de seller** (`processSellerDeposits`)
   - Vérifie les VTXOs reçus sur l'adresse escrow
   - Compare avec les listings pending
   - Marque comme `deposited` quand punk reçu

2. **Détecte les paiements de buyer** (`processBuyerPayments`)
   - Vérifie le balance de l'escrow wallet
   - Détecte quand payment >= prix + fee
   - Déclenche l'atomic swap

3. **Exécute les atomic swaps** (`executeAtomicSwap`)
   - Transfère le punk au buyer
   - Transfère le paiement au seller (minus fee)
   - Fee reste dans escrow wallet
   - Marque listing comme `sold`

### 3. Escrow Store (`api/escrow/_lib/escrowStore.ts`)

Stockage in-memory des listings:
- **TODO Production:** Migrer vers Vercel KV pour persistence

Interface:
```typescript
interface EscrowListing {
  punkId: string
  sellerPubkey: string
  sellerArkAddress: string
  price: string
  punkVtxoOutpoint: string
  escrowAddress: string
  status: 'pending' | 'deposited' | 'sold' | 'cancelled'
  createdAt: number
  depositedAt?: number
  soldAt?: number
  buyerAddress?: string
  buyerPubkey?: string
}
```

### 4. Escrow Wallet (`api/escrow/_lib/escrowWallet.ts`)

Configuration du wallet escrow:
- Retourne l'adresse statique depuis `ESCROW_WALLET_ADDRESS`
- **Production:** Besoin de `ESCROW_WALLET_PRIVATE_KEY` pour les transferts

## Configuration

### Variables d'environnement Vercel

Obligatoires pour le fonctionnement:

```bash
# Adresse du wallet escrow (affichée aux users)
ESCROW_WALLET_ADDRESS=ark1qq4hfssprtcgnjzf8qlw2f78yvjau5kldfugg29k34y7j96q2w4t...

# Clé privée du wallet escrow (pour les transferts automatiques)
ESCROW_WALLET_PRIVATE_KEY=0123456789abcdef...

# Réseau Arkade
VITE_ARKADE_NETWORK=testnet  # ou 'mainnet'
```

### Vercel Cron Configuration

Dans `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/escrow/process",
      "schedule": "* * * * *"
    }
  ]
}
```

**Note:** Vercel Cron nécessite un plan Pro ($20/mois)

### Alternative: GitHub Actions Cron

Si pas de Vercel Pro, créer `.github/workflows/escrow-processor.yml`:

```yaml
name: Escrow Processor

on:
  schedule:
    - cron: '* * * * *'  # Every minute
  workflow_dispatch:      # Manual trigger

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Call processor endpoint
        run: |
          curl -X POST https://arkpunks.com/api/escrow/process
```

## Flow Complet

### Vendeur liste un punk

1. User clique "List for Sale" sur un punk
2. Frontend affiche modal avec choix de mode
3. User choisit "Escrow Mode"
4. Frontend appelle `POST /api/escrow/list`
5. Server retourne l'adresse escrow
6. Frontend publie événement Nostr avec `sale_mode: 'escrow'`
7. User envoie son punk VTXO à l'adresse escrow
8. **Cron détecte le dépôt** → listing devient `deposited`
9. Punk apparaît sur marketplace avec badge 🛡️ ESCROW

### Acheteur achète un punk

1. User clique "Buy" sur un punk en escrow
2. Frontend appelle `POST /api/escrow/buy`
3. Server retourne instructions de paiement
4. User envoie le paiement (prix + 0.5% fee) à l'adresse escrow
5. **Cron détecte le paiement** → déclenche atomic swap:
   - Punk transféré au buyer
   - Paiement transféré au seller (minus 0.5%)
   - Fee reste dans escrow
6. Listing marqué `sold`
7. Frontend publie événement Nostr KIND_PUNK_SOLD
8. Les deux parties sont notifiées!

## Frais

- **Mode Escrow:** 0.5% (standard des échangeurs)
- **Mode P2P:** 1% (compensation pour HTLC complexity)

Exemple:
- Prix: 100,000 sats
- Fee (0.5%): 500 sats
- **Buyer paie:** 100,500 sats
- **Seller reçoit:** 100,000 sats
- **Marketplace garde:** 500 sats

## Sécurité

### Protection des fonds
- Wallet escrow détenu par l'opérateur du marketplace
- Clé privée stockée dans Vercel Environment Variables (chiffrées)
- Jamais exposée au frontend
- Accès restreint au processeur automatique

### Monitoring
- Logs détaillés de chaque transaction
- Vérification des montants avant transfert
- Status tracking pour audit trail

### Atomic Swaps
- Les deux transferts (punk + payment) se font dans la même exécution
- Si un échoue, l'autre est rollback
- Garantit que personne ne perd ses fonds

## Tests

### Test local du processeur

```bash
# Appeler manuellement l'endpoint
curl -X POST http://localhost:5173/api/escrow/process
```

### Test sur preview Vercel

```bash
curl -X POST https://ark-punks-git-dev-lastdegen.vercel.app/api/escrow/process
```

### Vérifier un listing

```bash
curl "https://arkpunks.com/api/escrow/status?punkId=abc123..."
```

### Vérifier tous les listings

```bash
curl "https://arkpunks.com/api/escrow/status"
```

## Roadmap

### Phase 1: MVP ✅ (Current)
- [x] API endpoints
- [x] Escrow processor
- [x] Automatic cron job
- [x] Frontend integration
- [x] In-memory storage

### Phase 2: Production Ready
- [ ] Migrate to Vercel KV for persistence
- [ ] Add authentication to processor endpoint
- [ ] Email notifications
- [ ] Refund mechanism for failed transactions
- [ ] Multi-signature security
- [ ] Rate limiting
- [ ] Admin dashboard

### Phase 3: Advanced Features
- [ ] Partial fills (buy multiple punks at once)
- [ ] Escrow disputes
- [ ] Time-limited listings
- [ ] Auction mode
- [ ] Batch processing optimization

## Troubleshooting

### Punk pas détecté après deposit
- Vérifier que VTXO est bien reçu sur escrow address
- Vérifier logs du processor: `/api/escrow/process`
- Le VTXO doit être `settled`, pas `preconfirmed`

### Payment pas détecté
- Vérifier montant exact (prix + 0.5% fee)
- Vérifier que funds sont arrivés sur escrow wallet
- Attendre 1-2 minutes pour le prochain cron run

### Atomic swap échoue
- Vérifier balance suffisant dans escrow wallet
- Vérifier logs serveur
- Contacter support avec punkId

## Support

Pour questions ou problèmes:
1. Vérifier logs Vercel
2. Vérifier status endpoint
3. Ouvrir issue sur GitHub
4. Contact: [votre email/discord]
