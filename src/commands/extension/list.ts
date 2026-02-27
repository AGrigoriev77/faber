import type { ResultAsync } from 'neverthrow'
import { checkFaberProject, loadRegistry, type ExtensionCommandError } from './common.ts'
import { listExtensions } from '../../extensions/registry.ts'
import type { ExtensionEntry } from '../../extensions/registry.ts'
import { formatTable } from '../../core/ui.ts'

// --- Types ---

export interface ExtensionListOptions {
  readonly cwd: string
}

export interface ExtensionListResult {
  readonly entries: ReadonlyArray<readonly [string, ExtensionEntry]>
  readonly formatted: string
}

// --- Pure formatting ---

export const formatExtensionList = (
  entries: ReadonlyArray<readonly [string, ExtensionEntry]>,
): string => {
  if (entries.length === 0) {
    return 'No extensions installed.'
  }

  return formatTable(
    ['ID', 'Version', 'Source', 'Installed'],
    entries.map(([id, e]) => [id, e.version, e.source, e.installedAt]),
  )
}

// --- Pipeline ---

export const runExtensionList = (
  opts: ExtensionListOptions,
): ResultAsync<ExtensionListResult, ExtensionCommandError> =>
  checkFaberProject(opts.cwd)
    .andThen(() => loadRegistry(opts.cwd))
    .map((registry) => {
      const entries = listExtensions(registry)
      return { entries, formatted: formatExtensionList(entries) }
    })
