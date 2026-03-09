import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { unlink } from 'node:fs/promises'
import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import { fetchLatestRelease } from '../core/github.ts'
import type { ApiError } from '../core/github.ts'
import { downloadAsset, extractZip } from '../core/templates.ts'
import type { TemplateError } from '../core/templates.ts'
import { assertNever } from '../fp/types.ts'

// --- Types ---

export interface UpgradeOptions {
  readonly projectPath: string
  readonly githubToken?: string
  readonly localTemplatesZip?: string  // bypass GitHub download (for testing/dev)
}

export interface UpgradeResult {
  readonly filesUpdated: number
  readonly release: string
}

export type UpgradeError =
  | { readonly tag: 'download'; readonly message: string }
  | { readonly tag: 'fs'; readonly message: string }

// --- Error mapping ---

const apiErrToUpgrade = (e: ApiError): UpgradeError => {
  switch (e.tag) {
    case 'http': return { tag: 'download', message: `HTTP ${e.status}: ${e.message}` }
    case 'network': return { tag: 'download', message: e.message }
    case 'parse': return { tag: 'download', message: `Parse error: ${e.message}` }
    case 'asset_not_found': return { tag: 'download', message: `Asset not found: ${e.agent}` }
    default: return assertNever(e)
  }
}

const templateErrToUpgrade = (e: TemplateError): UpgradeError => {
  switch (e.tag) {
    case 'api': return apiErrToUpgrade(e.inner)
    case 'fs': return { tag: 'fs', message: e.inner.tag === 'not_found' ? `File not found: ${e.inner.path}` : e.inner.message }
    case 'zip': return { tag: 'download', message: e.message }
    case 'merge': return { tag: 'download', message: e.message }
    default: return assertNever(e)
  }
}

// --- Core logic ---

export const runUpgrade = (opts: UpgradeOptions): ResultAsync<UpgradeResult, UpgradeError> => {
  const faberDir = join(opts.projectPath, '.faber')

  if (opts.localTemplatesZip) {
    return new ResultAsync(
      extractZip(opts.localTemplatesZip, faberDir).then((r) => r.mapErr(templateErrToUpgrade)),
    ).map((files) => ({ filesUpdated: files.length, release: 'local' }))
  }

  const tmpZip = join(tmpdir(), `faber-upgrade-${Date.now()}.zip`)
  const token = opts.githubToken ?? process.env['GH_TOKEN'] ?? process.env['GITHUB_TOKEN']

  return new ResultAsync(
    fetchLatestRelease({ fetch: globalThis.fetch, token }).then((r) => r.mapErr(apiErrToUpgrade)),
  )
    .andThen((release) => {
      const asset = release.assets.find((a) => a.name === 'faber-templates.zip')
      return asset
        ? okAsync({ url: asset.browserDownloadUrl, tag: release.tagName })
        : errAsync<{ url: string; tag: string }, UpgradeError>(
            { tag: 'download', message: 'faber-templates.zip not found in latest release' },
          )
    })
    .andThen(({ url, tag }) =>
      new ResultAsync(
        downloadAsset(url, tmpZip, globalThis.fetch, token).then((r) => r.mapErr(templateErrToUpgrade)),
      ).map(() => tag),
    )
    .andThen((tag) =>
      new ResultAsync(
        extractZip(tmpZip, faberDir).then((r) => r.mapErr(templateErrToUpgrade)),
      ).map((files) => ({ filesUpdated: files.length, release: tag })),
    )
    .map((result) => {
      unlink(tmpZip).catch(() => undefined)
      return result
    })
}
