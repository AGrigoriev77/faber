import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

export interface ReleaseAsset {
  readonly name: string
  readonly browserDownloadUrl: string
  readonly size: number
}

export interface Release {
  readonly tagName: string
  readonly assets: ReadonlyArray<ReleaseAsset>
}

export type ApiError =
  | { readonly tag: 'http'; readonly status: number; readonly url: string; readonly message: string }
  | { readonly tag: 'network'; readonly message: string }
  | { readonly tag: 'parse'; readonly message: string }
  | { readonly tag: 'asset_not_found'; readonly agent: string; readonly availableAssets: ReadonlyArray<string> }

type FetchFn = (url: string, init: RequestInit) => Promise<Response>

interface FetchOptions {
  readonly fetch: FetchFn
  readonly token?: string
  readonly owner?: string
  readonly repo?: string
}

// TODO: update when faber repository is finalized
const DEFAULT_OWNER = 'faber-dev'
const DEFAULT_REPO = 'faber'

export const resolveGithubToken = (explicit: string | undefined): string | null => {
  const raw = explicit
    || process.env['GH_TOKEN']
    || process.env['GITHUB_TOKEN']
    || ''
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const buildAuthHeaders = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {}

const parseRelease = (data: Record<string, unknown>): Result<Release, ApiError> => {
  try {
    const tagName = data['tag_name'] as string
    const rawAssets = (data['assets'] ?? []) as ReadonlyArray<Record<string, unknown>>
    const assets: ReadonlyArray<ReleaseAsset> = rawAssets.map((a) => ({
      name: a['name'] as string,
      browserDownloadUrl: a['browser_download_url'] as string,
      size: a['size'] as number,
    }))
    return ok({ tagName, assets })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'parse', message })
  }
}

export const fetchLatestRelease = async (options: FetchOptions): Promise<Result<Release, ApiError>> => {
  const owner = options.owner ?? DEFAULT_OWNER
  const repo = options.repo ?? DEFAULT_REPO
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    ...buildAuthHeaders(options.token ?? null),
  }

  try {
    const response = await options.fetch(url, { headers })

    if (!response.ok) {
      return err({
        tag: 'http',
        status: response.status,
        url,
        message: `GitHub API returned ${response.status}`,
      })
    }

    const data = await response.json() as Record<string, unknown>
    return parseRelease(data)
  } catch (e) {
    if (e instanceof Error && 'tag' in e) throw e
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'network', message })
  }
}

export const findAsset = (
  assets: ReadonlyArray<ReleaseAsset>,
  agent: string,
): Result<ReleaseAsset, ApiError> => {
  const pattern = `faber-template-${agent}`
  const match = assets.find((a) => a.name.includes(pattern) && a.name.endsWith('.zip'))

  return match
    ? ok(match)
    : err({
        tag: 'asset_not_found',
        agent,
        availableAssets: assets.map((a) => a.name),
      })
}
