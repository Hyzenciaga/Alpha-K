import { VaultConnectionSchema, type Vault, type VaultConnection } from '../../shared/domain/vault.js'
import { SearchIndexRebuildReportSchema, type SearchIndexRebuildReport } from '../../shared/domain/vault-index.js'
import type { KnowledgeRepository } from '../persistence/repositories/knowledge-repository.js'
import type { VaultRepository } from '../persistence/repositories/vault-repository.js'
import { rebuildVaultSearchIndex } from '../vault/index-rebuilder.js'
import { initializeVault, loadVault } from '../vault/vault-manager.js'

export class VaultService {
  constructor(
    private readonly vaultRepository: VaultRepository,
    private readonly knowledgeRepository: KnowledgeRepository,
  ) {}

  async initializeAndActivate(path: string): Promise<VaultConnection> {
    const initialized = await initializeVault(path)
    const vault = this.vaultRepository.registerAndActivate(initialized)
    return VaultConnectionSchema.parse({ state: 'ready', vault, error: null })
  }

  async getConnection(): Promise<VaultConnection> {
    const vault = this.vaultRepository.getActive()
    if (!vault) return { state: 'unconfigured', vault: null, error: null }
    try {
      await this.assertMatchesManifest(vault)
      return VaultConnectionSchema.parse({ state: 'ready', vault, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const state = message.includes('does not exist') || message.includes('was not found') ? 'missing' : 'invalid'
      return VaultConnectionSchema.parse({ state, vault, error: message })
    }
  }

  async rebuildActiveSearchIndex(): Promise<SearchIndexRebuildReport> {
    const vault = this.requireActiveVault()
    await this.assertMatchesManifest(vault)
    return SearchIndexRebuildReportSchema.parse(
      await rebuildVaultSearchIndex(vault.path, this.knowledgeRepository),
    )
  }

  private requireActiveVault(): Vault {
    const vault = this.vaultRepository.getActive()
    if (!vault) throw new Error('No active Vault is configured.')
    return vault
  }

  private async assertMatchesManifest(vault: Vault): Promise<void> {
    const loaded = await loadVault(vault.path)
    if (loaded.manifest.vaultId !== vault.id) {
      throw new Error(`Vault manifest ID does not match the registered Vault at ${vault.path}.`)
    }
  }
}
