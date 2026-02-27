import { errAsync, ResultAsync } from 'neverthrow'
import {
  checkFaberProject,
  loadRegistry,
  saveRegistry,
  mapManagerError,
  type ExtensionCommandError,
} from './common.ts'
import type { Registry } from '../../extensions/registry.ts'
import { removeExtension } from '../../extensions/registry.ts'
import { checkIsInstalled, extensionDir } from '../../extensions/manager.ts'
import { rm } from 'node:fs/promises'

// --- Types ---

export interface ExtensionRemoveOptions {
  readonly cwd: string
  readonly id: string
  readonly keepConfig?: boolean
}

export interface ExtensionRemoveResult {
  readonly id: string
  readonly version: string
}

// --- Immutable accumulator ---

interface RemoveContext {
  readonly opts: ExtensionRemoveOptions
  readonly registry: Registry
  readonly version: string
}

// --- Pipeline steps ---

const loadContext = (opts: ExtensionRemoveOptions): ResultAsync<RemoveContext, ExtensionCommandError> =>
  checkFaberProject(opts.cwd)
    .andThen(() => loadRegistry(opts.cwd))
    .andThen((registry) =>
      checkIsInstalled(registry, opts.id)
        .mapErr(mapManagerError)
        .map((entry) => ({ opts, registry, version: entry.version })),
    )

const persistRemoval = (ctx: RemoveContext): ResultAsync<RemoveContext, ExtensionCommandError> =>
  removeExtension(ctx.registry, ctx.opts.id)
    .mapErr((): ExtensionCommandError => ({ tag: 'not_installed', id: ctx.opts.id }))
    .match(
      (updated) => saveRegistry(ctx.opts.cwd, updated).map(() => ctx),
      (e) => errAsync(e),
    )

const cleanupFiles = (ctx: RemoveContext): ResultAsync<RemoveContext, ExtensionCommandError> => {
  if (ctx.opts.keepConfig) return ResultAsync.fromSafePromise(Promise.resolve(ctx))

  return ResultAsync.fromSafePromise(
    rm(extensionDir(ctx.opts.cwd, ctx.opts.id), { recursive: true, force: true })
      .catch(() => undefined) // Non-fatal
      .then(() => ctx),
  )
}

const toResult = (ctx: RemoveContext): ExtensionRemoveResult => ({
  id: ctx.opts.id,
  version: ctx.version,
})

// --- Orchestrator: pure .andThen() pipeline ---

export const runExtensionRemove = (
  opts: ExtensionRemoveOptions,
): ResultAsync<ExtensionRemoveResult, ExtensionCommandError> =>
  loadContext(opts)
    .andThen(persistRemoval)
    .andThen(cleanupFiles)
    .map(toResult)
