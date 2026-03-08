import { join, dirname, basename } from 'node:path'
import { readdir, readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { ok, err, okAsync, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { AGENTS } from '../core/agents.ts'
import { AGENT_FORMATS } from '../extensions/registrar.ts'
import { renderCommandForAgent } from '../extensions/manager.ts'
import { initGitRepo } from '../utils/git.ts'
import { downloadAsset, extractZip } from '../core/templates.ts'
import type { TemplateError } from '../core/templates.ts'
import { fetchLatestRelease } from '../core/github.ts'
import type { ApiError } from '../core/github.ts'
import { assertNever } from '../fp/types.ts'
import { EXPECTED_TEMPLATES } from './check.ts'

export { EXPECTED_TEMPLATES }

// --- Types ---

export interface InitOptions {
  readonly projectName: string
  readonly ai: string
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
  readonly noGit: boolean
  readonly aiSkills: boolean
  readonly localTemplatesZip?: string  // bypass GitHub download (for testing/dev)
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

// --- Error mapping ---

const apiErrToInit = (e: ApiError): InitError => {
  switch (e.tag) {
    case 'http': return { tag: 'download', message: `HTTP ${e.status}: ${e.message}` }
    case 'network': return { tag: 'download', message: e.message }
    case 'parse': return { tag: 'download', message: `Parse error: ${e.message}` }
    case 'asset_not_found': return { tag: 'download', message: `Asset not found: ${e.agent}` }
    default: return assertNever(e)
  }
}

const templateErrToInit = (e: TemplateError): InitError => {
  switch (e.tag) {
    case 'api': return apiErrToInit(e.inner)
    case 'fs': return { tag: 'download', message: e.inner.tag === 'not_found' ? `File not found: ${e.inner.path}` : e.inner.message }
    case 'zip': return { tag: 'download', message: e.message }
    case 'merge': return { tag: 'download', message: e.message }
    default: return assertNever(e)
  }
}

// --- Pure validation ---

const checkProjectName = (opts: InitOptions): Result<InitOptions, InitError> =>
  !opts.here && !opts.projectName.trim()
    ? err({ tag: 'validation', message: 'Project name is required (or use --here)' })
    : ok(opts)

const checkAgent = (opts: InitOptions): Result<InitOptions, InitError> =>
  opts.ai && !AGENTS.has(opts.ai as never)
    ? err({ tag: 'validation', message: `Unknown AI agent: ${opts.ai}` })
    : ok(opts)

const checkAiSkills = (opts: InitOptions): Result<InitOptions, InitError> =>
  opts.aiSkills && !opts.ai
    ? err({ tag: 'validation', message: '--ai-skills requires --ai to be set' })
    : ok(opts)

export const validateInitOptions = (opts: InitOptions): Result<InitOptions, InitError> =>
  ok(opts)
    .andThen(checkProjectName)
    .andThen(checkAgent)
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

const extractTemplatesFromZip = (zipPath: string, faberDir: string, ctx: InitContext): ResultAsync<InitContext, InitError> =>
  new ResultAsync(
    extractZip(zipPath, faberDir).then((r) => r.mapErr(templateErrToInit)),
  ).map((files) => ({ ...ctx, filesCreated: ctx.filesCreated + files.length }))

const downloadAndExtractTemplates = (ctx: InitContext): ResultAsync<InitContext, InitError> => {
  const faberDir = join(ctx.opts.projectPath, '.faber')

  if (ctx.opts.localTemplatesZip) {
    return extractTemplatesFromZip(ctx.opts.localTemplatesZip, faberDir, ctx)
  }

  const tmpZip = join(tmpdir(), `faber-templates-${Date.now()}.zip`)

  const token = process.env['GH_TOKEN'] ?? process.env['GITHUB_TOKEN']
  const release = new ResultAsync(
    fetchLatestRelease({ fetch: globalThis.fetch, token }).then((r) => r.mapErr(apiErrToInit)),
  )

  return release
    .andThen((r) => {
      const asset = r.assets.find((a) => a.name === 'faber-templates.zip')
      return asset
        ? ok(asset)
        : err<never, InitError>({ tag: 'download', message: 'faber-templates.zip not found in latest release' })
    })
    .andThen((asset) =>
      new ResultAsync(
        downloadAsset(asset.browserDownloadUrl, tmpZip).then((r) => r.mapErr(templateErrToInit)),
      ),
    )
    .andThen(() => extractTemplatesFromZip(tmpZip, faberDir, ctx))
    .map((result) => {
      unlink(tmpZip).catch(() => undefined)
      return result
    })
}

const copyVscodeSettings = (ctx: InitContext): ResultAsync<InitContext, InitError> => {
  const vscodeDir = join(ctx.opts.projectPath, '.vscode')
  const src = join(ctx.opts.projectPath, '.faber', 'templates', 'vscode-settings.json')

  return wrap(() => mkdir(vscodeDir, { recursive: true }))
    .andThen(() => ResultAsync.fromPromise(
      readFile(src, 'utf-8').then((content) =>
        writeFile(join(vscodeDir, 'settings.json'), content),
      ),
      (e) => ({ tag: 'fs' as const, message: e instanceof Error ? e.message : String(e) }),
    ))
    .map(() => ({ ...ctx, filesCreated: ctx.filesCreated + 1 }))
    .orElse(() => okAsync(ctx))
}

const renderAgentCommands = (ctx: InitContext): ResultAsync<InitContext, InitError> => {
  const format = ctx.opts.ai ? AGENT_FORMATS.get(ctx.opts.ai) : undefined
  if (!format) return okAsync(ctx)

  const commandsSourceDir = join(ctx.opts.projectPath, '.faber', 'templates', 'commands')
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
    .andThen(downloadAndExtractTemplates)
    .andThen(copyVscodeSettings)
    .andThen(renderAgentCommands)
    .andThen(initGit)
    .map((ctx) => ({
      projectPath: ctx.opts.projectPath,
      agent: ctx.opts.ai,
      filesCreated: ctx.filesCreated,
    }))
}
