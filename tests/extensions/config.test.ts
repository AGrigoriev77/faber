import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deepMerge,
  mergeConfigs,
  envToConfig,
  getValue,
  hasValue,
  type Config,
} from '../../src/extensions/config.ts'

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('override wins for same key', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })

  it('merges nested objects recursively', () => {
    const base = { conn: { url: 'old', timeout: 30 } }
    const override = { conn: { url: 'new' } }
    expect(deepMerge(base, override)).toEqual({ conn: { url: 'new', timeout: 30 } })
  })

  it('replaces arrays (no array merge)', () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] })
  })

  it('does not mutate inputs', () => {
    const base = { a: { b: 1 } }
    const override = { a: { c: 2 } }
    const result = deepMerge(base, override)
    expect(result).toEqual({ a: { b: 1, c: 2 } })
    expect(base).toEqual({ a: { b: 1 } })
    expect(override).toEqual({ a: { c: 2 } })
  })

  it('handles empty objects', () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 })
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 })
    expect(deepMerge({}, {})).toEqual({})
  })

  it('override replaces non-object with object', () => {
    expect(deepMerge({ a: 'string' }, { a: { nested: true } })).toEqual({ a: { nested: true } })
  })

  it('override replaces object with non-object', () => {
    expect(deepMerge({ a: { nested: true } }, { a: 'flat' })).toEqual({ a: 'flat' })
  })

  it('base has null value, override has object → object replaces null', () => {
    expect(deepMerge({ a: null }, { a: { nested: true } })).toEqual({ a: { nested: true } })
  })

  it('base has object, override has null → null wins', () => {
    expect(deepMerge({ a: { nested: true } }, { a: null })).toEqual({ a: null })
  })
})

describe('mergeConfigs (4-layer pipe)', () => {
  it('merges all four layers in order', () => {
    const result = mergeConfigs(
      { timeout: 30, url: 'default' },
      { url: 'project' },
      { debug: true },
      { url: 'env-override' },
    )
    expect(result).toEqual({ timeout: 30, url: 'env-override', debug: true })
  })

  it('later layers override earlier ones', () => {
    const result = mergeConfigs(
      { a: 1 },
      { a: 2 },
      { a: 3 },
      { a: 4 },
    )
    expect(result).toEqual({ a: 4 })
  })

  it('nested merge across layers', () => {
    const result = mergeConfigs(
      { db: { host: 'localhost', port: 5432 } },
      { db: { name: 'mydb' } },
      { db: { port: 3306 } },
      {},
    )
    expect(result).toEqual({ db: { host: 'localhost', port: 3306, name: 'mydb' } })
  })

  it('empty layers are no-ops', () => {
    const result = mergeConfigs({ a: 1 }, {}, {}, {})
    expect(result).toEqual({ a: 1 })
  })

  it('4 layers with null/undefined/objects in different combinations', () => {
    const result = mergeConfigs(
      { a: { b: 1 }, c: 'base' },
      { a: null },
      { a: { d: 2 } },
      { c: undefined },
    )
    // After layer 2: a=null. After layer 3: a={d:2} (null+object -> object wins).
    // After layer 4: c=undefined
    expect(result).toEqual({ a: { d: 2 }, c: undefined })
  })
})

describe('envToConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts env vars with correct prefix', () => {
    vi.stubEnv('SPECKIT_JIRA_CONNECTION_URL', 'https://jira.example.com')
    vi.stubEnv('SPECKIT_JIRA_PROJECT_KEY', 'PROJ')
    vi.stubEnv('UNRELATED_VAR', 'ignore')

    const config = envToConfig('jira')
    expect(config).toEqual({
      connection: { url: 'https://jira.example.com' },
      project: { key: 'PROJ' },
    })
  })

  it('handles hyphenated extension ids', () => {
    vi.stubEnv('SPECKIT_MY_EXT_FOO_BAR', 'baz')

    const config = envToConfig('my-ext')
    expect(config).toEqual({ foo: { bar: 'baz' } })
  })

  it('returns empty object when no matching vars', () => {
    expect(envToConfig('nothing')).toEqual({})
  })

  it('single-segment key becomes flat', () => {
    vi.stubEnv('SPECKIT_JIRA_TIMEOUT', '30')
    const config = envToConfig('jira')
    expect(config).toEqual({ timeout: '30' })
  })

  it('nested env var A_B_C builds deep object', () => {
    vi.stubEnv('SPECKIT_JIRA_A_B_C', 'deep')
    const config = envToConfig('jira')
    expect(config).toEqual({ a: { b: { c: 'deep' } } })
  })
})

describe('getValue', () => {
  const config: Config = {
    connection: { url: 'http://example.com', timeout: 30 },
    debug: true,
  }

  it('gets top-level value', () => {
    expect(getValue(config, 'debug')).toBe(true)
  })

  it('gets nested value via dot notation', () => {
    expect(getValue(config, 'connection.url')).toBe('http://example.com')
  })

  it('returns undefined for missing key', () => {
    expect(getValue(config, 'missing')).toBeUndefined()
  })

  it('returns undefined for missing nested key', () => {
    expect(getValue(config, 'connection.missing')).toBeUndefined()
  })

  it('returns default for missing key', () => {
    expect(getValue(config, 'missing', 'fallback')).toBe('fallback')
  })

  it('path goes through null intermediate → returns default', () => {
    expect(getValue({ a: null }, 'a.b', 'default')).toBe('default')
  })
})

describe('hasValue', () => {
  const config: Config = {
    a: { b: null },
    c: 0,
  }

  it('returns true for existing key (even null)', () => {
    expect(hasValue(config, 'a.b')).toBe(true)
  })

  it('returns true for falsy value', () => {
    expect(hasValue(config, 'c')).toBe(true)
  })

  it('returns false for missing key', () => {
    expect(hasValue(config, 'x')).toBe(false)
  })

  it('returns false for missing nested key', () => {
    expect(hasValue(config, 'a.z')).toBe(false)
  })

  it('key exists with value null → true; key missing → false', () => {
    expect(hasValue({ a: null }, 'a')).toBe(true)
    expect(hasValue({}, 'a')).toBe(false)
  })
})
