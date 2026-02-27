import { describe, it, expect } from 'vitest'
import { runExtensionInfo, formatExtensionInfo } from '../../../src/commands/extension/info.ts'
import { addExtension, emptyRegistry } from '../../../src/extensions/registry.ts'
import type { Catalog, SearchResult } from '../../../src/extensions/catalog.ts'

const makeCatalog = (extensions: Catalog['extensions'] = {}): Catalog => ({
  schemaVersion: '1.0',
  extensions,
})

const makeEntry = (overrides: Partial<SearchResult> = {}) => ({
  name: overrides.name ?? 'Test Extension',
  description: overrides.description ?? 'A test extension',
  version: overrides.version ?? '1.0.0',
  author: overrides.author ?? 'tester',
  tags: overrides.tags ?? ['test'],
  verified: overrides.verified ?? true,
  downloadUrl: 'https://example.com/ext.zip',
})

// --- formatExtensionInfo ---

describe('formatExtensionInfo', () => {
  it('formats info with installed=true', () => {
    const info: SearchResult = { id: 'my-ext', ...makeEntry() }
    const result = formatExtensionInfo(info, true)
    expect(result).toContain('Name:        Test Extension')
    expect(result).toContain('ID:          my-ext')
    expect(result).toContain('Version:     1.0.0')
    expect(result).toContain('Installed:   Yes')
    expect(result).toContain('Verified:    Yes')
  })

  it('formats info with installed=false', () => {
    const info: SearchResult = { id: 'other', ...makeEntry({ verified: false }) }
    const result = formatExtensionInfo(info, false)
    expect(result).toContain('Installed:   No')
    expect(result).toContain('Verified:    No')
  })

  it('shows tags as comma-separated', () => {
    const info: SearchResult = { id: 'x', ...makeEntry({ tags: ['a', 'b', 'c'] }) }
    const result = formatExtensionInfo(info, false)
    expect(result).toContain('Tags:        a, b, c')
  })

  it('shows "none" when no tags', () => {
    const info: SearchResult = { id: 'x', ...makeEntry({ tags: [] }) }
    const result = formatExtensionInfo(info, false)
    expect(result).toContain('Tags:        none')
  })
})

// --- runExtensionInfo ---

describe('runExtensionInfo', () => {
  it('returns info for existing extension (installed)', () => {
    const catalog = makeCatalog({ 'my-ext': makeEntry() })
    const registry = addExtension(emptyRegistry(), 'my-ext', {
      version: '1.0.0',
      source: 'catalog',
      installedAt: '2026-01-01T00:00:00Z',
    })

    const result = runExtensionInfo({ catalog, registry, id: 'my-ext' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().info.id).toBe('my-ext')
    expect(result._unsafeUnwrap().installed).toBe(true)
  })

  it('returns info for existing extension (not installed)', () => {
    const catalog = makeCatalog({ 'my-ext': makeEntry() })
    const registry = emptyRegistry()

    const result = runExtensionInfo({ catalog, registry, id: 'my-ext' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().installed).toBe(false)
  })

  it('returns not_found for missing extension', () => {
    const catalog = makeCatalog({})
    const registry = emptyRegistry()

    const result = runExtensionInfo({ catalog, registry, id: 'nope' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })

  it('includes formatted output', () => {
    const catalog = makeCatalog({ 'my-ext': makeEntry({ name: 'My Ext' }) })
    const registry = emptyRegistry()

    const result = runExtensionInfo({ catalog, registry, id: 'my-ext' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().formatted).toContain('My Ext')
  })
})
