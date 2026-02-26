import { describe, it, expect } from 'vitest'
import { formatVersionInfo } from '../../src/commands/version.ts'

// --- formatVersionInfo ---

describe('formatVersionInfo', () => {
  it('includes CLI version', () => {
    const result = formatVersionInfo('0.1.0', '1.2.3')
    expect(result).toContain('0.1.0')
  })

  it('includes latest template version', () => {
    const result = formatVersionInfo('0.1.0', '1.2.3')
    expect(result).toContain('1.2.3')
  })

  it('handles null latest version', () => {
    const result = formatVersionInfo('0.1.0', null)
    expect(result).toContain('0.1.0')
    expect(result).toContain('unknown')
  })
})
