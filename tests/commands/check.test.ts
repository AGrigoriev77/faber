import { describe, it, expect } from 'vitest'
import {
  formatCheckResult,
  type ToolCheckResult,
} from '../../src/commands/check.ts'

// --- formatCheckResult ---

describe('formatCheckResult', () => {
  it('formats found tool', () => {
    const result: ToolCheckResult = { tool: 'git', status: 'found' }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('git')
    expect(formatted).toContain('found')
  })

  it('formats missing required tool', () => {
    const result: ToolCheckResult = { tool: 'git', status: 'missing_required' }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('git')
    expect(formatted).toContain('missing')
  })

  it('formats missing optional tool', () => {
    const result: ToolCheckResult = { tool: 'vscode', status: 'missing_optional' }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('vscode')
    expect(formatted).toContain('optional')
  })
})
