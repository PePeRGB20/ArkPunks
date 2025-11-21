/**
 * Test endpoint to verify Vercel Functions are working
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    message: 'ArkPunks Escrow API is running! 🚀',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
}
