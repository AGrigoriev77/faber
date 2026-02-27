import type { ResultAsync } from 'neverthrow'
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
  installed.flatMap(([id, entry]) => {
    const catalogEntry = catalog.extensions[id]
    return catalogEntry && compareVersions(catalogEntry.version, entry.version) > 0
      ? [{ id, currentVersion: entry.version, latestVersion: catalogEntry.version }]
      : []
  })

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

export const runExtensionUpdate = (
  opts: ExtensionUpdateOptions,
): ResultAsync<ExtensionUpdateResult, ExtensionCommandError> =>
  checkFaberProject(opts.cwd)
    .andThen(() => loadRegistry(opts.cwd))
    .map((registry) => {
      const installed = listExtensions(registry)
      const updates = findAvailableUpdates(installed, opts.catalog)
      return { updates, formatted: formatUpdateResults(updates) }
    })
