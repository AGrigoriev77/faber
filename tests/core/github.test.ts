import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchLatestRelease,
  findAsset,
  resolveGithubToken,
  buildAuthHeaders,
  type ReleaseAsset,
} from '../../src/core/github.ts'

const makeAsset = (name: string): ReleaseAsset => ({
  name,
  browserDownloadUrl: `https://github.com/download/${name}`,
  size: 1024,
})

describe('findAsset', () => {
  const assets: ReadonlyArray<ReleaseAsset> = [
    makeAsset('spec-kit-template-claude-sh.zip'),
    makeAsset('spec-kit-template-claude-ps.zip'),
    makeAsset('spec-kit-template-copilot-sh.zip'),
    makeAsset('spec-kit-template-gemini-sh.zip'),
  ]

  it('finds matching asset by agent and script type', () => {
    const result = findAsset(assets, 'claude', 'sh')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().name).toBe('spec-kit-template-claude-sh.zip')
  })

  it('finds ps variant', () => {
    const result = findAsset(assets, 'claude', 'ps')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().name).toBe('spec-kit-template-claude-ps.zip')
  })

  it('returns err when no match', () => {
    const result = findAsset(assets, 'qwen', 'sh')
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('asset_not_found')
    if (error.tag === 'asset_not_found') {
      expect(error.agent).toBe('qwen')
      expect(error.availableAssets).toHaveLength(4)
    }
  })

  it('returns err for empty assets list', () => {
    const result = findAsset([], 'claude', 'sh')
    expect(result.isErr()).toBe(true)
  })

  it('only matches .zip files', () => {
    const nonZip = [makeAsset('spec-kit-template-claude-sh.tar.gz')]
    const result = findAsset(nonZip, 'claude', 'sh')
    expect(result.isErr()).toBe(true)
  })
})

describe('resolveGithubToken', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers explicit token over env', () => {
    vi.stubEnv('GH_TOKEN', 'env-token')
    expect(resolveGithubToken('explicit')).toBe('explicit')
  })

  it('falls back to GH_TOKEN', () => {
    vi.stubEnv('GH_TOKEN', 'gh-token')
    vi.stubEnv('GITHUB_TOKEN', '')
    expect(resolveGithubToken(undefined)).toBe('gh-token')
  })

  it('falls back to GITHUB_TOKEN', () => {
    vi.stubEnv('GH_TOKEN', '')
    vi.stubEnv('GITHUB_TOKEN', 'github-token')
    expect(resolveGithubToken(undefined)).toBe('github-token')
  })

  it('returns null when no token available', () => {
    vi.stubEnv('GH_TOKEN', '')
    vi.stubEnv('GITHUB_TOKEN', '')
    expect(resolveGithubToken(undefined)).toBeNull()
  })

  it('trims whitespace', () => {
    vi.stubEnv('GH_TOKEN', '  spaced  ')
    expect(resolveGithubToken(undefined)).toBe('spaced')
  })
})

describe('buildAuthHeaders', () => {
  it('returns Authorization header when token present', () => {
    const headers = buildAuthHeaders('my-token')
    expect(headers).toEqual({ Authorization: 'Bearer my-token' })
  })

  it('returns empty object when no token', () => {
    expect(buildAuthHeaders(null)).toEqual({})
  })
})

describe('fetchLatestRelease', () => {
  it('parses valid release response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v1.0.0',
        assets: [
          {
            name: 'spec-kit-template-claude-sh.zip',
            browser_download_url: 'https://example.com/download.zip',
            size: 2048,
          },
        ],
      }),
    }
    const fetcher = vi.fn().mockResolvedValue(mockResponse)

    const result = await fetchLatestRelease({ fetch: fetcher })
    expect(result.isOk()).toBe(true)
    const release = result._unsafeUnwrap()
    expect(release.tagName).toBe('v1.0.0')
    expect(release.assets).toHaveLength(1)
    expect(release.assets[0]!.name).toBe('spec-kit-template-claude-sh.zip')
  })

  it('returns err on non-200 status', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      json: async () => ({ message: 'rate limited' }),
      headers: new Headers({
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Limit': '60',
      }),
    }
    const fetcher = vi.fn().mockResolvedValue(mockResponse)

    const result = await fetchLatestRelease({ fetch: fetcher })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('http')
  })

  it('returns err on network failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await fetchLatestRelease({ fetch: fetcher })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('network')
  })

  it('passes auth headers when token provided', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v1.0.0', assets: [] }),
    }
    const fetcher = vi.fn().mockResolvedValue(mockResponse)

    await fetchLatestRelease({ fetch: fetcher, token: 'my-token' })

    const callArgs = fetcher.mock.calls[0]!
    expect(callArgs[1].headers.Authorization).toBe('Bearer my-token')
  })

  it('uses custom repo owner/name', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v2.0.0', assets: [] }),
    }
    const fetcher = vi.fn().mockResolvedValue(mockResponse)

    await fetchLatestRelease({ fetch: fetcher, owner: 'myorg', repo: 'myrepo' })

    const url = fetcher.mock.calls[0]![0] as string
    expect(url).toContain('myorg/myrepo')
  })

  it('re-throws errors with tag property', async () => {
    const taggedError = Object.assign(new Error('parse fail'), { tag: 'parse' })
    const fetcher = vi.fn().mockRejectedValue(taggedError)

    await expect(fetchLatestRelease({ fetch: fetcher })).rejects.toThrow('parse fail')
  })

  it('returns network error for non-Error exception', async () => {
    const fetcher = vi.fn().mockRejectedValue('string error')
    const result = await fetchLatestRelease({ fetch: fetcher })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('network')
    expect(result._unsafeUnwrapErr()).toHaveProperty('message', 'string error')
  })
})
