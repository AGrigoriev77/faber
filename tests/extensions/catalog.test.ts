import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveCatalogUrl,
  isCacheValid,
  searchExtensions,
  getExtensionInfo,
  validateDownloadUrl,
  type Catalog,
  type CacheMetadata,
} from '../../src/extensions/catalog.ts'

// --- resolveCatalogUrl ---

describe('resolveCatalogUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns default URL when no env var', () => {
    vi.stubEnv('FABER_CATALOG_URL', '')
    const result = resolveCatalogUrl()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toContain('faber')
  })

  it('uses FABER_CATALOG_URL env override', () => {
    vi.stubEnv('FABER_CATALOG_URL', 'https://custom.example.com/catalog.json')
    const result = resolveCatalogUrl()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('https://custom.example.com/catalog.json')
  })

  it('rejects non-HTTPS URLs', () => {
    vi.stubEnv('FABER_CATALOG_URL', 'http://evil.com/catalog.json')
    const result = resolveCatalogUrl()
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('invalid_url')
  })

  it('allows http://localhost for dev', () => {
    vi.stubEnv('FABER_CATALOG_URL', 'http://localhost:3000/catalog.json')
    const result = resolveCatalogUrl()
    expect(result.isOk()).toBe(true)
  })

  it('allows http://127.0.0.1 for dev', () => {
    vi.stubEnv('FABER_CATALOG_URL', 'http://127.0.0.1:8080/catalog.json')
    const result = resolveCatalogUrl()
    expect(result.isOk()).toBe(true)
  })

  it('rejects URL without host', () => {
    vi.stubEnv('FABER_CATALOG_URL', 'https://')
    const result = resolveCatalogUrl()
    expect(result.isErr()).toBe(true)
  })
})

// --- isCacheValid ---

describe('isCacheValid', () => {
  it('returns true when cache is fresh', () => {
    const meta: CacheMetadata = {
      cachedAt: new Date().toISOString(),
      catalogUrl: 'https://example.com',
    }
    expect(isCacheValid(meta, 3600)).toBe(true)
  })

  it('returns false when cache is expired', () => {
    const old = new Date(Date.now() - 7200 * 1000).toISOString()
    const meta: CacheMetadata = { cachedAt: old, catalogUrl: 'https://example.com' }
    expect(isCacheValid(meta, 3600)).toBe(false)
  })

  it('returns false for invalid date', () => {
    const meta: CacheMetadata = { cachedAt: 'not-a-date', catalogUrl: '' }
    expect(isCacheValid(meta, 3600)).toBe(false)
  })

  it('returns false when TTL=0 (always invalid)', () => {
    const meta: CacheMetadata = {
      cachedAt: new Date().toISOString(),
      catalogUrl: 'https://example.com',
    }
    expect(isCacheValid(meta, 0)).toBe(false)
  })
})

// --- searchExtensions ---

const makeCatalog = (): Catalog => ({
  schemaVersion: '1.0',
  extensions: {
    'jira-sync': {
      name: 'Jira Sync',
      description: 'Sync specs with Jira issues',
      version: '1.0.0',
      author: 'Alice',
      tags: ['jira', 'integration'],
      verified: true,
      downloadUrl: 'https://example.com/jira-sync.zip',
    },
    'slack-notify': {
      name: 'Slack Notifier',
      description: 'Send notifications to Slack',
      version: '2.0.0',
      author: 'Bob',
      tags: ['slack', 'notifications'],
      verified: false,
      downloadUrl: 'https://example.com/slack-notify.zip',
    },
    'test-helper': {
      name: 'Test Helper',
      description: 'Generate test stubs from specs',
      version: '0.5.0',
      author: 'Alice',
      tags: ['testing'],
      verified: true,
      downloadUrl: 'https://example.com/test-helper.zip',
    },
  },
})

describe('searchExtensions', () => {
  const catalog = makeCatalog()

  it('returns all extensions with no filters', () => {
    const results = searchExtensions(catalog, {})
    expect(results).toHaveLength(3)
  })

  it('filters by text query in name', () => {
    const results = searchExtensions(catalog, { query: 'jira' })
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('jira-sync')
  })

  it('filters by text query in description', () => {
    const results = searchExtensions(catalog, { query: 'notifications' })
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('slack-notify')
  })

  it('filters by text query in id', () => {
    const results = searchExtensions(catalog, { query: 'test-helper' })
    expect(results).toHaveLength(1)
  })

  it('filters by text query in tags', () => {
    const results = searchExtensions(catalog, { query: 'testing' })
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('test-helper')
  })

  it('query is case-insensitive', () => {
    const results = searchExtensions(catalog, { query: 'JIRA' })
    expect(results).toHaveLength(1)
  })

  it('filters by tag', () => {
    const results = searchExtensions(catalog, { tag: 'integration' })
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('jira-sync')
  })

  it('tag filter is case-insensitive', () => {
    const results = searchExtensions(catalog, { tag: 'SLACK' })
    expect(results).toHaveLength(1)
  })

  it('filters by author', () => {
    const results = searchExtensions(catalog, { author: 'Alice' })
    expect(results).toHaveLength(2)
  })

  it('author filter is case-insensitive', () => {
    const results = searchExtensions(catalog, { author: 'alice' })
    expect(results).toHaveLength(2)
  })

  it('filters verified only', () => {
    const results = searchExtensions(catalog, { verifiedOnly: true })
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.verified)).toBe(true)
  })

  it('combines multiple filters', () => {
    const results = searchExtensions(catalog, { author: 'Alice', verifiedOnly: true })
    expect(results).toHaveLength(2)
  })

  it('returns empty for no match', () => {
    const results = searchExtensions(catalog, { query: 'nonexistent' })
    expect(results).toHaveLength(0)
  })

  it('filters with 3+ combined filters (query + tag + author + verifiedOnly)', () => {
    const results = searchExtensions(catalog, {
      query: 'jira',
      tag: 'integration',
      author: 'Alice',
      verifiedOnly: true,
    })
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('jira-sync')
  })
})

// --- getExtensionInfo ---

describe('getExtensionInfo', () => {
  const catalog = makeCatalog()

  it('returns ok for existing extension', () => {
    const result = getExtensionInfo(catalog, 'jira-sync')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().name).toBe('Jira Sync')
  })

  it('returns err for missing extension', () => {
    const result = getExtensionInfo(catalog, 'nope')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })
})

// --- validateDownloadUrl ---

describe('validateDownloadUrl', () => {
  it('accepts HTTPS URLs', () => {
    expect(validateDownloadUrl('https://example.com/ext.zip').isOk()).toBe(true)
  })

  it('rejects HTTP URLs', () => {
    expect(validateDownloadUrl('http://example.com/ext.zip').isErr()).toBe(true)
  })

  it('allows http://localhost', () => {
    expect(validateDownloadUrl('http://localhost:3000/ext.zip').isOk()).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateDownloadUrl('').isErr()).toBe(true)
  })

  it('rejects whitespace-only string', () => {
    const result = validateDownloadUrl('   ')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('invalid_url')
  })
})
