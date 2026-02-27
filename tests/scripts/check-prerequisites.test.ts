import { describe, it, expect } from 'vitest'
import { buildAvailableDocs } from '../../scripts/check-prerequisites.ts'

// ─── Canonical doc list (same order as the script) ──────────────────────
// ['research.md', 'data-model.md', 'contracts/', 'quickstart.md', 'tasks.md']

describe('buildAvailableDocs', () => {
  it('returns empty array when no files exist', () => {
    expect(buildAvailableDocs([], false)).toEqual([])
    expect(buildAvailableDocs([], true)).toEqual([])
  })

  it('returns only items present in existing list', () => {
    const existing = ['research.md', 'quickstart.md']
    const result = buildAvailableDocs(existing, false)
    expect(result).toEqual(['research.md', 'quickstart.md'])
  })

  it('excludes tasks.md when includeTasks is false even if it exists', () => {
    const existing = ['research.md', 'tasks.md', 'quickstart.md']
    const result = buildAvailableDocs(existing, false)
    expect(result).not.toContain('tasks.md')
  })

  it('includes tasks.md when includeTasks is true and it exists', () => {
    const existing = ['research.md', 'tasks.md', 'quickstart.md']
    const result = buildAvailableDocs(existing, true)
    expect(result).toContain('tasks.md')
  })

  it('does not include tasks.md when includeTasks is true but it does not exist', () => {
    const existing = ['research.md', 'quickstart.md']
    const result = buildAvailableDocs(existing, true)
    expect(result).not.toContain('tasks.md')
  })

  it('returns all canonical docs when all exist and includeTasks is true', () => {
    const existing = [
      'research.md',
      'data-model.md',
      'contracts/',
      'quickstart.md',
      'tasks.md',
    ]
    const result = buildAvailableDocs(existing, true)
    expect(result).toEqual([
      'research.md',
      'data-model.md',
      'contracts/',
      'quickstart.md',
      'tasks.md',
    ])
  })

  it('returns all canonical docs except tasks.md when includeTasks is false', () => {
    const existing = [
      'research.md',
      'data-model.md',
      'contracts/',
      'quickstart.md',
      'tasks.md',
    ]
    const result = buildAvailableDocs(existing, false)
    expect(result).toEqual([
      'research.md',
      'data-model.md',
      'contracts/',
      'quickstart.md',
    ])
  })

  it('maintains canonical order regardless of input order', () => {
    // Input in reverse order
    const existing = ['quickstart.md', 'contracts/', 'data-model.md', 'research.md']
    const result = buildAvailableDocs(existing, false)
    expect(result).toEqual([
      'research.md',
      'data-model.md',
      'contracts/',
      'quickstart.md',
    ])
  })

  it('ignores unknown items not in the canonical list', () => {
    const existing = ['research.md', 'unknown.md', 'random-file.txt', 'quickstart.md']
    const result = buildAvailableDocs(existing, false)
    expect(result).toEqual(['research.md', 'quickstart.md'])
  })

  it('handles single item in existing', () => {
    expect(buildAvailableDocs(['contracts/'], false)).toEqual(['contracts/'])
    expect(buildAvailableDocs(['tasks.md'], true)).toEqual(['tasks.md'])
    expect(buildAvailableDocs(['tasks.md'], false)).toEqual([])
  })
})
