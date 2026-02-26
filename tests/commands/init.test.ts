import { describe, it, expect } from 'vitest'
import {
  validateInitOptions,
  resolveProjectPath,
  type InitOptions,
} from '../../src/commands/init.ts'

// --- validateInitOptions ---

describe('validateInitOptions', () => {
  const valid: InitOptions = {
    projectName: 'my-project',
    ai: 'claude',
    script: 'sh',
    here: false,
    noGit: false,
    force: false,
    aiSkills: false,
  }

  it('accepts valid options', () => {
    expect(validateInitOptions(valid).isOk()).toBe(true)
  })

  it('rejects empty project name when not --here', () => {
    const result = validateInitOptions({ ...valid, projectName: '' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('validation')
  })

  it('allows empty project name with --here', () => {
    const result = validateInitOptions({ ...valid, projectName: '', here: true })
    expect(result.isOk()).toBe(true)
  })

  it('rejects unknown agent', () => {
    const result = validateInitOptions({ ...valid, ai: 'nonexistent' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('validation')
  })

  it('accepts all known agents', () => {
    for (const agent of ['claude', 'copilot', 'gemini', 'cursor-agent', 'generic']) {
      expect(validateInitOptions({ ...valid, ai: agent }).isOk()).toBe(true)
    }
  })

  it('rejects invalid script type', () => {
    const result = validateInitOptions({ ...valid, script: 'bat' })
    expect(result.isErr()).toBe(true)
  })

  it('accepts sh and ps script types', () => {
    expect(validateInitOptions({ ...valid, script: 'sh' }).isOk()).toBe(true)
    expect(validateInitOptions({ ...valid, script: 'ps' }).isOk()).toBe(true)
  })

  it('aiSkills requires ai to be set', () => {
    const result = validateInitOptions({ ...valid, ai: '', aiSkills: true })
    expect(result.isErr()).toBe(true)
  })
})

// --- resolveProjectPath ---

describe('resolveProjectPath', () => {
  it('returns cwd for --here mode', () => {
    const result = resolveProjectPath('', true, '/home/user')
    expect(result).toBe('/home/user')
  })

  it('joins cwd and project name', () => {
    const result = resolveProjectPath('my-app', false, '/home/user')
    expect(result).toBe('/home/user/my-app')
  })

  it('handles project name with path separator', () => {
    const result = resolveProjectPath('sub/project', false, '/home/user')
    expect(result).toContain('sub')
    expect(result).toContain('project')
  })
})
