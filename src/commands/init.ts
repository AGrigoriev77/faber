import { join, dirname, basename } from 'node:path'
import { readdir, readFile, writeFile, mkdir, chmod, cp } from 'node:fs/promises'
import { ok, err, okAsync, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { AGENTS } from '../core/agents.ts'
import { AGENT_FORMATS } from '../extensions/registrar.ts'
import { renderCommandForAgent } from '../extensions/manager.ts'
import { initGitRepo } from '../utils/git.ts'
import { isExecutableScript } from '../core/templates.ts'

// --- Types ---

export interface InitOptions {
  readonly projectName: string
  readonly ai: string
  readonly script: string
  readonly here: boolean
  readonly noGit: boolean
  readonly force: boolean
  readonly aiSkills: boolean
  readonly githubToken?: string
  readonly aiCommandsDir?: string
}

export interface RunInitOptions {
  readonly projectPath: string
  readonly ai: string
  readonly script: string
  readonly noGit: boolean
  readonly aiSkills: boolean
}

export interface InitResult {
  readonly projectPath: string
  readonly agent: string
  readonly filesCreated: number
}

export type InitError =
  | { readonly tag: 'validation'; readonly message: string }
  | { readonly tag: 'fs'; readonly message: string }
  | { readonly tag: 'download'; readonly message: string }

// --- Internal pipeline context (immutable accumulator) ---

interface InitContext {
  readonly opts: RunInitOptions
  readonly filesCreated: number
}

// --- Constants ---

const VALID_SCRIPT_TYPES = new Set(['sh', 'ps'])

const BUNDLED_TEMPLATES_DIR = join(dirname(dirname(import.meta.dirname)), 'templates')

const TEMPLATE_FILES = [
  'spec-template.md',
  'plan-template.md',
  'tasks-template.md',
  'constitution-template.md',
  'checklist-template.md',
  'agent-file-template.md',
]

// --- Pure validation ---

const checkProjectName = (opts: InitOptions): Result<InitOptions, InitError> =>
  !opts.here && !opts.projectName.trim()
    ? err({ tag: 'validation', message: 'Project name is required (or use --here)' })
    : ok(opts)

const checkAgent = (opts: InitOptions): Result<InitOptions, InitError> =>
  opts.ai && !AGENTS.has(opts.ai as never)
    ? err({ tag: 'validation', message: `Unknown AI agent: ${opts.ai}` })
    : ok(opts)

const checkScriptType = (opts: InitOptions): Result<InitOptions, InitError> =>
  !VALID_SCRIPT_TYPES.has(opts.script)
    ? err({ tag: 'validation', message: `Invalid script type: ${opts.script}. Use sh or ps` })
    : ok(opts)

const checkAiSkills = (opts: InitOptions): Result<InitOptions, InitError> =>
  opts.aiSkills && !opts.ai
    ? err({ tag: 'validation', message: '--ai-skills requires --ai to be set' })
    : ok(opts)

export const validateInitOptions = (opts: InitOptions): Result<InitOptions, InitError> =>
  ok(opts)
    .andThen(checkProjectName)
    .andThen(checkAgent)
    .andThen(checkScriptType)
    .andThen(checkAiSkills)

export const resolveProjectPath = (name: string, here: boolean, cwd: string): string =>
  here ? cwd : join(cwd, name)

// --- Pipeline steps: InitContext => ResultAsync<InitContext, InitError> ---

const wrap = (fn: () => Promise<unknown>): ResultAsync<void, InitError> =>
  ResultAsync.fromPromise(fn().then(() => undefined), (e) => ({
    tag: 'fs' as const,
    message: e instanceof Error ? e.message : String(e),
  }))

const createProjectDir = (ctx: InitContext): ResultAsync<InitContext, InitError> =>
  wrap(() => mkdir(ctx.opts.projectPath, { recursive: true })).map(() => ctx)

const copyTemplates = (ctx: InitContext): ResultAsync<InitContext, InitError> => {
  const templatesDir = join(ctx.opts.projectPath, '.faber', 'templates')

  return wrap(() => mkdir(templatesDir, { recursive: true }))
    .andThen(() => ResultAsync.fromPromise(
      Promise.all(
        TEMPLATE_FILES.map((file) =>
          cp(join(BUNDLED_TEMPLATES_DIR, file), join(templatesDir, file))
            .then(() => true as const)
            .catch(() => false as const),
        ),
      ).then((results) => results.filter(Boolean).length),
      (e) => ({ tag: 'fs' as const, message: e instanceof Error ? e.message : String(e) }),
    ))
    .map((copied) => ({ ...ctx, filesCreated: ctx.filesCreated + copied }))
}

const copyVscodeSettings = (ctx: InitContext): ResultAsync<InitContext, InitError> => {
  const vscodeDir = join(ctx.opts.projectPath, '.vscode')
  const src = join(BUNDLED_TEMPLATES_DIR, 'vscode-settings.json')

  return wrap(() => mkdir(vscodeDir, { recursive: true }))
    .andThen(() => ResultAsync.fromPromise(
      readFile(src, 'utf-8').then((content) =>
        writeFile(join(vscodeDir, 'settings.json'), content),
      ),
      (e) => ({ tag: 'fs' as const, message: e instanceof Error ? e.message : String(e) }),
    ))
    .map(() => ({ ...ctx, filesCreated: ctx.filesCreated + 1 }))
    .orElse(() => okAsync(ctx)) // skip silently if template missing
}

const renderAgentCommands = (ctx: InitContext): ResultAsync<InitContext, InitError> => {
  const format = ctx.opts.ai ? AGENT_FORMATS.get(ctx.opts.ai) : undefined
  if (!format) return okAsync(ctx)

  const commandsSourceDir = join(BUNDLED_TEMPLATES_DIR, 'commands')
  const cmdDir = join(ctx.opts.projectPath, format.dir)

  return wrap(() => mkdir(cmdDir, { recursive: true }))
    .andThen(() => ResultAsync.fromPromise(
      readdir(commandsSourceDir)
        .then((files) =>
          Promise.all(
            files
              .filter((file) => file.endsWith('.md'))
              .map(async (file) => {
                const name = `faber.${basename(file, '.md')}`
                const source = await readFile(join(commandsSourceDir, file), 'utf-8')
                const cmd = renderCommandForAgent(source, ctx.opts.ai, format, name)
                await mkdir(dirname(join(ctx.opts.projectPath, cmd.relativePath)), { recursive: true })
                await writeFile(join(ctx.opts.projectPath, cmd.relativePath), cmd.content)
              }),
          ),
        )
        .then((results) => results.length),
      (e) => ({ tag: 'fs' as const, message: e instanceof Error ? e.message : String(e) }),
    ))
    .map((rendered) => ({ ...ctx, filesCreated: ctx.filesCreated + rendered }))
    .orElse(() => okAsync(ctx))
}

const makeExecutable = (ctx: InitContext): ResultAsync<InitContext, InitError> =>
  ResultAsync.fromPromise(
    readdir(ctx.opts.projectPath, { withFileTypes: true, recursive: true })
      .then((entries) =>
        Promise.all(
          entries
            .filter((entry) => entry.isFile() && isExecutableScript(entry.name))
            .map((entry) => chmod(join(entry.parentPath ?? ctx.opts.projectPath, entry.name), 0o755)),
        ),
      ),
    (e) => ({ tag: 'fs' as const, message: e instanceof Error ? e.message : String(e) }),
  )
    .map(() => ctx)
    .orElse(() => okAsync(ctx))

const initGit = (ctx: InitContext): ResultAsync<InitContext, InitError> => {
  if (ctx.opts.noGit) return okAsync(ctx)

  return ResultAsync.fromPromise(
    initGitRepo(ctx.opts.projectPath).then(() => undefined),
    (e) => ({ tag: 'fs' as const, message: e instanceof Error ? e.message : String(e) }),
  ).map(() => ctx)
}

// --- Orchestrator: pure .andThen() pipeline ---

export const runInit = (opts: RunInitOptions): ResultAsync<InitResult, InitError> => {
  const seed: InitContext = { opts, filesCreated: 0 }

  return okAsync(seed)
    .andThen(createProjectDir)
    .andThen(copyTemplates)
    .andThen(copyVscodeSettings)
    .andThen(renderAgentCommands)
    .andThen(makeExecutable)
    .andThen(initGit)
    .map((ctx) => ({
      projectPath: ctx.opts.projectPath,
      agent: ctx.opts.ai,
      filesCreated: ctx.filesCreated,
    }))
}
