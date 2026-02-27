import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { mapCatalogError, type ExtensionCommandError } from './common.ts'
import { searchExtensions, resolveCatalogUrl } from '../../extensions/catalog.ts'
import type { Catalog, SearchResult } from '../../extensions/catalog.ts'
import { formatTable } from '../../core/ui.ts'

// --- Types ---

export interface ExtensionSearchOptions {
  readonly catalog: Catalog
  readonly query?: string
  readonly tag?: string
  readonly author?: string
  readonly verifiedOnly?: boolean
}

export interface ExtensionSearchResult {
  readonly results: ReadonlyArray<SearchResult>
  readonly formatted: string
}

// --- Pure formatting ---

export const formatSearchResults = (results: ReadonlyArray<SearchResult>): string => {
  if (results.length === 0) {
    return 'No extensions found matching your criteria.'
  }

  return formatTable(
    ['ID', 'Name', 'Version', 'Author', 'Verified'],
    results.map((r) => [r.id, r.name, r.version, r.author, r.verified ? 'Yes' : 'No']),
  )
}

// --- Pipeline ---

export const runExtensionSearch = (
  opts: ExtensionSearchOptions,
): Result<ExtensionSearchResult, ExtensionCommandError> => {
  const results = searchExtensions(opts.catalog, {
    query: opts.query,
    tag: opts.tag,
    author: opts.author,
    verifiedOnly: opts.verifiedOnly,
  })

  return ok({ results, formatted: formatSearchResults(results) })
}

// --- Catalog URL resolution (re-export for CLI) ---

export const resolveCatalog = (): Result<string, ExtensionCommandError> => {
  const result = resolveCatalogUrl()
  return result.isOk() ? ok(result.value) : err(mapCatalogError(result.error))
}
