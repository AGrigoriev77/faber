import { describe, it, expect } from 'vitest'
import { runExtensionSearch, formatSearchResults, resolveCatalog } from '../../../src/commands/extension/search.ts'
import type { Catalog, SearchResult } from '../../../src/extensions/catalog.ts'

const makeCatalog = (extensions: Catalog['extensions'] = {}): Catalog => ({
  schemaVersion: '1.0',
  extensions,
})

const makeEntry = (overrides: Partial<SearchResult> = {}) => ({
  name: overrides.name ?? 'Test',
  description: overrides.description ?? 'A test extension',
  version: overrides.version ?? '1.0.0',
  author: overrides.author ?? 'tester',
  tags: overrides.tags ?? ['test'],
  verified: overrides.verified ?? false,
  downloadUrl: 'https://example.com/ext.zip',
})

// --- formatSearchResults ---

describe('formatSearchResults', () => {
  it('returns message for empty results', () => {
    expect(formatSearchResults([])).toBe('No extensions found matching your criteria.')
  })

  it('formats results as table', () => {
    const results: ReadonlyArray<SearchResult> = [
      { id: 'ext-a', ...makeEntry({ name: 'Extension A', verified: true }) },
      { id: 'ext-b', ...makeEntry({ name: 'Extension B', verified: false }) },
    ]
    const formatted = formatSearchResults(results)
    expect(formatted).toContain('ext-a')
    expect(formatted).toContain('ext-b')
    expect(formatted).toContain('Extension A')
    expect(formatted).toContain('Yes')
    expect(formatted).toContain('No')
  })
})

// --- runExtensionSearch ---

describe('runExtensionSearch', () => {
  it('returns empty results when no extensions match', () => {
    const catalog = makeCatalog({})
    const result = runExtensionSearch({ catalog, query: 'nothing' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().results).toEqual([])
  })

  it('returns matching extensions by query', () => {
    const catalog = makeCatalog({
      'ext-a': makeEntry({ name: 'Alpha Tool', description: 'First tool' }),
      'ext-b': makeEntry({ name: 'Beta Tool', description: 'Second tool' }),
    })
    const result = runExtensionSearch({ catalog, query: 'Alpha' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().results).toHaveLength(1)
    expect(result._unsafeUnwrap().results[0]!.id).toBe('ext-a')
  })

  it('filters by tag', () => {
    const catalog = makeCatalog({
      'ext-a': makeEntry({ tags: ['testing'] }),
      'ext-b': makeEntry({ tags: ['linting'] }),
    })
    const result = runExtensionSearch({ catalog, tag: 'testing' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().results).toHaveLength(1)
    expect(result._unsafeUnwrap().results[0]!.id).toBe('ext-a')
  })

  it('filters by author', () => {
    const catalog = makeCatalog({
      'ext-a': makeEntry({ author: 'alice' }),
      'ext-b': makeEntry({ author: 'bob' }),
    })
    const result = runExtensionSearch({ catalog, author: 'alice' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().results).toHaveLength(1)
  })

  it('filters verified only', () => {
    const catalog = makeCatalog({
      'ext-a': makeEntry({ verified: true }),
      'ext-b': makeEntry({ verified: false }),
    })
    const result = runExtensionSearch({ catalog, verifiedOnly: true })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().results).toHaveLength(1)
    expect(result._unsafeUnwrap().results[0]!.id).toBe('ext-a')
  })

  it('returns all when no filters', () => {
    const catalog = makeCatalog({
      'ext-a': makeEntry(),
      'ext-b': makeEntry(),
    })
    const result = runExtensionSearch({ catalog })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().results).toHaveLength(2)
  })
})

// --- resolveCatalog ---

describe('resolveCatalog', () => {
  it('returns default catalog URL', () => {
    const result = resolveCatalog()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toContain('github')
  })
})
