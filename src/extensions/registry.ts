import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

const SCHEMA_VERSION = '1.0'

export interface ExtensionEntry {
  readonly version: string
  readonly source: string
  readonly installedAt: string
}

export interface Registry {
  readonly schemaVersion: string
  readonly extensions: Readonly<Record<string, ExtensionEntry>>
}

export type RegistryError =
  | { readonly tag: 'not_found'; readonly id: string }

export const emptyRegistry = (): Registry => ({
  schemaVersion: SCHEMA_VERSION,
  extensions: {},
})

export const addExtension = (
  registry: Registry,
  id: string,
  entry: ExtensionEntry,
): Registry => ({
  ...registry,
  extensions: { ...registry.extensions, [id]: entry },
})

export const removeExtension = (
  registry: Registry,
  id: string,
): Result<Registry, RegistryError> => {
  if (!(id in registry.extensions)) {
    return err({ tag: 'not_found', id })
  }
  const { [id]: _, ...rest } = registry.extensions
  return ok({ ...registry, extensions: rest })
}

export const getExtension = (
  registry: Registry,
  id: string,
): Result<ExtensionEntry, RegistryError> => {
  const entry = registry.extensions[id]
  return entry ? ok(entry) : err({ tag: 'not_found', id })
}

export const listExtensions = (
  registry: Registry,
): ReadonlyArray<readonly [string, ExtensionEntry]> =>
  Object.entries(registry.extensions)

export const isInstalled = (registry: Registry, id: string): boolean =>
  id in registry.extensions

export const parseRegistry = (json: string): Result<Registry, never> => {
  try {
    const data = JSON.parse(json)
    const extensions: Record<string, ExtensionEntry> = {}

    if (data?.extensions && typeof data.extensions === 'object') {
      for (const [id, raw] of Object.entries(data.extensions)) {
        const e = raw as Record<string, unknown>
        extensions[id] = {
          version: (e['version'] ?? '') as string,
          source: (e['source'] ?? '') as string,
          installedAt: (e['installed_at'] ?? e['installedAt'] ?? '') as string,
        }
      }
    }

    return ok({
      schemaVersion: (data?.['schema_version'] ?? data?.['schemaVersion'] ?? SCHEMA_VERSION) as string,
      extensions,
    })
  } catch {
    return ok(emptyRegistry())
  }
}

export const serializeRegistry = (registry: Registry): string => {
  const extensions: Record<string, Record<string, string>> = {}
  for (const [id, entry] of Object.entries(registry.extensions)) {
    extensions[id] = {
      version: entry.version,
      source: entry.source,
      installed_at: entry.installedAt,
    }
  }
  return JSON.stringify(
    { schema_version: registry.schemaVersion, extensions },
    null,
    2,
  ) + '\n'
}
