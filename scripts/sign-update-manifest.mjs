import { createHash, createPrivateKey, sign } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const argumentsMap = parseArguments(process.argv.slice(2))
const assetPath = required(argumentsMap, 'asset')
const version = required(argumentsMap, 'version')
const outputPath = required(argumentsMap, 'output')
const privateKeyBase64 = process.env.ALPHA_K_UPDATE_PRIVATE_KEY_BASE64
if (!privateKeyBase64) throw new Error('ALPHA_K_UPDATE_PRIVATE_KEY_BASE64 is required.')

const assetName = basename(assetPath)
const assetBuffer = await readFile(assetPath)
const assetStats = await stat(assetPath)
const manifest = {
  schemaVersion: 1,
  version,
  publishedAt: new Date().toISOString(),
  releaseNotes: argumentsMap.notes ?? null,
  asset: {
    name: assetName,
    url: `https://github.com/Hyzenciaga/Alpha-K/releases/download/v${version}/${assetName}`,
    sha256: createHash('sha256').update(assetBuffer).digest('hex'),
    size: assetStats.size,
  },
}
const payload = canonicalManifestPayload(manifest)
const privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf8')
const signature = sign(null, Buffer.from(payload), createPrivateKey(privateKeyPem)).toString('base64')
await writeFile(resolve(outputPath), `${JSON.stringify({ ...manifest, signature }, null, 2)}\n`, { mode: 0o644 })
console.log(`Signed update manifest: ${resolve(outputPath)}`)

function canonicalManifestPayload(value) {
  return JSON.stringify({
    schemaVersion: value.schemaVersion,
    version: value.version,
    publishedAt: value.publishedAt,
    releaseNotes: value.releaseNotes,
    asset: {
      name: value.asset.name,
      url: value.asset.url,
      sha256: value.asset.sha256,
      size: value.asset.size,
    },
  })
}

function parseArguments(values) {
  if (values[0] === '--') values = values.slice(1)
  const result = {}
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]
    const value = values[index + 1]
    if (!key?.startsWith('--') || value === undefined) throw new Error('Usage: --asset FILE --version VERSION --output FILE [--notes TEXT]')
    result[key.slice(2)] = value
  }
  return result
}

function required(values, key) {
  if (!values[key]) throw new Error(`Missing --${key}.`)
  return values[key]
}
