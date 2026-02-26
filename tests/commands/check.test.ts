import { describe, it, expect } from 'vitest'
import {
  formatCheckResult,
  type ToolCheckResult,
} from '../../src/commands/check.ts'

// --- formatCheckResult ---

describe('formatCheckResult', () => {
  it('formats found tool', () => {
    const result: ToolCheckResult = { tool: 'git', found: true, required: true }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('git')
    expect(formatted).toContain('found') // or a checkmark
  })

  it('formats missing required tool', () => {
    const result: ToolCheckResult = { tool: 'git', found: false, required: true }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('git')
    expect(formatted).toContain('missing')
  })

  it('formats missing optional tool', () => {
    const result: ToolCheckResult = { tool: 'vscode', found: false, required: false }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('vscode')
    expect(formatted).toContain('optional')
  })
})
