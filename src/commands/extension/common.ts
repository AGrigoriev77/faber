import { join } from 'node:path'
import { ok, err, okAsync, errAsync, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
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

// --- fs.ts adapter ---
// Converts Promise<Result<T, FsError>> → ResultAsync<T, ExtensionCommandError>

export const wrapFs = <T>(
  op: Promise<Result<T, FsError>>,
  mapErr: (e: FsError) => ExtensionCommandError,
): ResultAsync<T, ExtensionCommandError> =>
  ResultAsync.fromPromise(
    op.then((r) =>
      r.match(
        (value) => value,
        (error) => { throw error },
      ),
    ),
    (e) => mapErr(e as FsError),
  )

// Wrap sync Result<T, E> → ResultAsync<T, E>
const liftResult = <T, E>(r: Result<T, E>): ResultAsync<T, E> =>
  r.match(
    (value): ResultAsync<T, E> => okAsync(value),
    (error): ResultAsync<T, E> => errAsync(error),
  )

// --- FsError → message ---

const fsErrorMessage = (e: FsError): string => {
  switch (e.tag) {
    case 'not_found': return `File not found: ${e.path}`
    case 'permission': return e.message
    case 'parse': return e.message
    case 'io': return e.message
    default: return assertNever(e)
  }
}

// --- Project check ---

export const checkFaberProject = (cwd: string): ResultAsync<string, ExtensionCommandError> =>
  wrapFs<boolean>(
    exists(faberDir(cwd)),
    (e) => ({ tag: 'fs', path: cwd, message: fsErrorMessage(e) }),
  ).andThen((found) =>
    found ? okAsync(cwd) : errAsync({ tag: 'not_a_project' as const, path: cwd }),
  )

// --- Registry I/O ---

export const loadRegistry = (cwd: string): ResultAsync<Registry, ExtensionCommandError> => {
  const regPath = registryPath(cwd)
  return wrapFs<string>(
    readFile(regPath),
    (e) =>
      e.tag === 'not_found'
        ? { tag: 'not_found' as const, id: regPath }
        : { tag: 'registry_io' as const, path: regPath, message: fsErrorMessage(e) },
  )
    .andThen((content) => liftResult(parseRegistry(content)))
    .orElse((e) =>
      e.tag === 'not_found' ? ok(emptyRegistry()) : err(e),
    )
}

export const saveRegistry = (cwd: string, registry: Registry): ResultAsync<void, ExtensionCommandError> => {
  const extDir = extensionsDir(cwd)
  const regPath = registryPath(cwd)
  return wrapFs<void>(
    mkdir(extDir),
    (e) => ({ tag: 'fs', path: extDir, message: fsErrorMessage(e) }),
  ).andThen(() =>
    wrapFs<void>(
      writeFile(regPath, serializeRegistry(registry)),
      (e) => ({ tag: 'registry_io', path: regPath, message: fsErrorMessage(e) }),
    ),
  )
}

// --- Manifest I/O ---

export const loadManifestFromDir = (dir: string): ResultAsync<Manifest, ExtensionCommandError> => {
  const mPath = manifestPath(dir)
  return wrapFs<string>(
    readFile(mPath),
    (e) => ({ tag: 'manifest_io', path: mPath, message: fsErrorMessage(e) }),
  ).andThen((content) =>
    liftResult(
      parseManifest(content)
        .andThen(validateManifest)
        .mapErr(mapManifestError),
    ),
  )
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
