import { describe, it, expect, vi } from 'vitest'
import {
  parseCondition,
  evaluateCondition,
  filterEnabledHooks,
  registerHook,
  unregisterHooks,
  type HookEntry,
  type HookCondition,
  type HooksConfig,
} from '../../src/extensions/hooks.ts'

// --- parseCondition ---

describe('parseCondition', () => {
  it('parses "config.key is set"', () => {
    const result = parseCondition('config.connection.url is set')
    expect(result.isOk()).toBe(true)
    const cond = result._unsafeUnwrap()
    expect(cond.tag).toBe('config_is_set')
    if (cond.tag === 'config_is_set') {
      expect(cond.keyPath).toBe('connection.url')
    }
  })

  it('parses "config.key == \'value\'"', () => {
    const result = parseCondition("config.mode == 'debug'")
    expect(result.isOk()).toBe(true)
    const cond = result._unsafeUnwrap()
    expect(cond.tag).toBe('config_equals')
    if (cond.tag === 'config_equals') {
      expect(cond.keyPath).toBe('mode')
      expect(cond.value).toBe('debug')
    }
  })

  it('parses "config.key != \'value\'"', () => {
    const result = parseCondition("config.env != 'production'")
    expect(result.isOk()).toBe(true)
    const cond = result._unsafeUnwrap()
    expect(cond.tag).toBe('config_not_equals')
    if (cond.tag === 'config_not_equals') {
      expect(cond.keyPath).toBe('env')
      expect(cond.value).toBe('production')
    }
  })

  it('parses "env.VAR is set"', () => {
    const result = parseCondition('env.DATABASE_URL is set')
    expect(result.isOk()).toBe(true)
    const cond = result._unsafeUnwrap()
    expect(cond.tag).toBe('env_is_set')
    if (cond.tag === 'env_is_set') {
      expect(cond.varName).toBe('DATABASE_URL')
    }
  })

  it('parses "env.VAR == \'value\'"', () => {
    const result = parseCondition("env.NODE_ENV == 'production'")
    expect(result.isOk()).toBe(true)
    const cond = result._unsafeUnwrap()
    expect(cond.tag).toBe('env_equals')
    if (cond.tag === 'env_equals') {
      expect(cond.varName).toBe('NODE_ENV')
      expect(cond.value).toBe('production')
    }
  })

  it('parses "env.VAR != \'value\'"', () => {
    const result = parseCondition("env.NODE_ENV != 'test'")
    expect(result.isOk()).toBe(true)
    const cond = result._unsafeUnwrap()
    expect(cond.tag).toBe('env_not_equals')
  })

  it('supports double quotes', () => {
    const result = parseCondition('config.x == "hello"')
    expect(result.isOk()).toBe(true)
    if (result.isOk() && result.value.tag === 'config_equals') {
      expect(result.value.value).toBe('hello')
    }
  })

  it('returns err for unknown format', () => {
    const result = parseCondition('garbage input')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('invalid_condition')
  })

  it('trims whitespace', () => {
    const result = parseCondition('  config.a is set  ')
    expect(result.isOk()).toBe(true)
  })
})

// --- evaluateCondition ---

describe('evaluateCondition', () => {
  const configLookup = (keyPath: string): unknown => {
    const data: Record<string, unknown> = {
      'connection.url': 'http://localhost',
      'mode': 'debug',
      'enabled': true,
    }
    return data[keyPath]
  }

  const configHas = (keyPath: string): boolean => {
    return ['connection.url', 'mode', 'enabled'].includes(keyPath)
  }

  it('config_is_set: true when key exists', () => {
    const cond: HookCondition = { tag: 'config_is_set', keyPath: 'connection.url' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(true)
  })

  it('config_is_set: false when key missing', () => {
    const cond: HookCondition = { tag: 'config_is_set', keyPath: 'missing.key' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(false)
  })

  it('config_equals: true when matches', () => {
    const cond: HookCondition = { tag: 'config_equals', keyPath: 'mode', value: 'debug' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(true)
  })

  it('config_equals: false when different', () => {
    const cond: HookCondition = { tag: 'config_equals', keyPath: 'mode', value: 'release' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(false)
  })

  it('config_not_equals: true when different', () => {
    const cond: HookCondition = { tag: 'config_not_equals', keyPath: 'mode', value: 'release' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(true)
  })

  it('config_equals: normalizes booleans', () => {
    const cond: HookCondition = { tag: 'config_equals', keyPath: 'enabled', value: 'true' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(true)
  })

  it('env_is_set: true when var exists', () => {
    vi.stubEnv('MY_TEST_VAR', 'hello')
    const cond: HookCondition = { tag: 'env_is_set', varName: 'MY_TEST_VAR' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(true)
    vi.unstubAllEnvs()
  })

  it('env_is_set: false when var missing', () => {
    vi.stubEnv('MY_TEST_VAR', '')
    delete process.env['NONEXISTENT_VAR_XYZ']
    const cond: HookCondition = { tag: 'env_is_set', varName: 'NONEXISTENT_VAR_XYZ' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(false)
    vi.unstubAllEnvs()
  })

  it('env_equals: true when matches', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const cond: HookCondition = { tag: 'env_equals', varName: 'NODE_ENV', value: 'production' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(true)
    vi.unstubAllEnvs()
  })

  it('env_not_equals: true when different', () => {
    vi.stubEnv('NODE_ENV', 'dev')
    const cond: HookCondition = { tag: 'env_not_equals', varName: 'NODE_ENV', value: 'production' }
    expect(evaluateCondition(cond, { configHas, configGet: configLookup })).toBe(true)
    vi.unstubAllEnvs()
  })
})

// --- filterEnabledHooks ---

describe('filterEnabledHooks', () => {
  const hook = (ext: string, enabled = true): HookEntry => ({
    extension: ext,
    command: 'run.sh',
    enabled,
    optional: true,
    prompt: 'Execute?',
    description: '',
    condition: null,
  })

  it('returns only enabled hooks', () => {
    const hooks = [hook('a', true), hook('b', false), hook('c', true)]
    expect(filterEnabledHooks(hooks)).toHaveLength(2)
  })

  it('returns empty array for all disabled', () => {
    expect(filterEnabledHooks([hook('a', false)])).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterEnabledHooks([])).toHaveLength(0)
  })
})

// --- registerHook / unregisterHooks ---

describe('registerHook', () => {
  const emptyConfig: HooksConfig = {}

  const entry: HookEntry = {
    extension: 'my-ext',
    command: 'setup.sh',
    enabled: true,
    optional: true,
    prompt: 'Run setup?',
    description: 'Setup hook',
    condition: null,
  }

  it('adds hook to empty config', () => {
    const result = registerHook(emptyConfig, 'after_install', entry)
    expect(result['after_install']).toHaveLength(1)
    expect(result['after_install']![0]!.extension).toBe('my-ext')
  })

  it('does not mutate original config', () => {
    registerHook(emptyConfig, 'after_install', entry)
    expect(emptyConfig['after_install']).toBeUndefined()
  })

  it('appends to existing event hooks', () => {
    const config = registerHook(emptyConfig, 'after_install', entry)
    const entry2: HookEntry = { ...entry, extension: 'other-ext' }
    const result = registerHook(config, 'after_install', entry2)
    expect(result['after_install']).toHaveLength(2)
  })

  it('updates existing hook for same extension', () => {
    const config = registerHook(emptyConfig, 'after_install', entry)
    const updated: HookEntry = { ...entry, command: 'new.sh' }
    const result = registerHook(config, 'after_install', updated)
    expect(result['after_install']).toHaveLength(1)
    expect(result['after_install']![0]!.command).toBe('new.sh')
  })
})

describe('unregisterHooks', () => {
  const entry = (ext: string): HookEntry => ({
    extension: ext,
    command: 'x.sh',
    enabled: true,
    optional: true,
    prompt: '',
    description: '',
    condition: null,
  })

  it('removes all hooks for an extension', () => {
    let config: HooksConfig = {}
    config = registerHook(config, 'after_install', entry('a'))
    config = registerHook(config, 'after_install', entry('b'))
    config = registerHook(config, 'before_run', entry('a'))

    const result = unregisterHooks(config, 'a')
    expect(result['after_install']).toHaveLength(1)
    expect(result['after_install']![0]!.extension).toBe('b')
    expect(result['before_run']).toBeUndefined() // cleaned up empty array
  })

  it('does not mutate original', () => {
    let config: HooksConfig = {}
    config = registerHook(config, 'e', entry('x'))
    unregisterHooks(config, 'x')
    expect(config['e']).toHaveLength(1)
  })
})
