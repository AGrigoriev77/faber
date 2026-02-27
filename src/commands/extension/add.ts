import { join } from 'node:path'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
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

// --- Internal helpers ---

const copyExtensionFiles = async (
  source: string,
  destDir: string,
): Promise<Result<number, ExtensionCommandError>> => {
  const mkdirResult = await mkdir(destDir)
  if (mkdirResult.isErr()) return err(mapFsError(mkdirResult.error))

  try {
    const entries = await readdir(source, { withFileTypes: true })
    let copied = 0
    for (const entry of entries) {
      if (entry.isFile()) {
        const cpResult = await copyFile(join(source, entry.name), join(destDir, entry.name))
        if (cpResult.isErr()) return err(mapFsError(cpResult.error))
        copied++
      }
    }
    return ok(copied)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'fs', path: source, message })
  }
}

// --- Orchestrator ---

export const runExtensionAdd = async (
  opts: ExtensionAddOptions,
): Promise<Result<ExtensionAddResult, ExtensionCommandError>> => {
  // 1. Check faber project
  const projectResult = await checkFaberProject(opts.cwd)
  if (projectResult.isErr()) return err(projectResult.error)

  // 2. Load registry
  const registryResult = await loadRegistry(opts.cwd)
  if (registryResult.isErr()) return err(registryResult.error)

  // 3. Load manifest from source
  const manifestResult = await loadManifestFromDir(opts.source)
  if (manifestResult.isErr()) return err(manifestResult.error)

  const manifest = manifestResult.value
  const id = manifest.extension.id

  // 4. Check compatibility
  const compatResult = checkCompatibility(CLI_VERSION, manifest.requires.faberVersion)
  if (compatResult.isErr()) return err(mapManagerError(compatResult.error))

  // 5. Check not already installed
  const notInstalledResult = checkNotInstalled(registryResult.value, id)
  if (notInstalledResult.isErr()) return err(mapManagerError(notInstalledResult.error))

  // 6. Build registry entry and update registry
  const entry = buildRegistryEntry(manifest, opts.source)
  const updatedRegistry = addExtension(registryResult.value, id, entry)

  // 7. Save registry
  const saveResult = await saveRegistry(opts.cwd, updatedRegistry)
  if (saveResult.isErr()) return err(saveResult.error)

  // 8. Copy extension files
  const destDir = extensionDir(opts.cwd, id)
  const copyResult = await copyExtensionFiles(opts.source, destDir)
  if (copyResult.isErr()) return err(copyResult.error)

  let totalFiles = copyResult.value

  // 9. Render commands for agent (if --ai specified)
  if (opts.ai) {
    const format = AGENT_FORMATS.get(opts.ai)
    if (format) {
      for (const cmd of manifest.provides.commands) {
        try {
          const cmdSource = await readFile(join(opts.source, cmd.file), 'utf-8')
          const rendered = renderCommandForAgent(cmdSource, opts.ai, format, cmd.name)
          const targetPath = join(opts.cwd, rendered.relativePath)
          await nodeMkdir(join(opts.cwd, format.dir), { recursive: true })
          await nodeWriteFile(targetPath, rendered.content)
          totalFiles++
        } catch {
          // Skip command rendering errors — non-fatal
        }
      }
    }
  }

  return ok({
    id,
    version: manifest.extension.version,
    filesCreated: totalFiles,
  })
}
