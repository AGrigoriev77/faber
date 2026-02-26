import { describe, it, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import fc from 'fast-check'
import {
  assetName,
  flattenPrefix,
  mergeJsonObjects,
  shouldMerge,
  isExecutableScript,
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
