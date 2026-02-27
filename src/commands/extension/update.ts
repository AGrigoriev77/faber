import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import {
  checkFaberProject,
  loadRegistry,
  type ExtensionCommandError,
} from './common.ts'
import { listExtensions } from '../../extensions/registry.ts'
import type { Catalog } from '../../extensions/catalog.ts'
import { compareVersions } from '../../extensions/manager.ts'
import { formatTable } from '../../core/ui.ts'

// --- Types ---

export interface ExtensionUpdateOptions {
  readonly cwd: string
  readonly catalog: Catalog
}

export interface UpdateAvailable {
  readonly id: string
  readonly currentVersion: string
  readonly latestVersion: string
}

export interface ExtensionUpdateResult {
  readonly updates: ReadonlyArray<UpdateAvailable>
  readonly formatted: string
}

// --- Pure logic ---

export const findAvailableUpdates = (
  installed: ReadonlyArray<readonly [string, { readonly version: string }]>,
  catalog: Catalog,
): ReadonlyArray<UpdateAvailable> =>
  installed
    .map(([id, entry]) => {
      const catalogEntry = catalog.extensions[id]
      if (!catalogEntry) return null
      if (compareVersions(catalogEntry.version, entry.version) > 0) {
        return { id, currentVersion: entry.version, latestVersion: catalogEntry.version }
      }
      return null
    })
    .filter((u): u is UpdateAvailable => u !== null)

export const formatUpdateResults = (updates: ReadonlyArray<UpdateAvailable>): string => {
  if (updates.length === 0) {
    return 'All extensions are up to date.'
  }

  return formatTable(
    ['ID', 'Current', 'Available'],
    updates.map((u) => [u.id, u.currentVersion, u.latestVersion]),
  )
}

// --- Pipeline ---

export const runExtensionUpdate = async (
  opts: ExtensionUpdateOptions,
): Promise<Result<ExtensionUpdateResult, ExtensionCommandError>> => {
  // 1. Check faber project
  const projectResult = await checkFaberProject(opts.cwd)
  if (projectResult.isErr()) return err(projectResult.error)

  // 2. Load registry
  const registryResult = await loadRegistry(opts.cwd)
  if (registryResult.isErr()) return err(registryResult.error)

  // 3. Compare versions
  const installed = listExtensions(registryResult.value)
  const updates = findAvailableUpdates(installed, opts.catalog)

  return ok({
    updates,
    formatted: formatUpdateResults(updates),
  })
}
