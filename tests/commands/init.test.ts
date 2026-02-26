import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  validateInitOptions,
  resolveProjectPath,
  runInit,
  type InitOptions,
  type RunInitOptions,
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
    expect(validateInitOptions({ ...valid, projectName: '', here: true }).isOk()).toBe(true)
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
    expect(validateInitOptions({ ...valid, script: 'bat' }).isErr()).toBe(true)
  })

  it('accepts sh and ps script types', () => {
    expect(validateInitOptions({ ...valid, script: 'sh' }).isOk()).toBe(true)
    expect(validateInitOptions({ ...valid, script: 'ps' }).isOk()).toBe(true)
  })

  it('aiSkills requires ai to be set', () => {
    expect(validateInitOptions({ ...valid, ai: '', aiSkills: true }).isErr()).toBe(true)
  })
})

// --- resolveProjectPath ---

describe('resolveProjectPath', () => {
  it('returns cwd for --here mode', () => {
    expect(resolveProjectPath('', true, '/home/user')).toBe('/home/user')
  })

  it('joins cwd and project name', () => {
    expect(resolveProjectPath('my-app', false, '/home/user')).toBe('/home/user/my-app')
  })

  it('handles project name with path separator', () => {
    const result = resolveProjectPath('sub/project', false, '/home/user')
    expect(result).toContain('sub')
    expect(result).toContain('project')
  })
})

// --- runInit (integration) ---

describe('runInit', () => {
  let tmp: string

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'faber-init-'))
  })

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true })
  })

  const defaults: RunInitOptions = { projectPath: '', ai: 'claude', script: 'sh', noGit: true, aiSkills: false }

  const init = (dir: string, overrides: Partial<RunInitOptions> = {}) =>
    runInit({ ...defaults, projectPath: dir, ...overrides })

  it('creates project directory with files', async () => {
    const dir = join(tmp, 'my-app')
    const result = await init(dir)
    expect(result.isOk()).toBe(true)
    expect((await readdir(dir)).length).toBeGreaterThan(0)
  })

  it('copies template files into .specify/templates/', async () => {
    const dir = join(tmp, 'proj')
    await init(dir)
    const files = await readdir(join(dir, '.specify', 'templates'))
    expect(files).toContain('spec-template.md')
    expect(files).toContain('plan-template.md')
    expect(files).toContain('tasks-template.md')
    expect(files).toContain('constitution-template.md')
  })

  it('creates .claude/commands/ with faber-prefixed .md files', async () => {
    const dir = join(tmp, 'proj')
    await init(dir)
    const files = await readdir(join(dir, '.claude', 'commands'))
    expect(files.length).toBeGreaterThan(0)
    expect(files.every((f) => f.startsWith('faber.') && f.endsWith('.md'))).toBe(true)
  })

  it('creates .gemini/commands/ with faber-prefixed .toml files', async () => {
    const dir = join(tmp, 'proj')
    await init(dir, { ai: 'gemini' })
    const files = await readdir(join(dir, '.gemini', 'commands'))
    expect(files.some((f) => f.startsWith('faber.') && f.endsWith('.toml'))).toBe(true)
  })

  it('command files have content', async () => {
    const dir = join(tmp, 'proj')
    await init(dir)
    const files = await readdir(join(dir, '.claude', 'commands'))
    const content = await readFile(join(dir, '.claude', 'commands', files[0]!), 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('creates .vscode/settings.json', async () => {
    const dir = join(tmp, 'proj')
    await init(dir)
    const content = await readFile(join(dir, '.vscode', 'settings.json'), 'utf-8')
    expect(JSON.parse(content)).toBeDefined()
  })

  it('initializes git repo by default', async () => {
    const dir = join(tmp, 'proj')
    await init(dir, { noGit: false })
    expect((await stat(join(dir, '.git'))).isDirectory()).toBe(true)
  })

  it('skips git when noGit is true', async () => {
    const dir = join(tmp, 'proj')
    await init(dir)
    expect(await readdir(dir)).not.toContain('.git')
  })

  it('returns metadata with file count', async () => {
    const dir = join(tmp, 'proj')
    const result = await init(dir)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.agent).toBe('claude')
      expect(result.value.filesCreated).toBeGreaterThan(0)
    }
  })

  it('works in existing directory (--here)', async () => {
    const result = await init(tmp)
    expect(result.isOk()).toBe(true)
    expect(await readdir(join(tmp, '.specify'))).toContain('templates')
  })
})
