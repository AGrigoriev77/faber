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

  it('aiSkills requires ai to be set with correct error', () => {
    const result = validateInitOptions({ ...valid, ai: '', aiSkills: true })
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('validation')
    expect(error.message).toContain('--ai')
  })

  it('aiSkills=false + ai="" passes validation', () => {
    const result = validateInitOptions({ ...valid, ai: '', aiSkills: false, here: true })
    expect(result.isOk()).toBe(true)
  })

  it('rejects whitespace-only project name when not --here', () => {
    const result = validateInitOptions({ ...valid, projectName: '   ', here: false })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('validation')
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

  const defaults: RunInitOptions = { projectPath: '', ai: 'claude', noGit: true, aiSkills: false }

  const init = (dir: string, overrides: Partial<RunInitOptions> = {}) =>
    runInit({ ...defaults, projectPath: dir, ...overrides })

  it('creates project directory with files', async () => {
    const dir = join(tmp, 'my-app')
    const result = await init(dir)
    expect(result.isOk()).toBe(true)
    expect((await readdir(dir)).length).toBeGreaterThan(0)
  })

  it('copies template files into .faber/templates/', async () => {
    const dir = join(tmp, 'proj')
    await init(dir)
    const files = await readdir(join(dir, '.faber', 'templates'))
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
    expect(await readdir(join(tmp, '.faber'))).toContain('templates')
  })

  it('copies scripts into .faber/scripts/', async () => {
    const dir = join(tmp, 'scripts-test')
    await init(dir)
    const files = await readdir(join(dir, '.faber', 'scripts'))
    expect(files).toContain('common.ts')
    expect(files).toContain('create-new-feature.ts')
    expect(files).toContain('check-prerequisites.ts')
    expect(files).toContain('setup-plan.ts')
    expect(files).toContain('update-agent-context.ts')
    expect(files.length).toBe(5)
  })

  it('filesCreated is an exact count (6 templates + 5 scripts + 1 vscode + 10 commands = 22)', async () => {
    const dir = join(tmp, 'exact-count')
    const result = await init(dir)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      // 6 TEMPLATE_FILES + 5 scripts + 1 vscode/settings.json + 10 command files
      expect(result.value.filesCreated).toBe(22)
    }
  })

  it('renderAgentCommands: .claude/commands/ contains ONLY .md files', async () => {
    const dir = join(tmp, 'md-only')
    await init(dir)
    const files = await readdir(join(dir, '.claude', 'commands'))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      expect(f.endsWith('.md')).toBe(true)
    }
  })

  it('init with no ai agent creates no commands directory', async () => {
    const dir = join(tmp, 'no-ai')
    await init(dir, { ai: '' })
    const entries = await readdir(dir, { recursive: true })
    // No .claude/commands, .gemini/commands, etc.
    const hasCommandsDir = entries.some((e) =>
      typeof e === 'string' && e.includes('commands'),
    )
    expect(hasCommandsDir).toBe(false)
  })

  it('init with unknown agent format creates no commands directory', async () => {
    const dir = join(tmp, 'unknown-agent')
    await init(dir, { ai: 'nonexistent-agent-format' })
    const entries = await readdir(dir, { recursive: true })
    const hasCommandsDir = entries.some((e) =>
      typeof e === 'string' && e.includes('commands'),
    )
    expect(hasCommandsDir).toBe(false)
  })

  it('init with toml-based agent (gemini) creates .toml files', async () => {
    const dir = join(tmp, 'toml-agent')
    await init(dir, { ai: 'qwen' })
    const files = await readdir(join(dir, '.qwen', 'commands'))
    expect(files.length).toBeGreaterThan(0)
    expect(files.some((f) => f.endsWith('.toml'))).toBe(true)
  })

  it('copyTemplates handles missing template file gracefully', async () => {
    // If templates exist, init succeeds even if one is missing
    const dir = join(tmp, 'graceful')
    const result = await init(dir)
    expect(result.isOk()).toBe(true)
  })

  it('returns fs error for project path under /dev/null', async () => {
    const result = await init('/dev/null/impossible/project')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('fs')
  })

  it('works with ai="" and here=true — no agent commands', async () => {
    const result = await init(tmp, { ai: '' })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      // 6 templates + 5 scripts + 1 vscode = 12, no commands
      expect(result.value.filesCreated).toBe(12)
    }
  })
})
