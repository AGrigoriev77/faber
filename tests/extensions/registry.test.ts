import { describe, it, expect } from 'vitest'
import {
  emptyRegistry,
  addExtension,
  removeExtension,
  getExtension,
  listExtensions,
  isInstalled,
  parseRegistry,
  serializeRegistry,
  type ExtensionEntry,
} from '../../src/extensions/registry.ts'

const entry = (version: string, source: string): ExtensionEntry => ({
  version,
  source,
  installedAt: '2026-01-01T00:00:00Z',
})

describe('emptyRegistry', () => {
  it('creates a registry with schema version and no extensions', () => {
    const reg = emptyRegistry()
    expect(reg.schemaVersion).toBe('1.0')
    expect(reg.extensions).toEqual({})
  })
})

describe('addExtension', () => {
  it('adds an extension to empty registry', () => {
    const reg = addExtension(emptyRegistry(), 'my-ext', entry('1.0.0', 'catalog'))
    expect(reg.extensions['my-ext']).toBeDefined()
    expect(reg.extensions['my-ext']!.version).toBe('1.0.0')
  })

  it('does not mutate the original registry', () => {
    const original = emptyRegistry()
    addExtension(original, 'my-ext', entry('1.0.0', 'catalog'))
    expect(original.extensions['my-ext']).toBeUndefined()
  })

  it('overwrites existing extension (update)', () => {
    const reg1 = addExtension(emptyRegistry(), 'my-ext', entry('1.0.0', 'catalog'))
    const reg2 = addExtension(reg1, 'my-ext', entry('2.0.0', 'catalog'))
    expect(reg2.extensions['my-ext']!.version).toBe('2.0.0')
  })

  it('preserves other extensions when adding', () => {
    const reg1 = addExtension(emptyRegistry(), 'ext-a', entry('1.0.0', 'catalog'))
    const reg2 = addExtension(reg1, 'ext-b', entry('2.0.0', 'local'))
    expect(reg2.extensions['ext-a']!.version).toBe('1.0.0')
    expect(reg2.extensions['ext-b']!.version).toBe('2.0.0')
  })
})

describe('removeExtension', () => {
  it('removes an existing extension', () => {
    const reg = addExtension(emptyRegistry(), 'my-ext', entry('1.0.0', 'catalog'))
    const result = removeExtension(reg, 'my-ext')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions['my-ext']).toBeUndefined()
  })

  it('does not mutate the original registry', () => {
    const reg = addExtension(emptyRegistry(), 'my-ext', entry('1.0.0', 'catalog'))
    removeExtension(reg, 'my-ext')
    expect(reg.extensions['my-ext']).toBeDefined()
  })

  it('returns err when extension not found', () => {
    const result = removeExtension(emptyRegistry(), 'nope')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })

  it('preserves other extensions', () => {
    let reg = addExtension(emptyRegistry(), 'a', entry('1.0.0', 'x'))
    reg = addExtension(reg, 'b', entry('2.0.0', 'y'))
    const result = removeExtension(reg, 'a')
    expect(result._unsafeUnwrap().extensions['b']!.version).toBe('2.0.0')
  })
})

describe('getExtension', () => {
  it('returns ok with entry for installed extension', () => {
    const reg = addExtension(emptyRegistry(), 'my-ext', entry('1.0.0', 'catalog'))
    const result = getExtension(reg, 'my-ext')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().version).toBe('1.0.0')
  })

  it('returns err for missing extension', () => {
    const result = getExtension(emptyRegistry(), 'nope')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })
})

describe('listExtensions', () => {
  it('returns empty array for empty registry', () => {
    expect(listExtensions(emptyRegistry())).toEqual([])
  })

  it('returns all extensions as [id, entry] tuples', () => {
    let reg = addExtension(emptyRegistry(), 'a', entry('1.0.0', 'x'))
    reg = addExtension(reg, 'b', entry('2.0.0', 'y'))
    const list = listExtensions(reg)
    expect(list).toHaveLength(2)
    expect(list.map(([id]) => id).sort()).toEqual(['a', 'b'])
  })
})

describe('isInstalled', () => {
  it('returns true for installed extension', () => {
    const reg = addExtension(emptyRegistry(), 'my-ext', entry('1.0.0', 'catalog'))
    expect(isInstalled(reg, 'my-ext')).toBe(true)
  })

  it('returns false for missing extension', () => {
    expect(isInstalled(emptyRegistry(), 'nope')).toBe(false)
  })
})

describe('parseRegistry / serializeRegistry', () => {
  it('round-trips: serialize → parse', () => {
    const reg = addExtension(emptyRegistry(), 'my-ext', entry('1.0.0', 'catalog'))
    const json = serializeRegistry(reg)
    const parsed = parseRegistry(json)
    expect(parsed.isOk()).toBe(true)
    expect(parsed._unsafeUnwrap().extensions['my-ext']!.version).toBe('1.0.0')
  })

  it('parses valid JSON with snake_case keys', () => {
    const json = JSON.stringify({
      schema_version: '1.0',
      extensions: {
        'test-ext': {
          version: '1.0.0',
          source: 'catalog',
          installed_at: '2026-01-01T00:00:00Z',
        },
      },
    })
    const result = parseRegistry(json)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions['test-ext']!.installedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('returns empty registry for invalid JSON', () => {
    const result = parseRegistry('not json {{{')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions).toEqual({})
  })

  it('returns empty registry for empty string', () => {
    const result = parseRegistry('')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions).toEqual({})
  })

  it('serializes with snake_case for disk format', () => {
    const reg = addExtension(emptyRegistry(), 'x', entry('1.0.0', 'y'))
    const json = serializeRegistry(reg)
    const parsed = JSON.parse(json)
    expect(parsed['schema_version']).toBe('1.0')
    expect(parsed['extensions']['x']['installed_at']).toBe('2026-01-01T00:00:00Z')
  })

  it('parses entry with missing version/source fields', () => {
    const json = JSON.stringify({
      schema_version: '1.0',
      extensions: { 'ext-a': {} },
    })
    const result = parseRegistry(json)
    expect(result.isOk()).toBe(true)
    const ext = result._unsafeUnwrap().extensions['ext-a']!
    expect(ext.version).toBe('')
    expect(ext.source).toBe('')
    expect(ext.installedAt).toBe('')
  })

  it('parses entry with camelCase installedAt', () => {
    const json = JSON.stringify({
      schema_version: '1.0',
      extensions: {
        'ext-a': { version: '1.0.0', source: 'local', installedAt: '2026-06-01' },
      },
    })
    const result = parseRegistry(json)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions['ext-a']!.installedAt).toBe('2026-06-01')
  })

  it('handles extensions field as non-object', () => {
    const json = JSON.stringify({ schema_version: '1.0', extensions: 'not-an-object' })
    const result = parseRegistry(json)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions).toEqual({})
  })

  it('handles extensions field as null', () => {
    const json = JSON.stringify({ schema_version: '1.0', extensions: null })
    const result = parseRegistry(json)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions).toEqual({})
  })

  it('handles missing schema_version with fallback', () => {
    const json = JSON.stringify({ extensions: {} })
    const result = parseRegistry(json)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().schemaVersion).toBe('1.0')
  })
})
