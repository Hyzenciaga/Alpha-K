import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export async function hashFileSha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(path)
  for await (const chunk of stream) hash.update(chunk as Buffer)
  return hash.digest('hex')
}
