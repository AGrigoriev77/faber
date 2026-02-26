import { parse as parseYaml } from 'yaml'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

const SCHEMA_VERSION = '1.0'
const EXTENSION_ID_RE = /^[a-z0-9-]+$/
const SEMVER_RE = /^\d+\.\d+\.\d+$/
const COMMAND_NAME_RE = /^speckit\.[a-z0-9-]+\.[a-z0-9-]+$/

export interface ManifestCommand {
  readonly name: string
  readonly file: string
}

export interface Manifest {
  readonly schemaVersion: string
  readonly extension: {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
  }
  readonly requires: {
    readonly speckitVersion: string
  }
  readonly provides: {
    readonly commands: ReadonlyArray<ManifestCommand>
  }
  readonly hooks: Readonly<Record<string, unknown>>
}

export type ManifestError =
  | { readonly tag: 'yaml_parse'; readonly message: string }
  | { readonly tag: 'validation'; readonly field: string; readonly message: string }

type RawData = Record<string, unknown>

const fieldErr = (field: string, message: string): ManifestError =>
  ({ tag: 'validation', field, message })

export const parseManifest = (yaml: string): Result<RawData, ManifestError> => {
  try {
    const data = parseYaml(yaml)
    if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
      return err({ tag: 'yaml_parse', message: 'YAML must parse to an object' })
    }
    return ok(data as RawData)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'yaml_parse', message })
  }
}

export const validateManifest = (data: RawData): Result<Manifest, ManifestError> => {
  // schema_version
  const schemaVersion = data['schema_version']
  if (schemaVersion === undefined || schemaVersion === null) {
    return err(fieldErr('schema_version', 'Missing required field'))
  }
  if (schemaVersion !== SCHEMA_VERSION) {
    return err(fieldErr('schema_version', `Unsupported version: ${schemaVersion} (expected ${SCHEMA_VERSION})`))
  }

  // extension
  const ext = data['extension'] as RawData | undefined
  if (!ext || typeof ext !== 'object') {
    return err(fieldErr('extension', 'Missing required field'))
  }

  const extId = ext['id'] as string | undefined
  if (!extId) {
    return err(fieldErr('extension.id', 'Missing required field'))
  }
  if (!EXTENSION_ID_RE.test(extId)) {
    return err(fieldErr('extension.id', `Invalid format: "${extId}". Must match /^[a-z0-9-]+$/`))
  }

  const extName = ext['name'] as string | undefined
  if (!extName) {
    return err(fieldErr('extension.name', 'Missing required field'))
  }

  const extVersion = ext['version'] as string | undefined
  if (!extVersion || !SEMVER_RE.test(extVersion)) {
    return err(fieldErr('extension.version', `Invalid version: "${extVersion}"`))
  }

  const extDescription = ext['description'] as string | undefined
  if (!extDescription) {
    return err(fieldErr('extension.description', 'Missing required field'))
  }

  // requires
  const requires = data['requires'] as RawData | undefined
  if (!requires || typeof requires !== 'object') {
    return err(fieldErr('requires', 'Missing required field'))
  }
  const speckitVersion = requires['speckit_version'] as string | undefined
  if (!speckitVersion) {
    return err(fieldErr('requires.speckit_version', 'Missing required field'))
  }

  // provides
  const provides = data['provides'] as RawData | undefined
  if (!provides || typeof provides !== 'object') {
    return err(fieldErr('provides', 'Missing required field'))
  }

  const commands = provides['commands'] as ReadonlyArray<RawData> | undefined
  if (!commands || !Array.isArray(commands) || commands.length === 0) {
    return err(fieldErr('provides.commands', 'Must provide at least one command'))
  }

  const validatedCommands: ManifestCommand[] = []
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]!
    const cmdName = cmd['name'] as string | undefined
    const cmdFile = cmd['file'] as string | undefined

    if (!cmdName) {
      return err(fieldErr(`commands[${i}].name`, 'Missing required field'))
    }
    if (!cmdFile) {
      return err(fieldErr(`commands[${i}].file`, 'Missing required field'))
    }
    if (!COMMAND_NAME_RE.test(cmdName)) {
      return err(fieldErr(`commands[${i}].name`, `Invalid format: "${cmdName}". Must match speckit.{ext}.{cmd}`))
    }
    validatedCommands.push({ name: cmdName, file: cmdFile })
  }

  const hooks = (data['hooks'] ?? {}) as Record<string, unknown>

  return ok({
    schemaVersion: SCHEMA_VERSION,
    extension: {
      id: extId,
      name: extName,
      version: extVersion,
      description: extDescription,
    },
    requires: {
      speckitVersion,
    },
    provides: {
      commands: validatedCommands,
    },
    hooks,
  })
}
