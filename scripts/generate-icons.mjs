import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '../public')
const svgBuffer = readFileSync(join(publicDir, 'favicon.svg'))

await sharp(svgBuffer).resize(192, 192).png().toFile(join(publicDir, 'pwa-192x192.png'))
console.log('✓ pwa-192x192.png')

await sharp(svgBuffer).resize(512, 512).png().toFile(join(publicDir, 'pwa-512x512.png'))
console.log('✓ pwa-512x512.png')

await sharp(svgBuffer).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'))
console.log('✓ apple-touch-icon.png')

console.log('Icons generated.')
