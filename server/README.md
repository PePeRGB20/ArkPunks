# Arkade Punks Local Server

Simple, fast, reliable Node.js server for Arkade Punks marketplace.

Replaces Vercel Blob with SQLite for:
- ✅ **ACID transactions** (no race conditions!)
- ✅ **Fast queries** (local database)
- ✅ **Simple deployment** (single server, single database file)
- ✅ **Reliable operations** (atomic updates, no data loss)

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Initialize Database

```bash
npm run init-db
```

This creates the SQLite database with the schema.

### 3. Import Data from Vercel (Critical!)

#### Option A: Import from Vercel API (recommended)

```bash
npm run import-data https://your-vercel-app.vercel.app
```

#### Option B: Import from local export files

First, export data from Vercel:
```bash
cd ..
node scripts/download-data.js https://your-vercel-app.vercel.app
```

Then import:
```bash
cd server
npm run import-data ../data-export
```

### 4. Start Server

```bash
npm start
```

Server runs on http://localhost:3001

For development with auto-restart:
```bash
npm run dev
```

## API Endpoints

### Ownership

- `GET /api/ownership/get?punkId=...` - Get punk owner
- `GET /api/ownership/all` - Get all punk ownership

### Marketplace

- `GET /api/marketplace/listings` - Get active listings
- `POST /api/marketplace/list` - Create listing
- `POST /api/marketplace/cancel` - Cancel listing
- `POST /api/marketplace/update-status` - Update listing status
- `GET /api/marketplace/sales` - Get sales history and stats

### Utility

- `GET /api/stats` - General statistics
- `GET /health` - Health check

## Database

Located at: `server/database/arkade-punks.db`

Schema includes:
- `punks` - Punk ownership and metadata (2016 punks)
- `listings` - Marketplace listings
- `sales` - Sales history for statistics

## Deployment

### Local Server

Run with PM2 for production:
```bash
npm install -g pm2
pm2 start index.js --name arkade-punks
pm2 save
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Why SQLite?

| Vercel Blob | SQLite |
|------------|--------|
| ❌ No transactions | ✅ ACID transactions |
| ❌ Race conditions | ✅ Atomic operations |
| ❌ Slow (network) | ✅ Fast (local) |
| ❌ Complex | ✅ Simple |
| ❌ Expensive at scale | ✅ Free |

SQLite can handle **100,000+ writes/sec** and **millions of reads/sec** - more than enough for this marketplace!
