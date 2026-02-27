import { describe, it, expect, vi } from 'vitest'

// Mock child_process to reject with non-Error value
vi.mock('node:child_process', () => ({
  execFile: vi.fn((...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: unknown) => void
    cb('string-error-not-Error-instance')
  }),
}))

// Dynamic import AFTER vi.mock so promisify wraps the mocked execFile
const { initGitRepo, checkTool } = await import('../../src/utils/git.ts')

describe('git error handling: non-Error rejection', () => {
  it('initGitRepo handles non-Error rejection via String(e)', async () => {
    const result = await initGitRepo('/tmp/nonexistent')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('git_error')
    expect(result._unsafeUnwrapErr().message).toBe('string-error-not-Error-instance')
  })

  it('checkTool returns false on non-Error rejection', async () => {
    const result = await checkTool('git')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(false)
  })
})
