import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { safeStorage } from 'electron'

type EncryptionProvider = Pick<
  typeof safeStorage,
  'isEncryptionAvailable' | 'encryptString' | 'decryptString'
>

export class SecureSessionStorageError extends Error {
  readonly code = 'CLOUD_SECURE_STORAGE_UNAVAILABLE' as const

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SecureSessionStorageError'
  }
}

export class SecureSessionStorage {
  private operation = Promise.resolve()

  constructor(
    private readonly path: string,
    private readonly encryption: EncryptionProvider = safeStorage,
  ) {}

  getItem(key: string): Promise<string | null> {
    return this.runExclusive(async () => (await this.readAll())[key] ?? null)
  }

  setItem(key: string, value: string): Promise<void> {
    return this.runExclusive(async () => {
      const values = await this.readAll()
      values[key] = value
      await this.writeAll(values)
    })
  }

  removeItem(key: string): Promise<void> {
    return this.runExclusive(async () => {
      const values = await this.readAll()
      if (!(key in values)) return
      delete values[key]
      await this.writeAll(values)
    })
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation)
    this.operation = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private assertEncryptionAvailable(): void {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new SecureSessionStorageError(
        '系统安全存储当前不可用，Alpha-K 不会把 Supabase 会话降级为明文保存。',
      )
    }
  }

  private async readAll(): Promise<Record<string, string>> {
    this.assertEncryptionAvailable()
    let encoded: string
    try {
      encoded = await readFile(this.path, 'utf8')
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return {}
      throw new SecureSessionStorageError('无法读取加密的 Supabase 会话。', { cause: error })
    }

    try {
      const encrypted = Buffer.from(encoded, 'base64')
      const parsed = JSON.parse(this.encryption.decryptString(encrypted)) as unknown
      if (!isStringRecord(parsed)) throw new Error('Unexpected secure session shape.')
      return parsed
    } catch (error) {
      throw new SecureSessionStorageError('加密的 Supabase 会话已损坏或无法解密。', {
        cause: error,
      })
    }
  }

  private async writeAll(values: Record<string, string>): Promise<void> {
    this.assertEncryptionAvailable()
    try {
      await mkdir(dirname(this.path), { recursive: true })
      const encrypted = this.encryption.encryptString(JSON.stringify(values)).toString('base64')
      const temporaryPath = `${this.path}.tmp-${process.pid}`
      await writeFile(temporaryPath, encrypted, { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, this.path)
    } catch (error) {
      if (error instanceof SecureSessionStorageError) throw error
      throw new SecureSessionStorageError('无法安全保存 Supabase 会话。', { cause: error })
    }
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  )
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
