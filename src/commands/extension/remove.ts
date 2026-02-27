import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import {
  checkFaberProject,
  loadRegistry,
  saveRegistry,
  mapManagerError,
  type ExtensionCommandError,
} from './common.ts'
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

// --- Pipeline ---

export const runExtensionRemove = async (
  opts: ExtensionRemoveOptions,
): Promise<Result<ExtensionRemoveResult, ExtensionCommandError>> => {
  // 1. Check faber project
  const projectResult = await checkFaberProject(opts.cwd)
  if (projectResult.isErr()) return err(projectResult.error)

  // 2. Load registry
  const registryResult = await loadRegistry(opts.cwd)
  if (registryResult.isErr()) return err(registryResult.error)

  // 3. Check is installed
  const installedResult = checkIsInstalled(registryResult.value, opts.id)
  if (installedResult.isErr()) return err(mapManagerError(installedResult.error))

  const entryVersion = installedResult.value.version

  // 4. Remove from registry
  const removeResult = removeExtension(registryResult.value, opts.id)
  if (removeResult.isErr()) {
    return err({ tag: 'not_installed' as const, id: opts.id })
  }

  // 5. Save updated registry
  const saveResult = await saveRegistry(opts.cwd, removeResult.value)
  if (saveResult.isErr()) return err(saveResult.error)

  // 6. Delete extension files (unless --keep-config)
  if (!opts.keepConfig) {
    const dir = extensionDir(opts.cwd, opts.id)
    try {
      await rm(dir, { recursive: true, force: true })
    } catch {
      // Non-fatal — files may not exist
    }
  }

  return ok({
    id: opts.id,
    version: entryVersion,
  })
}
