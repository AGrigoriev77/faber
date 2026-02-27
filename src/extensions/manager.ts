import { join } from 'node:path'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { Manifest } from './manifest.ts'
import type { Registry, ExtensionEntry } from './registry.ts'
import { isInstalled, getExtension } from './registry.ts'
import type { AgentFormat } from './registrar.ts'
import {
  parseFrontmatter,
  renderMarkdownCommand,
  renderTomlCommand,
  convertArgPlaceholder,
  adjustScriptPaths,
} from './registrar.ts'

// --- Types ---

export type ManagerError =
  | { readonly tag: 'compatibility'; readonly required: string; readonly actual: string }
  | { readonly tag: 'already_installed'; readonly id: string }
  | { readonly tag: 'not_installed'; readonly id: string }

export interface CommandFile {
  readonly agentName: string
  readonly relativePath: string
  readonly content: string
}

// --- Semver comparison ---

export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  return [0, 1, 2].reduce((result, i) =>
    result !== 0 ? result : (pa[i] ?? 0) - (pb[i] ?? 0), 0)
}

// Ordered by prefix length (2-char before 1-char) so ">=" matches before ">"
const CONSTRAINT_OPS: ReadonlyArray<readonly [string, (cmp: number) => boolean]> = [
  ['>=', (cmp) => cmp >= 0],
  ['<=', (cmp) => cmp <= 0],
  ['!=', (cmp) => cmp !== 0],
  ['==', (cmp) => cmp === 0],
  ['>',  (cmp) => cmp > 0],
  ['<',  (cmp) => cmp < 0],
]

const satisfiesConstraint = (version: string, constraint: string): boolean => {
  const trimmed = constraint.trim()
  const match = CONSTRAINT_OPS.find(([prefix]) => trimmed.startsWith(prefix))
  return match
    ? match[1](compareVersions(version, trimmed.slice(match[0].length)))
    : compareVersions(version, trimmed) === 0
}

// --- Guards ---

export const checkCompatibility = (actual: string, specifier: string): Result<void, ManagerError> => {
  const constraints = specifier.split(',').map((s) => s.trim())
  const satisfied = constraints.every((c) => satisfiesConstraint(actual, c))
  return satisfied
    ? ok(undefined)
    : err({ tag: 'compatibility', required: specifier, actual })
}

export const checkNotInstalled = (registry: Registry, id: string): Result<void, ManagerError> =>
  isInstalled(registry, id)
    ? err({ tag: 'already_installed', id })
    : ok(undefined)

export const checkIsInstalled = (registry: Registry, id: string): Result<ExtensionEntry, ManagerError> =>
  getExtension(registry, id)
    .mapErr((): ManagerError => ({ tag: 'not_installed', id }))

// --- Builders ---

export const buildRegistryEntry = (manifest: Manifest, source: string): ExtensionEntry => ({
  version: manifest.extension.version,
  source,
  installedAt: new Date().toISOString(),
})

const CANONICAL_ARG_PLACEHOLDER = '$ARGUMENTS'

export const renderCommandForAgent = (
  sourceContent: string,
  agentName: string,
  agentFormat: AgentFormat,
  extensionId: string,
): CommandFile => {
  const [rawFm, rawBody] = parseFrontmatter(sourceContent)
  const fm = adjustScriptPaths(rawFm)

  const body = agentFormat.args !== CANONICAL_ARG_PLACEHOLDER
    ? convertArgPlaceholder(rawBody, CANONICAL_ARG_PLACEHOLDER, agentFormat.args)
    : rawBody

  const content = agentFormat.format === 'toml'
    ? renderTomlCommand(fm, body, extensionId)
    : renderMarkdownCommand(fm, body, extensionId)

  const relativePath = join(agentFormat.dir, `${extensionId}${agentFormat.extension}`)

  return { agentName, relativePath, content }
}

// --- Path helpers ---

export const extensionDir = (projectRoot: string, extensionId: string): string =>
  join(projectRoot, '.faber', 'extensions', extensionId)

export const commandTargetPath = (projectRoot: string, agentFormat: AgentFormat, commandName: string): string =>
  join(projectRoot, agentFormat.dir, `${commandName}${agentFormat.extension}`)
