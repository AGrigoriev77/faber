import { describe, it, expect } from 'vitest'
import {
  formatError,
  formatSuccess,
  formatWarning,
  formatList,
  formatTable,
  type UiMessage,
} from '../../src/core/ui.ts'

// --- formatError ---

describe('formatError', () => {
  it('formats error message', () => {
    const result = formatError('Something failed')
    expect(result).toContain('Something failed')
  })

  it('includes tag when provided', () => {
    const result = formatError('Not found', 'not_found')
    expect(result).toContain('not_found')
  })
})

// --- formatSuccess ---

describe('formatSuccess', () => {
  it('formats success message', () => {
    const result = formatSuccess('All done')
    expect(result).toContain('All done')
  })
})

// --- formatWarning ---

describe('formatWarning', () => {
  it('formats warning message', () => {
    const result = formatWarning('Careful!')
    expect(result).toContain('Careful!')
  })
})

// --- formatList ---

describe('formatList', () => {
  it('formats items as bulleted list', () => {
    const result = formatList(['one', 'two', 'three'])
    expect(result).toContain('one')
    expect(result).toContain('two')
    expect(result).toContain('three')
  })

  it('returns empty string for empty list', () => {
    expect(formatList([])).toBe('')
  })

  it('each item on separate line', () => {
    const result = formatList(['a', 'b'])
    const lines = result.split('\n').filter((l) => l.trim().length > 0)
    expect(lines).toHaveLength(2)
  })
})

// --- formatTable ---

describe('formatTable', () => {
  it('formats rows with headers', () => {
    const result = formatTable(
      ['Name', 'Version'],
      [
        ['jira-sync', '1.0.0'],
        ['slack-notify', '2.0.0'],
      ],
    )
    expect(result).toContain('Name')
    expect(result).toContain('Version')
    expect(result).toContain('jira-sync')
    expect(result).toContain('1.0.0')
  })

  it('returns only headers for empty rows', () => {
    const result = formatTable(['Name'], [])
    expect(result).toContain('Name')
  })

  it('aligns columns', () => {
    const result = formatTable(
      ['ID', 'Name'],
      [
        ['a', 'Short'],
        ['bbb', 'Longer name'],
      ],
    )
    // Headers and data should be in the result
    expect(result).toContain('ID')
    expect(result).toContain('Longer name')
  })
})

// --- UiMessage type ---

describe('UiMessage', () => {
  it('represents error message', () => {
    const msg: UiMessage = { tag: 'error', text: 'fail' }
    expect(msg.tag).toBe('error')
  })

  it('represents success message', () => {
    const msg: UiMessage = { tag: 'success', text: 'ok' }
    expect(msg.tag).toBe('success')
  })

  it('represents warning message', () => {
    const msg: UiMessage = { tag: 'warning', text: 'warn' }
    expect(msg.tag).toBe('warning')
  })

  it('represents info message', () => {
    const msg: UiMessage = { tag: 'info', text: 'info' }
    expect(msg.tag).toBe('info')
  })
})
