import { join } from 'node:path'
import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import {
  checkFaberProject,
  loadRegistry,
  saveRegistry,
  loadManifestFromDir,
  mapManagerError,
  mapFsError,
  type ExtensionCommandError,
} from './common.ts'
import { addExtension } from '../../extensions/registry.ts'
import type { Registry } from '../../extensions/registry.ts'
import type { Manifest } from '../../extensions/manifest.ts'
import { checkCompatibility, checkNotInstalled, buildRegistryEntry, renderCommandForAgent, extensionDir } from '../../extensions/manager.ts'
import { AGENT_FORMATS } from '../../extensions/registrar.ts'
import { mkdir, copyFile } from '../../utils/fs.ts'
import { readdir, readFile, writeFile as nodeWriteFile, mkdir as nodeMkdir } from 'node:fs/promises'

// --- Types ---

const CLI_VERSION = '0.1.0'

export interface ExtensionAddOptions {
  readonly cwd: string
  readonly source: string
  readonly ai?: string
}

export interface ExtensionAddResult {
  readonly id: string
  readonly version: string
  readonly filesCreated: number
}

// --- Immutable accumulator ---

interface AddContext {
  readonly opts: ExtensionAddOptions
  readonly registry: Registry
  readonly manifest: Manifest
  readonly filesCreated: number
}

// --- Pipeline steps ---

const loadContext = (opts: ExtensionAddOptions): ResultAsync<AddContext, ExtensionCommandError> =>
  checkFaberProject(opts.cwd)
    .andThen(() => loadRegistry(opts.cwd))
    .andThen((registry) =>
      loadManifestFromDir(opts.source)
        .map((manifest) => ({ opts, registry, manifest, filesCreated: 0 })),
    )

const validateGuards = (ctx: AddContext): ResultAsync<AddContext, ExtensionCommandError> => {
  const result = checkCompatibility(CLI_VERSION, ctx.manifest.requires.faberVersion)
    .mapErr(mapManagerError)
    .andThen(() => checkNotInstalled(ctx.registry, ctx.manifest.extension.id).mapErr(mapManagerError))
    .map(() => ctx)
  return result.isOk() ? okAsync(result.value) : errAsync(result.error)
}

const persistRegistry = (ctx: AddContext): ResultAsync<AddContext, ExtensionCommandError> => {
  const entry = buildRegistryEntry(ctx.manifest, ctx.opts.source)
  const updated = addExtension(ctx.registry, ctx.manifest.extension.id, entry)
  return saveRegistry(ctx.opts.cwd, updated).map(() => ctx)
}

const copyFiles = (ctx: AddContext): ResultAsync<AddContext, ExtensionCommandError> => {
  const destDir = extensionDir(ctx.opts.cwd, ctx.manifest.extension.id)
  return ResultAsync.fromPromise(
    (async () => {
      const mkResult = await mkdir(destDir)
      if (mkResult.isErr()) throw mkResult.error
      const entries = await readdir(ctx.opts.source, { withFileTypes: true })
      const files = entries.filter((e) => e.isFile())
      const results = await Promise.all(
        files.map(async (entry) => {
          const r = await copyFile(join(ctx.opts.source, entry.name), join(destDir, entry.name))
          if (r.isErr()) throw r.error
        }),
      )
      return results.length
    })(),
    (e): ExtensionCommandError =>
      typeof e === 'object' && e !== null && 'tag' in e
        ? mapFsError(e as import('../../utils/fs.ts').FsError)
        : { tag: 'fs', path: ctx.opts.source, message: e instanceof Error ? e.message : String(e) },
  ).map((copied) => ({ ...ctx, filesCreated: copied }))
}

const renderSingleCommand = async (
  cmd: { readonly file: string; readonly name: string },
  ctx: AddContext,
  format: ReturnType<typeof AGENT_FORMATS.get> & object,
): Promise<boolean> => {
  try {
    const cmdSource = await readFile(join(ctx.opts.source, cmd.file), 'utf-8')
    const rendered = renderCommandForAgent(cmdSource, ctx.opts.ai!, format, cmd.name)
    await nodeMkdir(join(ctx.opts.cwd, format.dir), { recursive: true })
    await nodeWriteFile(join(ctx.opts.cwd, rendered.relativePath), rendered.content)
    return true
  } catch {
    return false // Non-fatal
  }
}

const renderAgentCommands = (ctx: AddContext): ResultAsync<AddContext, ExtensionCommandError> => {
  if (!ctx.opts.ai) return ResultAsync.fromSafePromise(Promise.resolve(ctx))

  const format = AGENT_FORMATS.get(ctx.opts.ai)
  if (!format) return ResultAsync.fromSafePromise(Promise.resolve(ctx))

  return ResultAsync.fromSafePromise(
    Promise.all(ctx.manifest.provides.commands.map((cmd) => renderSingleCommand(cmd, ctx, format)))
      .then((results) => ({
        ...ctx,
        filesCreated: ctx.filesCreated + results.filter(Boolean).length,
      })),
  )
}

const toResult = (ctx: AddContext): ExtensionAddResult => ({
  id: ctx.manifest.extension.id,
  version: ctx.manifest.extension.version,
  filesCreated: ctx.filesCreated,
})

// --- Orchestrator: pure .andThen() pipeline ---

export const runExtensionAdd = (
  opts: ExtensionAddOptions,
): ResultAsync<ExtensionAddResult, ExtensionCommandError> =>
  loadContext(opts)
    .andThen(validateGuards)
    .andThen(persistRegistry)
    .andThen(copyFiles)
    .andThen(renderAgentCommands)
    .map(toResult)
