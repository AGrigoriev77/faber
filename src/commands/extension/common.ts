import { join } from 'node:path'
import { ok, err } from 'neverthrow'
import type { ResultAsync } from 'neverthrow'
import { readFile, writeFile, exists, mkdir } from '../../utils/fs.ts'
import type { FsError } from '../../utils/fs.ts'
import { parseRegistry, serializeRegistry, emptyRegistry } from '../../extensions/registry.ts'
import type { Registry } from '../../extensions/registry.ts'
import { parseManifest, validateManifest } from '../../extensions/manifest.ts'
import type { Manifest, ManifestError } from '../../extensions/manifest.ts'
import type { CatalogError } from '../../extensions/catalog.ts'
import type { ManagerError } from '../../extensions/manager.ts'
import { assertNever } from '../../fp/types.ts'

// --- Discriminated union for all extension command errors ---

export type ExtensionCommandError =
  | { readonly tag: 'not_a_project'; readonly path: string }
  | { readonly tag: 'registry_io'; readonly path: string; readonly message: string }
  | { readonly tag: 'catalog_io'; readonly message: string }
  | { readonly tag: 'manifest_io'; readonly path: string; readonly message: string }
  | { readonly tag: 'validation'; readonly field: string; readonly message: string }
  | { readonly tag: 'compatibility'; readonly required: string; readonly actual: string }
  | { readonly tag: 'already_installed'; readonly id: string }
  | { readonly tag: 'not_installed'; readonly id: string }
  | { readonly tag: 'not_found'; readonly id: string }
  | { readonly tag: 'network'; readonly message: string }
  | { readonly tag: 'fs'; readonly path: string; readonly message: string }

// --- Path constants ---

const FABER_DIR = '.faber'
const REGISTRY_FILE = '.registry'
const EXTENSIONS_DIR = 'extensions'
const MANIFEST_FILE = 'extension.yml'

export const faberDir = (cwd: string): string => join(cwd, FABER_DIR)
export const registryPath = (cwd: string): string => join(cwd, FABER_DIR, EXTENSIONS_DIR, REGISTRY_FILE)
export const extensionsDir = (cwd: string): string => join(cwd, FABER_DIR, EXTENSIONS_DIR)
export const manifestPath = (dir: string): string => join(dir, MANIFEST_FILE)

// --- Project check ---

const fsErrorMessage = (e: FsError): string => {
  switch (e.tag) {
    case 'not_found': return `File not found: ${e.path}`
    case 'permission': return e.message
    case 'parse': return e.message
    case 'io': return e.message
    default: return assertNever(e)
  }
}

export const checkFaberProject = async (cwd: string): Promise<ResultAsync<string, ExtensionCommandError>> => {
  const result = await exists(faberDir(cwd))
  if (result.isErr()) {
    return err({ tag: 'fs', path: cwd, message: fsErrorMessage(result.error) })
  }
  return result.value
    ? ok(cwd)
    : err({ tag: 'not_a_project', path: cwd })
}

// --- Registry I/O ---

export const loadRegistry = async (cwd: string): Promise<ResultAsync<Registry, ExtensionCommandError>> => {
  const regPath = registryPath(cwd)
  const fileResult = await readFile(regPath)

  if (fileResult.isErr()) {
    if (fileResult.error.tag === 'not_found') {
      return ok(emptyRegistry())
    }
    return err({ tag: 'registry_io', path: regPath, message: fsErrorMessage(fileResult.error) })
  }

  const parsed = parseRegistry(fileResult.value)
  // parseRegistry always returns ok
  return ok(parsed._unsafeUnwrap())
}

export const saveRegistry = async (cwd: string, registry: Registry): Promise<ResultAsync<void, ExtensionCommandError>> => {
  const extDir = extensionsDir(cwd)
  const mkdirResult = await mkdir(extDir)
  if (mkdirResult.isErr()) {
    return err({ tag: 'fs', path: extDir, message: fsErrorMessage(mkdirResult.error) })
  }

  const regPath = registryPath(cwd)
  const content = serializeRegistry(registry)
  const writeResult = await writeFile(regPath, content)

  if (writeResult.isErr()) {
    return err({ tag: 'registry_io', path: regPath, message: fsErrorMessage(writeResult.error) })
  }

  return ok(undefined)
}

// --- Manifest I/O ---

export const loadManifestFromDir = async (dir: string): Promise<ResultAsync<Manifest, ExtensionCommandError>> => {
  const mPath = manifestPath(dir)
  const fileResult = await readFile(mPath)

  if (fileResult.isErr()) {
    return err({ tag: 'manifest_io', path: mPath, message: fsErrorMessage(fileResult.error) })
  }

  const parsed = parseManifest(fileResult.value)
  if (parsed.isErr()) {
    return err(mapManifestError(parsed.error))
  }

  const validated = validateManifest(parsed.value)
  if (validated.isErr()) {
    return err(mapManifestError(validated.error))
  }

  return ok(validated.value)
}

// --- Error mappers ---

export const mapManifestError = (e: ManifestError): ExtensionCommandError => {
  switch (e.tag) {
    case 'yaml_parse':
      return { tag: 'validation', field: 'manifest', message: e.message }
    case 'validation':
      return { tag: 'validation', field: e.field, message: e.message }
    default:
      return assertNever(e)
  }
}

export const mapCatalogError = (e: CatalogError): ExtensionCommandError => {
  switch (e.tag) {
    case 'invalid_url':
      return { tag: 'network', message: `Invalid catalog URL: ${e.url} — ${e.message}` }
    case 'not_found':
      return { tag: 'not_found', id: e.id }
    case 'network':
      return { tag: 'network', message: e.message }
    case 'parse':
      return { tag: 'catalog_io', message: e.message }
    default:
      return assertNever(e)
  }
}

export const mapManagerError = (e: ManagerError): ExtensionCommandError => {
  switch (e.tag) {
    case 'compatibility':
      return { tag: 'compatibility', required: e.required, actual: e.actual }
    case 'already_installed':
      return { tag: 'already_installed', id: e.id }
    case 'not_installed':
      return { tag: 'not_installed', id: e.id }
    default:
      return assertNever(e)
  }
}

export const mapFsError = (e: FsError): ExtensionCommandError => {
  switch (e.tag) {
    case 'not_found':
      return { tag: 'fs', path: e.path, message: 'File not found' }
    case 'permission':
      return { tag: 'fs', path: e.path, message: e.message }
    case 'parse':
      return { tag: 'fs', path: e.path, message: e.message }
    case 'io':
      return { tag: 'fs', path: e.path, message: e.message }
    default:
      return assertNever(e)
  }
}

// --- Error formatting ---

export const formatCommandError = (e: ExtensionCommandError): string => {
  switch (e.tag) {
    case 'not_a_project':
      return `Not a faber project: ${e.path}\nRun 'faber init' to create one.`
    case 'registry_io':
      return `Registry error at ${e.path}: ${e.message}`
    case 'catalog_io':
      return `Catalog error: ${e.message}`
    case 'manifest_io':
      return `Manifest error at ${e.path}: ${e.message}`
    case 'validation':
      return `Validation error [${e.field}]: ${e.message}`
    case 'compatibility':
      return `Incompatible: requires faber ${e.required}, current is ${e.actual}`
    case 'already_installed':
      return `Extension "${e.id}" is already installed`
    case 'not_installed':
      return `Extension "${e.id}" is not installed`
    case 'not_found':
      return `Extension "${e.id}" not found in catalog`
    case 'network':
      return `Network error: ${e.message}`
    case 'fs':
      return `File system error at ${e.path}: ${e.message}`
    default:
      return assertNever(e)
  }
}
