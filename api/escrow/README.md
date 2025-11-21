# ArkPunks Escrow API

Server-side escrow system for trustless punk marketplace transactions using Vercel Serverless Functions.

## 🏗️ Architecture

The escrow system allows sellers to list punks offline while buyers can purchase instantly. The server acts as a trusted intermediary that:

1. **Holds punk VTXOs** temporarily in escrow
2. **Executes atomic swaps** when a buyer purchases
3. **Transfers punk to buyer** + **Pays seller** (minus 0.5% fee)

## 🔑 Environment Variables

Required in Vercel Dashboard → Settings → Environment Variables:

```
ESCROW_WALLET_PRIVATE_KEY=<hex_private_key>
```

This wallet will:
- Receive punk VTXOs from sellers
- Transfer punks to buyers
- Receive payments and forward to sellers

⚠️ **Security**: Keep this private key secure! It holds all escrowed assets.

## 📡 API Endpoints

### 1. Test API Health

```bash
GET /api/escrow/test
```

**Response:**
```json
{
  "message": "ArkPunks Escrow API is running! 🚀",
  "timestamp": "2025-11-21T10:00:00.000Z",
  "version": "1.0.0"
}
```

### 2. List Punk in Escrow

```bash
POST /api/escrow/list
Content-Type: application/json

{
  "punkId": "punk-abc123",
  "sellerPubkey": "<nostr_pubkey>",
  "sellerArkAddress": "ark1...",
  "price": "50000",
  "punkVtxoOutpoint": "txid:0"
}
```

**Response:**
```json
{
  "success": true,
  "punkId": "punk-abc123",
  "escrowAddress": "ark1escrow...",
  "price": "50000",
  "message": "Please send your punk VTXO to the escrow address",
  "instructions": [
    "1. Send your punk VTXO (txid:0) to ark1escrow...",
    "2. Once received, your punk will appear on the marketplace",
    "3. When sold, you will receive payment automatically (minus 0.5% fee)"
  ]
}
```

### 3. Buy Punk from Escrow

```bash
POST /api/escrow/buy
Content-Type: application/json

{
  "punkId": "punk-abc123",
  "buyerPubkey": "<nostr_pubkey>",
  "buyerArkAddress": "ark1...",
  "paymentTxid": "payment_txid"
}
```

**Response:**
```json
{
  "success": true,
  "punkId": "punk-abc123",
  "transactions": {
    "punkTransfer": "txid_punk_to_buyer",
    "sellerPayout": "txid_payment_to_seller"
  },
  "amounts": {
    "price": "50000",
    "sellerPayout": "49750",
    "marketplaceFee": "250"
  },
  "message": "Purchase successful! You now own this punk."
}
```

### 4. Check Escrow Status

```bash
# Get specific listing
GET /api/escrow/status?punkId=punk-abc123

# Get all active listings
GET /api/escrow/status
```

**Response:**
```json
{
  "success": true,
  "listing": {
    "punkId": "punk-abc123",
    "sellerPubkey": "...",
    "sellerArkAddress": "ark1...",
    "price": "50000",
    "punkVtxoOutpoint": "txid:0",
    "escrowAddress": "ark1escrow...",
    "status": "deposited",
    "createdAt": 1700000000000,
    "depositedAt": 1700000100000
  }
}
```

## 🔄 Workflow

### Seller Flow (Mode Escrow)

1. **List punk**: `POST /api/escrow/list`
   - Get escrow address
2. **Send punk VTXO** to escrow address
   - Use wallet.send()
3. **Wait for sale** (can go offline)
4. **Receive payment** automatically when sold

### Buyer Flow

1. **Browse marketplace** (read from Nostr)
2. **Send payment** to escrow address
3. **Call buy API**: `POST /api/escrow/buy`
   - Provide payment TXID
4. **Receive punk** instantly

## 🚀 Deployment

### Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev
```

### Production

```bash
# Deploy to Vercel
git push origin main

# Vercel auto-deploys from GitHub
```

### Set Environment Variables

```bash
vercel env add ESCROW_WALLET_PRIVATE_KEY
```

## 📊 Status Flow

```
pending → deposited → sold
   ↓
cancelled
```

- **pending**: Listing created, waiting for punk VTXO
- **deposited**: Punk received, available for purchase
- **sold**: Purchase completed
- **cancelled**: Listing cancelled by seller

## 🔐 Security Considerations

1. **Private Key Management**
   - Store in Vercel environment variables
   - Never commit to git
   - Rotate regularly

2. **Payment Verification**
   - TODO: Verify payment TXID actually received funds
   - Current: Trusts buyer-provided TXID

3. **Timelock Recovery**
   - TODO: Implement 30-day timelock for seller recovery
   - Current: Simple escrow address

## 🛠️ TODOs

- [ ] Add payment verification (check TXID)
- [ ] Implement 2-of-2 multisig with timelock
- [ ] Migrate from in-memory to Vercel KV storage
- [ ] Add webhook for deposit confirmation
- [ ] Add refund/cancel endpoint
- [ ] Add rate limiting
- [ ] Add API authentication

## 📝 Notes

- Marketplace fee: **0.5%**
- Standard punk value: **10,000 sats**
- Escrow storage: In-memory (temporary)
- Network: Arkade mainnet
