import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { VaultSearchMetadataSchema, type SearchIndexRebuildReport } from '../../shared/domain/vault-index.js'
import type { SearchDocument } from '../../shared/domain/knowledge.js'
import type { KnowledgeRepository } from '../persistence/repositories/knowledge-repository.js'

export async function rebuildVaultSearchIndex(
  vaultRoot: string,
  knowledgeRepository: KnowledgeRepository,
): Promise<SearchIndexRebuildReport> {
  const libraryRoot = join(vaultRoot, 'library')
  const metadataPaths = await findMetadataFiles(libraryRoot)
  const documents: SearchDocument[] = []
  const issues: SearchIndexRebuildReport['issues'] = []

  for (const metadataPath of metadataPaths) {
    try {
      const raw = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown
      const metadata = VaultSearchMetadataSchema.parse(raw)
      documents.push({
        knowledgeItemId: metadata.id,
        title: metadata.title,
        summary: metadata.summary,
        authors: metadata.authors,
        labels: metadata.labels,
      })
    } catch (error) {
      issues.push({
        relativePath: relative(vaultRoot, metadataPath),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  knowledgeRepository.replaceSearchIndex(documents)
  return { indexed: documents.length, skipped: issues.length, issues }
}

async function findMetadataFiles(directory: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }

  const files: string[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await findMetadataFiles(path)))
    else if (entry.isFile() && entry.name === 'metadata.json') files.push(path)
  }
  return files
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
