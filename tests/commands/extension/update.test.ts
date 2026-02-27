import { describe, it, expect, beforeEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  runExtensionUpdate,
  findAvailableUpdates,
  formatUpdateResults,
} from '../../../src/commands/extension/update.ts'
import { addExtension, emptyRegistry, serializeRegistry } from '../../../src/extensions/registry.ts'
import type { Catalog } from '../../../src/extensions/catalog.ts'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'faber-ext-update-'))
  return async () => { await rm(tmpDir, { recursive: true, force: true }) }
})

const makeCatalog = (extensions: Catalog['extensions'] = {}): Catalog => ({
  schemaVersion: '1.0',
  extensions,
})

const catalogEntry = (version: string) => ({
  name: 'Test',
  description: 'Test ext',
  version,
  author: 'tester',
  tags: ['test'] as ReadonlyArray<string>,
  verified: true,
  downloadUrl: 'https://example.com/ext.zip',
})

// --- findAvailableUpdates ---

describe('findAvailableUpdates', () => {
  it('returns empty when all up to date', () => {
    const installed: ReadonlyArray<readonly [string, { version: string }]> = [
      ['ext-a', { version: '1.0.0' }],
    ]
    const catalog = makeCatalog({ 'ext-a': catalogEntry('1.0.0') })

    expect(findAvailableUpdates(installed, catalog)).toEqual([])
  })

  it('detects available update', () => {
    const installed: ReadonlyArray<readonly [string, { version: string }]> = [
      ['ext-a', { version: '1.0.0' }],
    ]
    const catalog = makeCatalog({ 'ext-a': catalogEntry('2.0.0') })

    const updates = findAvailableUpdates(installed, catalog)
    expect(updates).toHaveLength(1)
    expect(updates[0]!.id).toBe('ext-a')
    expect(updates[0]!.currentVersion).toBe('1.0.0')
    expect(updates[0]!.latestVersion).toBe('2.0.0')
  })

  it('skips extensions not in catalog', () => {
    const installed: ReadonlyArray<readonly [string, { version: string }]> = [
      ['ext-a', { version: '1.0.0' }],
    ]
    const catalog = makeCatalog({})

    expect(findAvailableUpdates(installed, catalog)).toEqual([])
  })

  it('skips when catalog version is older', () => {
    const installed: ReadonlyArray<readonly [string, { version: string }]> = [
      ['ext-a', { version: '2.0.0' }],
    ]
    const catalog = makeCatalog({ 'ext-a': catalogEntry('1.0.0') })

    expect(findAvailableUpdates(installed, catalog)).toEqual([])
  })

  it('handles multiple extensions with mixed updates', () => {
    const installed: ReadonlyArray<readonly [string, { version: string }]> = [
      ['ext-a', { version: '1.0.0' }],
      ['ext-b', { version: '3.0.0' }],
      ['ext-c', { version: '1.0.0' }],
    ]
    const catalog = makeCatalog({
      'ext-a': catalogEntry('2.0.0'),
      'ext-b': catalogEntry('3.0.0'),
      'ext-c': catalogEntry('1.5.0'),
    })

    const updates = findAvailableUpdates(installed, catalog)
    expect(updates).toHaveLength(2)
    expect(updates.map((u) => u.id).sort()).toEqual(['ext-a', 'ext-c'])
  })
})

// --- formatUpdateResults ---

describe('formatUpdateResults', () => {
  it('returns "up to date" for empty updates', () => {
    expect(formatUpdateResults([])).toBe('All extensions are up to date.')
  })

  it('formats table with updates', () => {
    const updates = [
      { id: 'ext-a', currentVersion: '1.0.0', latestVersion: '2.0.0' },
    ]
    const result = formatUpdateResults(updates)
    expect(result).toContain('ext-a')
    expect(result).toContain('1.0.0')
    expect(result).toContain('2.0.0')
    expect(result).toContain('Current')
    expect(result).toContain('Available')
  })
})

// --- runExtensionUpdate ---

describe('runExtensionUpdate', () => {
  it('returns updates for project with outdated extensions', async () => {
    const projectDir = join(tmpDir, 'project')
    await mkdir(join(projectDir, '.faber', 'extensions'), { recursive: true })

    const reg = addExtension(emptyRegistry(), 'ext-a', {
      version: '1.0.0',
      source: 'catalog',
      installedAt: '2026-01-01T00:00:00Z',
    })
    await writeFile(join(projectDir, '.faber', 'extensions', '.registry'), serializeRegistry(reg))

    const catalog = makeCatalog({ 'ext-a': catalogEntry('2.0.0') })

    const result = await runExtensionUpdate({ cwd: projectDir, catalog })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().updates).toHaveLength(1)
    expect(result._unsafeUnwrap().updates[0]!.latestVersion).toBe('2.0.0')
  })

  it('returns empty when all up to date', async () => {
    const projectDir = join(tmpDir, 'project')
    await mkdir(join(projectDir, '.faber', 'extensions'), { recursive: true })

    const reg = addExtension(emptyRegistry(), 'ext-a', {
      version: '2.0.0',
      source: 'catalog',
      installedAt: '2026-01-01T00:00:00Z',
    })
    await writeFile(join(projectDir, '.faber', 'extensions', '.registry'), serializeRegistry(reg))

    const catalog = makeCatalog({ 'ext-a': catalogEntry('2.0.0') })

    const result = await runExtensionUpdate({ cwd: projectDir, catalog })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().updates).toEqual([])
    expect(result._unsafeUnwrap().formatted).toContain('up to date')
  })

  it('returns not_a_project when .faber missing', async () => {
    const emptyDir = join(tmpDir, 'empty')
    await mkdir(emptyDir, { recursive: true })

    const result = await runExtensionUpdate({ cwd: emptyDir, catalog: makeCatalog() })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_a_project')
  })
})
