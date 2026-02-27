import type { Result } from 'neverthrow'
import { mapCatalogError, type ExtensionCommandError } from './common.ts'
import { getExtensionInfo } from '../../extensions/catalog.ts'
import type { Catalog, SearchResult } from '../../extensions/catalog.ts'
import type { Registry } from '../../extensions/registry.ts'
import { isInstalled } from '../../extensions/registry.ts'

// --- Types ---

export interface ExtensionInfoOptions {
  readonly catalog: Catalog
  readonly registry: Registry
  readonly id: string
}

export interface ExtensionInfoResult {
  readonly info: SearchResult
  readonly installed: boolean
  readonly formatted: string
}

// --- Pure formatting ---

export const formatExtensionInfo = (info: SearchResult, installed: boolean): string => {
  const lines = [
    `Name:        ${info.name}`,
    `ID:          ${info.id}`,
    `Version:     ${info.version}`,
    `Author:      ${info.author}`,
    `Description: ${info.description}`,
    `Tags:        ${info.tags.join(', ') || 'none'}`,
    `Verified:    ${info.verified ? 'Yes' : 'No'}`,
    `Installed:   ${installed ? 'Yes' : 'No'}`,
  ]
  return lines.join('\n')
}

// --- Pipeline ---

export const runExtensionInfo = (
  opts: ExtensionInfoOptions,
): Result<ExtensionInfoResult, ExtensionCommandError> =>
  getExtensionInfo(opts.catalog, opts.id)
    .mapErr(mapCatalogError)
    .map((info) => {
      const installed = isInstalled(opts.registry, opts.id)
      return { info, installed, formatted: formatExtensionInfo(info, installed) }
    })
