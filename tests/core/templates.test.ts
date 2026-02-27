import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { test } from '@fast-check/vitest'
import fc from 'fast-check'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile as nodeWriteFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  assetName,
  flattenPrefix,
  mergeJsonObjects,
  shouldMerge,
  isExecutableScript,
  extractZip,
  downloadAsset,
  apiError,
  fsError,
  zipError,
  mergeError,
} from '../../src/core/templates.ts'

// --- assetName ---

describe('assetName', () => {
  it('builds standard asset name', () => {
    expect(assetName('claude', 'sh')).toBe('faber-template-claude-sh.zip')
  })

  it('builds ps asset name', () => {
    expect(assetName('copilot', 'ps')).toBe('faber-template-copilot-ps.zip')
  })

  it('builds for any agent/script combo', () => {
    expect(assetName('gemini', 'sh')).toBe('faber-template-gemini-sh.zip')
  })

  test.prop([
    fc.stringMatching(/^[a-z]{2,10}$/),
    fc.constantFrom('sh', 'ps'),
  ])('always ends with .zip', (agent, script) => {
    expect(assetName(agent, script)).toMatch(/\.zip$/)
  })

  test.prop([
    fc.stringMatching(/^[a-z]{2,10}$/),
    fc.constantFrom('sh', 'ps'),
  ])('contains agent and script type', (agent, script) => {
    const name = assetName(agent, script)
    expect(name).toContain(agent)
    expect(name).toContain(script)
  })
})

// --- flattenPrefix ---

describe('flattenPrefix', () => {
  it('removes common single-directory prefix', () => {
    const entries = [
      'template-v1/README.md',
      'template-v1/src/index.ts',
      'template-v1/.vscode/settings.json',
    ]
    const result = flattenPrefix(entries)
    expect(result).toEqual([
      'README.md',
      'src/index.ts',
      '.vscode/settings.json',
    ])
  })

  it('does nothing when no common prefix', () => {
    const entries = ['README.md', 'src/index.ts', '.vscode/settings.json']
    const result = flattenPrefix(entries)
    expect(result).toEqual(entries)
  })

  it('does nothing for empty list', () => {
    expect(flattenPrefix([])).toEqual([])
  })

  it('does nothing for single root file', () => {
    expect(flattenPrefix(['README.md'])).toEqual(['README.md'])
  })

  it('handles nested common prefix', () => {
    const entries = [
      'outer/README.md',
      'outer/src/main.ts',
    ]
    expect(flattenPrefix(entries)).toEqual(['README.md', 'src/main.ts'])
  })

  it('does not flatten when entries have different top-level dirs', () => {
    const entries = [
      'dir-a/file1.ts',
      'dir-b/file2.ts',
    ]
    expect(flattenPrefix(entries)).toEqual(entries)
  })

  it('skips bare directory entries (ending with /)', () => {
    const entries = [
      'template-v1/',
      'template-v1/README.md',
      'template-v1/src/index.ts',
    ]
    const result = flattenPrefix(entries)
    expect(result).toEqual(['README.md', 'src/index.ts'])
  })

  it('returns empty when all entries are directories', () => {
    const entries = ['dir-a/', 'dir-b/']
    expect(flattenPrefix(entries)).toEqual([])
  })

  it('handles single file with prefix', () => {
    expect(flattenPrefix(['prefix/file.ts'])).toEqual(['file.ts'])
  })
})

// --- mergeJsonObjects ---

describe('mergeJsonObjects', () => {
  it('merges flat objects', () => {
    const base = { a: 1, b: 2 }
    const update = { b: 3, c: 4 }
    expect(mergeJsonObjects(base, update)).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('deep merges nested objects', () => {
    const base = { top: { a: 1, b: 2 } }
    const update = { top: { b: 3, c: 4 } }
    expect(mergeJsonObjects(base, update)).toEqual({ top: { a: 1, b: 3, c: 4 } })
  })

  it('replaces arrays (does not merge)', () => {
    const base = { arr: [1, 2, 3] }
    const update = { arr: [4, 5] }
    expect(mergeJsonObjects(base, update)).toEqual({ arr: [4, 5] })
  })

  it('adds new keys from update', () => {
    const base = { existing: true }
    const update = { added: 'new' }
    expect(mergeJsonObjects(base, update)).toEqual({ existing: true, added: 'new' })
  })

  it('empty update returns base', () => {
    const base = { a: 1 }
    expect(mergeJsonObjects(base, {})).toEqual({ a: 1 })
  })

  it('empty base returns update', () => {
    expect(mergeJsonObjects({}, { a: 1 })).toEqual({ a: 1 })
  })

  it('does not mutate inputs', () => {
    const base = { a: { x: 1 } }
    const update = { a: { y: 2 } }
    mergeJsonObjects(base, update)
    expect(base).toEqual({ a: { x: 1 } })
    expect(update).toEqual({ a: { y: 2 } })
  })

  it('handles deeply nested merge', () => {
    const base = { l1: { l2: { l3: { a: 1 } } } }
    const update = { l1: { l2: { l3: { b: 2 } } } }
    expect(mergeJsonObjects(base, update)).toEqual({
      l1: { l2: { l3: { a: 1, b: 2 } } },
    })
  })

  it('update scalar overwrites object', () => {
    const base = { key: { nested: true } }
    const update = { key: 'string' }
    expect(mergeJsonObjects(base, update)).toEqual({ key: 'string' })
  })

  it('update object overwrites scalar', () => {
    const base = { key: 'string' }
    const update = { key: { nested: true } }
    expect(mergeJsonObjects(base, update)).toEqual({ key: { nested: true } })
  })
})

// --- shouldMerge ---

describe('shouldMerge', () => {
  it('returns true for .vscode/settings.json', () => {
    expect(shouldMerge('.vscode/settings.json')).toBe(true)
  })

  it('returns false for regular files', () => {
    expect(shouldMerge('README.md')).toBe(false)
    expect(shouldMerge('src/index.ts')).toBe(false)
  })

  it('returns false for other .vscode files', () => {
    expect(shouldMerge('.vscode/extensions.json')).toBe(false)
    expect(shouldMerge('.vscode/launch.json')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(shouldMerge('.VSCode/settings.json')).toBe(false)
  })
})

// --- isExecutableScript ---

describe('isExecutableScript', () => {
  it('returns true for .sh files', () => {
    expect(isExecutableScript('scripts/run.sh')).toBe(true)
  })

  it('returns true for .bash files', () => {
    expect(isExecutableScript('scripts/run.bash')).toBe(true)
  })

  it('returns false for .ps1 files', () => {
    expect(isExecutableScript('scripts/run.ps1')).toBe(false)
  })

  it('returns false for .ts files', () => {
    expect(isExecutableScript('src/index.ts')).toBe(false)
  })

  it('returns false for .md files', () => {
    expect(isExecutableScript('README.md')).toBe(false)
  })

  it('returns true for files in nested paths', () => {
    expect(isExecutableScript('.faber/scripts/bash/check.sh')).toBe(true)
  })
})

// --- Error constructors ---

describe('error constructors', () => {
  it('apiError creates api-tagged error', () => {
    const error = apiError({ tag: 'network', message: 'fail' })
    expect(error.tag).toBe('api')
    expect(error.inner.tag).toBe('network')
  })

  it('fsError creates fs-tagged error', () => {
    const error = fsError({ tag: 'not_found', path: '/x' })
    expect(error.tag).toBe('fs')
    expect(error.inner.tag).toBe('not_found')
  })

  it('zipError creates zip-tagged error', () => {
    const error = zipError('/test.zip', 'corrupt')
    expect(error.tag).toBe('zip')
    expect(error.path).toBe('/test.zip')
  })

  it('mergeError creates merge-tagged error', () => {
    const error = mergeError('/settings.json', 'conflict')
    expect(error.tag).toBe('merge')
    expect(error.path).toBe('/settings.json')
  })
})

// --- extractZip ---

describe('extractZip', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'faber-zip-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns zip error for nonexistent file', async () => {
    const result = await extractZip(join(tmpDir, 'nope.zip'), tmpDir)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('zip')
  })

  it('returns zip error for invalid zip data', async () => {
    const badZip = join(tmpDir, 'bad.zip')
    await nodeWriteFile(badZip, 'not a zip file')
    const result = await extractZip(badZip, tmpDir)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('zip')
  })
})

// --- downloadAsset ---

describe('downloadAsset', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'faber-dl-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('downloads and saves file on 200', async () => {
    const content = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => content.buffer,
    })
    const dest = join(tmpDir, 'asset.zip')
    const result = await downloadAsset('https://example.com/file.zip', dest, mockFetch)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(dest)
  })

  it('sends Authorization header when token provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    const dest = join(tmpDir, 'asset.zip')
    await downloadAsset('https://example.com/file.zip', dest, mockFetch, 'my-token')
    expect(mockFetch.mock.calls[0]![1].headers['Authorization']).toBe('Bearer my-token')
  })

  it('does not send Authorization header without token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    const dest = join(tmpDir, 'asset.zip')
    await downloadAsset('https://example.com/file.zip', dest, mockFetch)
    expect(mockFetch.mock.calls[0]![1].headers['Authorization']).toBeUndefined()
  })

  it('returns api error on non-200 status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })
    const dest = join(tmpDir, 'asset.zip')
    const result = await downloadAsset('https://example.com/file.zip', dest, mockFetch)
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('api')
    if (error.tag === 'api') {
      expect(error.inner.tag).toBe('http')
    }
  })

  it('returns network error on fetch failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('connection refused'))
    const dest = join(tmpDir, 'asset.zip')
    const result = await downloadAsset('https://example.com/file.zip', dest, mockFetch)
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('api')
    if (error.tag === 'api') {
      expect(error.inner.tag).toBe('network')
    }
  })

  it('returns network error on non-Error exception', async () => {
    const mockFetch = vi.fn().mockRejectedValue('string error')
    const dest = join(tmpDir, 'asset.zip')
    const result = await downloadAsset('https://example.com/file.zip', dest, mockFetch)
    expect(result.isErr()).toBe(true)
  })
})
