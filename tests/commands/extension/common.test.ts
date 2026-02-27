import { describe, it, expect, beforeEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  checkFaberProject,
  loadRegistry,
  saveRegistry,
  loadManifestFromDir,
  faberDir,
  registryPath,
  extensionsDir,
  manifestPath,
  formatCommandError,
  mapManifestError,
  mapCatalogError,
  mapManagerError,
  mapFsError,
  type ExtensionCommandError,
} from '../../../src/commands/extension/common.ts'
import { addExtension, emptyRegistry, serializeRegistry } from '../../../src/extensions/registry.ts'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'faber-ext-common-'))
  return async () => { await rm(tmpDir, { recursive: true, force: true }) }
})

// --- Path helpers ---

describe('path helpers', () => {
  it('faberDir returns .faber under cwd', () => {
    expect(faberDir('/proj')).toBe(join('/proj', '.faber'))
  })

  it('registryPath returns .faber/extensions/.registry', () => {
    expect(registryPath('/proj')).toBe(join('/proj', '.faber', 'extensions', '.registry'))
  })

  it('extensionsDir returns .faber/extensions', () => {
    expect(extensionsDir('/proj')).toBe(join('/proj', '.faber', 'extensions'))
  })

  it('manifestPath returns extension.yml in dir', () => {
    expect(manifestPath('/ext')).toBe(join('/ext', 'extension.yml'))
  })
})

// --- checkFaberProject ---

describe('checkFaberProject', () => {
  it('returns ok when .faber/ exists', async () => {
    await mkdir(join(tmpDir, '.faber'), { recursive: true })
    const result = await checkFaberProject(tmpDir)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(tmpDir)
  })

  it('returns not_a_project when .faber/ missing', async () => {
    const result = await checkFaberProject(tmpDir)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_a_project')
  })
})

// --- loadRegistry ---

describe('loadRegistry', () => {
  it('returns empty registry when file missing', async () => {
    await mkdir(join(tmpDir, '.faber', 'extensions'), { recursive: true })
    const result = await loadRegistry(tmpDir)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions).toEqual({})
  })

  it('returns empty registry for corrupted registry file', async () => {
    const dir = join(tmpDir, '.faber', 'extensions')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '.registry'), 'not valid json {{{')

    const result = await loadRegistry(tmpDir)
    // parseRegistry returns ok(emptyRegistry()) on parse error
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions).toEqual({})
  })

  it('parses existing registry file', async () => {
    const dir = join(tmpDir, '.faber', 'extensions')
    await mkdir(dir, { recursive: true })

    const reg = addExtension(emptyRegistry(), 'test-ext', {
      version: '1.0.0',
      source: 'catalog',
      installedAt: '2026-01-01T00:00:00Z',
    })
    await writeFile(join(dir, '.registry'), serializeRegistry(reg))

    const result = await loadRegistry(tmpDir)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extensions['test-ext']).toBeDefined()
    expect(result._unsafeUnwrap().extensions['test-ext']!.version).toBe('1.0.0')
  })
})

// --- saveRegistry ---

describe('saveRegistry', () => {
  it('creates extensions dir and writes registry', async () => {
    await mkdir(join(tmpDir, '.faber'), { recursive: true })
    const reg = addExtension(emptyRegistry(), 'my-ext', {
      version: '2.0.0',
      source: 'local',
      installedAt: '2026-01-01T00:00:00Z',
    })

    const result = await saveRegistry(tmpDir, reg)
    expect(result.isOk()).toBe(true)

    // Verify file was written by loading it back
    const loaded = await loadRegistry(tmpDir)
    expect(loaded.isOk()).toBe(true)
    expect(loaded._unsafeUnwrap().extensions['my-ext']!.version).toBe('2.0.0')
  })
})

// --- saveRegistry error paths ---

describe('saveRegistry error paths', () => {
  it('returns error when extensions dir cannot be created', async () => {
    // Use a path that can't have subdirectories
    const result = await saveRegistry('/dev/null', emptyRegistry())
    expect(result.isErr()).toBe(true)
  })
})

// --- loadManifestFromDir ---

describe('loadManifestFromDir', () => {
  it('loads and validates a valid manifest', async () => {
    const extDir = join(tmpDir, 'my-ext')
    await mkdir(extDir, { recursive: true })
    await writeFile(join(extDir, 'extension.yml'), `
schema_version: "1.0"
extension:
  id: my-ext
  name: My Extension
  version: "1.0.0"
  description: A test extension
requires:
  faber_version: ">=0.1.0"
provides:
  commands:
    - name: faber.my-ext.run
      file: commands/run.md
`)

    const result = await loadManifestFromDir(extDir)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().extension.id).toBe('my-ext')
    expect(result._unsafeUnwrap().extension.version).toBe('1.0.0')
  })

  it('returns error for missing manifest file', async () => {
    const result = await loadManifestFromDir(tmpDir)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('manifest_io')
  })

  it('returns validation error for invalid manifest', async () => {
    const extDir = join(tmpDir, 'bad-ext')
    await mkdir(extDir, { recursive: true })
    await writeFile(join(extDir, 'extension.yml'), `
schema_version: "1.0"
extension:
  id: INVALID_ID
  name: Bad
  version: "1.0.0"
  description: Bad extension
`)

    const result = await loadManifestFromDir(extDir)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('validation')
  })
})

// --- Error mappers ---

describe('mapManifestError', () => {
  it('maps yaml_parse to validation', () => {
    const result = mapManifestError({ tag: 'yaml_parse', message: 'bad yaml' })
    expect(result.tag).toBe('validation')
  })

  it('maps validation to validation', () => {
    const result = mapManifestError({ tag: 'validation', field: 'x', message: 'bad' })
    expect(result.tag).toBe('validation')
  })
})

describe('mapCatalogError', () => {
  it('maps invalid_url to network', () => {
    const result = mapCatalogError({ tag: 'invalid_url', url: 'x', message: 'bad' })
    expect(result.tag).toBe('network')
  })

  it('maps not_found to not_found', () => {
    const result = mapCatalogError({ tag: 'not_found', id: 'x' })
    expect(result.tag).toBe('not_found')
  })

  it('maps network to network', () => {
    const result = mapCatalogError({ tag: 'network', message: 'timeout' })
    expect(result.tag).toBe('network')
  })

  it('maps parse to catalog_io', () => {
    const result = mapCatalogError({ tag: 'parse', message: 'invalid json' })
    expect(result.tag).toBe('catalog_io')
  })
})

describe('mapManagerError', () => {
  it('maps compatibility', () => {
    const result = mapManagerError({ tag: 'compatibility', required: '>=1.0.0', actual: '0.5.0' })
    expect(result.tag).toBe('compatibility')
  })

  it('maps already_installed', () => {
    const result = mapManagerError({ tag: 'already_installed', id: 'x' })
    expect(result.tag).toBe('already_installed')
  })

  it('maps not_installed', () => {
    const result = mapManagerError({ tag: 'not_installed', id: 'x' })
    expect(result.tag).toBe('not_installed')
  })
})

describe('mapFsError', () => {
  it('maps not_found to fs', () => {
    const result = mapFsError({ tag: 'not_found', path: '/x' })
    expect(result.tag).toBe('fs')
  })

  it('maps permission to fs', () => {
    const result = mapFsError({ tag: 'permission', path: '/x', message: 'denied' })
    expect(result.tag).toBe('fs')
  })

  it('maps io to fs', () => {
    const result = mapFsError({ tag: 'io', path: '/x', message: 'disk full' })
    expect(result.tag).toBe('fs')
  })

  it('maps parse to fs', () => {
    const result = mapFsError({ tag: 'parse', path: '/x', message: 'bad json' })
    expect(result.tag).toBe('fs')
  })
})

// --- formatCommandError ---

describe('formatCommandError', () => {
  const cases: ReadonlyArray<readonly [ExtensionCommandError, string]> = [
    [{ tag: 'not_a_project', path: '/x' }, 'Not a faber project'],
    [{ tag: 'registry_io', path: '/x', message: 'err' }, 'Registry error'],
    [{ tag: 'catalog_io', message: 'err' }, 'Catalog error'],
    [{ tag: 'manifest_io', path: '/x', message: 'err' }, 'Manifest error'],
    [{ tag: 'validation', field: 'f', message: 'err' }, 'Validation error'],
    [{ tag: 'compatibility', required: '>=1.0.0', actual: '0.5.0' }, 'Incompatible'],
    [{ tag: 'already_installed', id: 'x' }, 'already installed'],
    [{ tag: 'not_installed', id: 'x' }, 'not installed'],
    [{ tag: 'not_found', id: 'x' }, 'not found'],
    [{ tag: 'network', message: 'timeout' }, 'Network error'],
    [{ tag: 'fs', path: '/x', message: 'err' }, 'File system error'],
  ]

  it.each(cases)('formats %s error containing expected substring', (error, expected) => {
    const formatted = formatCommandError(error)
    expect(formatted).toContain(expected)
  })
})
