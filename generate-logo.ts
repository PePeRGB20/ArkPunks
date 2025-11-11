/**
 * Generate punk #10c01753 image for logo and favicon
 */
import { generatePunkMetadata } from './src/utils/generator'
import * as fs from 'fs'
import * as path from 'path'

const PUNK_ID = '10c01753a99b60fb5bf8067b4d5bef03cb30e4d3e9ee8babfe66d13ff7685b66'

async function generateLogo() {
  console.log('🎨 Generating logo from punk #10c01753...')

  try {
    // Generate punk metadata (includes image)
    const metadata = generatePunkMetadata(PUNK_ID)
    const imageDataUrl = metadata.imageUrl

    // Extract SVG data and make background transparent
    const svgData = Buffer.from(imageDataUrl.split(',')[1], 'base64').toString('utf-8')
    const transparentSvg = svgData.replace(
      /<rect width="24" height="24" fill="[^"]*" \/>/,
      '<rect width="24" height="24" fill="transparent" />'
    )

    // Create public folder if it doesn't exist
    const publicDir = path.join(process.cwd(), 'public')
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
      console.log('✅ Created public folder')
    }

    // Save as logo.svg
    const logoPath = path.join(publicDir, 'logo.svg')
    fs.writeFileSync(logoPath, transparentSvg)
    console.log(`✅ Saved logo to ${logoPath}`)

    // Save as favicon.svg (modern browsers support SVG favicons)
    const faviconPath = path.join(publicDir, 'favicon.svg')
    fs.writeFileSync(faviconPath, transparentSvg)
    console.log(`✅ Saved favicon to ${faviconPath}`)

    console.log('🎉 Logo and favicon generated successfully!')
  } catch (error) {
    console.error('❌ Failed to generate logo:', error)
    process.exit(1)
  }
}

generateLogo()
