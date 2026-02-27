import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile as nodeWriteFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  isGitRepo,
  initGitRepo,
  checkTool,
} from '../../src/utils/git.ts'

const execFileAsync = promisify(execFile)

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'faber-git-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('isGitRepo', () => {
  it('returns false for non-git directory', async () => {
    const result = await isGitRepo(tmpDir)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(false)
  })

  it('returns true after git init', async () => {
    await initGitRepo(tmpDir)
    const result = await isGitRepo(tmpDir)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(true)
  })

  it('returns false for nonexistent path', async () => {
    const result = await isGitRepo(join(tmpDir, 'nope'))
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(false)
  })
})

describe('initGitRepo', () => {
  it('initializes a git repo with initial commit', async () => {
    await nodeWriteFile(join(tmpDir, 'README.md'), '# test')

    const result = await initGitRepo(tmpDir)
    expect(result.isOk()).toBe(true)

    const isRepo = await isGitRepo(tmpDir)
    expect(isRepo._unsafeUnwrap()).toBe(true)
  })

  it('returns ok even with empty directory (git init succeeds)', async () => {
    const result = await initGitRepo(tmpDir)
    expect(result.isOk()).toBe(true)
  })

  it('returns err for nonexistent directory', async () => {
    const result = await initGitRepo(join(tmpDir, 'nope'))
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('git_error')
  })

  it('commit message contains "faber"', async () => {
    await nodeWriteFile(join(tmpDir, 'README.md'), '# test')
    await initGitRepo(tmpDir)
    const { stdout } = await execFileAsync('git', ['log', '--oneline', '-1'], { cwd: tmpDir })
    expect(stdout.toLowerCase()).toContain('faber')
  })
})

describe('checkTool', () => {
  it('finds git (should be installed in CI/dev)', async () => {
    const result = await checkTool('git')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(true)
  })

  it('returns false for nonexistent tool', async () => {
    const result = await checkTool('definitely-not-a-real-tool-xyz-999')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(false)
  })
})
