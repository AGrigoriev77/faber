import { describe, it, expect, beforeEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { runExtensionList, formatExtensionList } from '../../../src/commands/extension/list.ts'
import { addExtension, emptyRegistry, serializeRegistry } from '../../../src/extensions/registry.ts'
import type { ExtensionEntry } from '../../../src/extensions/registry.ts'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'faber-ext-list-'))
  return async () => { await rm(tmpDir, { recursive: true, force: true }) }
})

const entry = (version: string, source: string): ExtensionEntry => ({
  version,
  source,
  installedAt: '2026-01-01T00:00:00Z',
})

// --- formatExtensionList ---

describe('formatExtensionList', () => {
  it('returns "No extensions" for empty list', () => {
    expect(formatExtensionList([])).toBe('No extensions installed.')
  })

  it('formats a table with extensions', () => {
    const entries: ReadonlyArray<readonly [string, ExtensionEntry]> = [
      ['ext-a', entry('1.0.0', 'catalog')],
      ['ext-b', entry('2.0.0', 'local')],
    ]
    const result = formatExtensionList(entries)
    expect(result).toContain('ext-a')
    expect(result).toContain('ext-b')
    expect(result).toContain('1.0.0')
    expect(result).toContain('2.0.0')
    expect(result).toContain('ID')
    expect(result).toContain('Version')
  })
})

// --- runExtensionList ---

describe('runExtensionList', () => {
  it('returns not_a_project when .faber/ missing', async () => {
    const result = await runExtensionList({ cwd: tmpDir })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_a_project')
  })

  it('returns empty list for project with no extensions', async () => {
    await mkdir(join(tmpDir, '.faber'), { recursive: true })
    const result = await runExtensionList({ cwd: tmpDir })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().entries).toEqual([])
    expect(result._unsafeUnwrap().formatted).toBe('No extensions installed.')
  })

  it('returns installed extensions', async () => {
    const dir = join(tmpDir, '.faber', 'extensions')
    await mkdir(dir, { recursive: true })

    const reg = addExtension(
      addExtension(emptyRegistry(), 'ext-a', entry('1.0.0', 'catalog')),
      'ext-b',
      entry('2.0.0', 'local'),
    )
    await writeFile(join(dir, '.registry'), serializeRegistry(reg))

    const result = await runExtensionList({ cwd: tmpDir })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().entries).toHaveLength(2)
    expect(result._unsafeUnwrap().formatted).toContain('ext-a')
    expect(result._unsafeUnwrap().formatted).toContain('ext-b')
  })
})
