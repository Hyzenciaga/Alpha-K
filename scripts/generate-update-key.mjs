import { generateKeyPairSync } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDirectory = resolve(process.argv[2] ?? 'private-update-key')
const privatePath = resolve(outputDirectory, 'alpha-k-update-private.pem')
const publicPath = resolve(outputDirectory, 'alpha-k-update-public.pem')
const { privateKey, publicKey } = generateKeyPairSync('ed25519')

await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
await writeFile(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
await writeFile(publicPath, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 })

console.log(`Private key: ${privatePath}`)
console.log(`Public key: ${publicPath}`)
console.log('Keep the private key out of the repository. Store its base64 value in GitHub as ALPHA_K_UPDATE_PRIVATE_KEY_BASE64.')
