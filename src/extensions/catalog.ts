import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

// TODO: update when faber catalog URL is finalized
const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/faber-dev/faber/main/extensions/catalog.json'
const CACHE_DURATION_SECONDS = 3600

export interface CatalogEntry {
  readonly name: string
  readonly description: string
  readonly version: string
  readonly author: string
  readonly tags: ReadonlyArray<string>
  readonly verified: boolean
  readonly downloadUrl: string
}

export interface Catalog {
  readonly schemaVersion: string
  readonly extensions: Readonly<Record<string, CatalogEntry>>
}

export interface CacheMetadata {
  readonly cachedAt: string
  readonly catalogUrl: string
}

export type CatalogError =
  | { readonly tag: 'invalid_url'; readonly url: string; readonly message: string }
  | { readonly tag: 'not_found'; readonly id: string }
  | { readonly tag: 'network'; readonly message: string }
  | { readonly tag: 'parse'; readonly message: string }

export interface SearchResult extends CatalogEntry {
  readonly id: string
}

interface SearchFilters {
  readonly query?: string
  readonly tag?: string
  readonly author?: string
  readonly verifiedOnly?: boolean
}

// --- URL resolution ---

const isLocalhost = (hostname: string | null): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'

export const resolveCatalogUrl = (): Result<string, CatalogError> => {
  const envUrl = (process.env['FABER_CATALOG_URL'] ?? '').trim()

  if (!envUrl) return ok(DEFAULT_CATALOG_URL)

  let parsed: URL
  try {
    parsed = new URL(envUrl)
  } catch {
    return err({ tag: 'invalid_url', url: envUrl, message: 'Not a valid URL' })
  }

  if (!parsed.hostname) {
    return err({ tag: 'invalid_url', url: envUrl, message: 'URL must have a host' })
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost(parsed.hostname))) {
    return err({ tag: 'invalid_url', url: envUrl, message: 'Must use HTTPS (HTTP only allowed for localhost)' })
  }

  return ok(envUrl)
}

// --- Cache ---

export const isCacheValid = (meta: CacheMetadata, maxAgeSeconds: number = CACHE_DURATION_SECONDS): boolean => {
  try {
    const cachedAt = new Date(meta.cachedAt).getTime()
    if (isNaN(cachedAt)) return false
    const ageSeconds = (Date.now() - cachedAt) / 1000
    return ageSeconds < maxAgeSeconds
  } catch {
    return false
  }
}

// --- Search ---

export const searchExtensions = (catalog: Catalog, filters: SearchFilters): ReadonlyArray<SearchResult> =>
  Object.entries(catalog.extensions)
    .filter(([, entry]) => !filters.verifiedOnly || entry.verified)
    .filter(([, entry]) => !filters.author || entry.author.toLowerCase() === filters.author.toLowerCase())
    .filter(([, entry]) => !filters.tag || entry.tags.some((t) => t.toLowerCase() === filters.tag!.toLowerCase()))
    .filter(([id, entry]) => {
      if (!filters.query) return true
      const q = filters.query.toLowerCase()
      return [entry.name, entry.description, id, ...entry.tags].join(' ').toLowerCase().includes(q)
    })
    .map(([id, entry]) => ({ id, ...entry }))

// --- Info ---

export const getExtensionInfo = (catalog: Catalog, id: string): Result<SearchResult, CatalogError> => {
  const entry = catalog.extensions[id]
  return entry
    ? ok({ id, ...entry })
    : err({ tag: 'not_found', id })
}

// --- Download URL validation ---

export const validateDownloadUrl = (url: string): Result<string, CatalogError> => {
  if (!url) {
    return err({ tag: 'invalid_url', url, message: 'Empty download URL' })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return err({ tag: 'invalid_url', url, message: 'Not a valid URL' })
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost(parsed.hostname))) {
    return err({ tag: 'invalid_url', url, message: 'Download URL must use HTTPS' })
  }

  return ok(url)
}
