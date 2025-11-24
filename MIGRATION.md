# Migration: Vercel Blob → Local Node.js + SQLite

Guide complet pour migrer le marketplace d'Arkade Punks de Vercel Blob vers un serveur local Node.js + SQLite.

## Pourquoi cette migration ?

| Problème Vercel Blob | Solution SQLite |
|----------------------|-----------------|
| ❌ Race conditions partout | ✅ ACID transactions |
| ❌ Listings qui disparaissent | ✅ Opérations atomiques |
| ❌ Erreurs "Listing not found" | ✅ Consistency garantie |
| ❌ Lent (network round-trips) | ✅ Rapide (local disk) |
| ❌ Complexe et buggy | ✅ Simple et fiable |
| ❌ 3 jours de debugging | ✅ Fonctionne du premier coup |

## Étapes de Migration

### 1. Exporter les Données de Vercel (CRITIQUE!)

**Les données ownership sont les plus importantes** - 2016 punks avec leurs adresses ark1.

#### Option A: Via l'API export-all (si déployé)

```bash
# Si l'endpoint /api/export-all est déployé sur Vercel
node scripts/download-data.js https://your-vercel-app.vercel.app
```

#### Option B: Accès direct au Vercel Blob

1. Aller sur https://vercel.com/dashboard
2. Sélectionner le projet "arkade-punks"
3. Storage → Blob → Télécharger:
   - `punk-ownership.json` → **CRITICAL - 2016 punks!**
   - `escrow-listings.json` → listings actives
   - `punk-registry.json` → registry des punks mintés
   - `auto-whitelist.json` → whitelist entries

4. Sauvegarder dans `data-export/`:
```
data-export/
├── ownership.json  (de punk-ownership.json)
├── listings.json   (de escrow-listings.json)
├── registry.json   (de punk-registry.json)
└── whitelist.json  (de auto-whitelist.json)
```

### 2. Installer le Serveur Local

```bash
cd server
npm install
```

### 3. Initialiser la Base de Données

Le serveur crée automatiquement la database au démarrage:

```bash
npm start
```

Ou pour le développement avec auto-restart:

```bash
npm run dev
```

Vérifie que le serveur démarre:
```
============================================================
🚀 Arkade Punks Server Running
============================================================
📡 Listening on: http://localhost:3001
💾 Database: [...]/server/database/arkade-punks.db
============================================================
```

### 4. Importer les Données

**IMPORTANT: Ne ferme pas le serveur pendant l'import!**

Dans un nouveau terminal:

```bash
cd server

# Importer depuis les fichiers exportés
npm run import-data ../data-export
```

Tu devrais voir:
```
📊 Data loaded:
   Ownership: 2016 punks
   Listings: X active listings
   Registry: 2016 total minted

✅ Imported 2016 punks
✅ Imported X listings
✅ Imported Y sales

============================================================
✅ Import Complete!
============================================================
```

### 5. Vérifier l'Import

```bash
cd server
node scripts/test-api.js
```

Tous les tests doivent passer:
```
✅ Health check
✅ Get punk owner
✅ Create listing
✅ Get active listings
✅ Cancel listing
✅ Stats
```

### 6. Configurer le Frontend

Le frontend est déjà configuré pour utiliser le serveur local en développement.

**Pour le développement local:**
```bash
# Le frontend utilisera automatiquement http://localhost:3001
npm run serve
```

**Pour la production (serveur distant):**

Édite `.env`:
```bash
VITE_API_URL=http://your-server-ip:3001
```

Ou pour production avec domaine:
```bash
VITE_API_URL=https://api.your-domain.com
```

### 7. Tester le Marketplace

1. Lance le serveur backend:
   ```bash
   cd server
   npm start
   ```

2. Lance le frontend:
   ```bash
   cd ..
   npm run serve
   ```

3. Ouvre http://localhost:5173

4. Teste:
   - ✅ Voir les listings
   - ✅ Créer un listing
   - ✅ Annuler un listing
   - ✅ Acheter un punk (si escrow wallet configuré)
   - ✅ Voir les stats

## Déploiement sur Serveur Personnel

### Option 1: PM2 (Recommandé)

```bash
# Sur ton serveur
cd server
npm install -g pm2
pm2 start index.js --name arkade-punks
pm2 save
pm2 startup  # Configure démarrage auto
```

### Option 2: systemd Service

Créer `/etc/systemd/system/arkade-punks.service`:

```ini
[Unit]
Description=Arkade Punks Marketplace Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/arkade-punks/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Puis:
```bash
sudo systemctl enable arkade-punks
sudo systemctl start arkade-punks
sudo systemctl status arkade-punks
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Pour HTTPS (Let's Encrypt):
```bash
sudo certbot --nginx -d api.your-domain.com
```

## Backup de la Database

### Backup Manuel

```bash
# Copier la database
cp server/database/arkade-punks.db server/database/arkade-punks-backup-$(date +%Y%m%d).db
```

### Backup Automatique (cron)

```bash
crontab -e
```

Ajoute:
```bash
# Backup daily at 3am
0 3 * * * cp /path/to/arkade-punks/server/database/arkade-punks.db /path/to/backups/arkade-punks-$(date +\%Y\%m\%d).db
```

## Nettoyage Vercel (Après Migration Réussie)

Une fois que tout fonctionne sur ton serveur local:

1. **Garde les données Vercel Blob pendant 1 semaine** (au cas où)

2. Ensuite, nettoie Vercel Blob:
   - Va sur https://vercel.com/dashboard
   - Storage → Blob → Supprimer les blobs inutiles
   - Ou appelle: `curl https://your-app.vercel.app/api/escrow/clear-blob`

3. **Désactive les anciens endpoints Vercel** (optionnel)
   - Renomme `api/` en `api-old/` pour désactiver
   - Ou supprime complètement

## Résumé des Changements

### Backend
- ✅ Nouveau serveur: `server/index.js`
- ✅ Database SQLite: `server/database/arkade-punks.db`
- ✅ Nouveaux endpoints: `/api/marketplace/*`
- ✅ ACID transactions - plus de race conditions!

### Frontend
- ✅ Marketplace.vue: Utilise `VITE_API_URL` (localhost:3001 par défaut)
- ✅ Stats.vue: Utilise `VITE_API_URL` (localhost:3001 par défaut)
- ✅ Endpoints mis à jour: `/api/marketplace/listings`, `/api/marketplace/sales`

### Avantages
- ✅ **Fiable**: ACID transactions, opérations atomiques
- ✅ **Rapide**: Database locale, pas de network latency
- ✅ **Simple**: Un seul serveur, une seule database
- ✅ **Gratuit**: Pas de coûts Vercel Blob
- ✅ **Contrôle total**: Ton serveur, tes données

## Troubleshooting

### Le serveur ne démarre pas

```bash
# Vérifie les ports
lsof -i :3001
# Ou sur Windows
netstat -ano | findstr :3001

# Change le port si nécessaire
PORT=3002 npm start
```

### Import échoue

```bash
# Vérifie que les fichiers existent
ls -la data-export/

# Vérifie le format JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('data-export/ownership.json', 'utf-8')))"
```

### Frontend ne se connecte pas

```bash
# Vérifie que le serveur tourne
curl http://localhost:3001/health

# Vérifie la configuration
grep VITE_API_URL .env
```

## Support

En cas de problème:
1. Vérifie les logs du serveur
2. Lance `node scripts/test-api.js` pour diagnostiquer
3. Vérifie que la database existe: `ls -la server/database/`
4. Regarde les erreurs dans la console browser (F12)

---

**Bonne migration! 🚀**
