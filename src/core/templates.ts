import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { FsError } from '../utils/fs.ts'
import type { ApiError } from './github.ts'

// --- Types ---

export type TemplateError =
  | { readonly tag: 'api'; readonly inner: ApiError }
  | { readonly tag: 'fs'; readonly inner: FsError }
  | { readonly tag: 'zip'; readonly path: string; readonly message: string }
  | { readonly tag: 'merge'; readonly path: string; readonly message: string }

export interface TemplateMetadata {
  readonly release: string
  readonly assetName: string
  readonly fileCount: number
}

// --- Asset naming ---

export const assetName = (agent: string, scriptType: string): string =>
  `faber-template-${agent}-${scriptType}.zip`

// --- Flatten nested prefix ---

export const flattenPrefix = (entries: ReadonlyArray<string>): ReadonlyArray<string> => {
  // Filter out bare directory entries (ending with /)
  const files = entries.filter((e) => !e.endsWith('/'))
  if (files.length === 0) return []

  // Check if all files share the same top-level directory
  const firstSlash = files[0]!.indexOf('/')
  if (firstSlash === -1) return files // no directory prefix in first entry

  const prefix = files[0]!.slice(0, firstSlash + 1)
  const allSharePrefix = files.every((f) => f.startsWith(prefix))

  if (!allSharePrefix) return files

  return files.map((f) => f.slice(prefix.length))
}

// --- JSON deep merge ---

export const mergeJsonObjects = (
  base: Readonly<Record<string, unknown>>,
  update: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const result: Record<string, unknown> = { ...base }

  for (const [key, updateValue] of Object.entries(update)) {
    const baseValue = result[key]

    if (
      typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue) &&
      typeof updateValue === 'object' && updateValue !== null && !Array.isArray(updateValue)
    ) {
      result[key] = mergeJsonObjects(
        baseValue as Record<string, unknown>,
        updateValue as Record<string, unknown>,
      )
    } else {
      result[key] = updateValue
    }
  }

  return result
}

// --- Special file detection ---

const MERGE_PATHS = new Set(['.vscode/settings.json'])

export const shouldMerge = (relativePath: string): boolean =>
  MERGE_PATHS.has(relativePath)

export const isExecutableScript = (filePath: string): boolean =>
  filePath.endsWith('.sh') || filePath.endsWith('.bash')

// --- Error constructors ---

export const apiError = (inner: ApiError): TemplateError =>
  ({ tag: 'api', inner })

export const fsError = (inner: FsError): TemplateError =>
  ({ tag: 'fs', inner })

export const zipError = (path: string, message: string): TemplateError =>
  ({ tag: 'zip', path, message })

export const mergeError = (path: string, message: string): TemplateError =>
  ({ tag: 'merge', path, message })

// --- ZIP extraction (async, uses yauzl-promise) ---

export const extractZip = async (
  zipPath: string,
  destDir: string,
): Promise<Result<ReadonlyArray<string>, TemplateError>> => {
  try {
    const { open } = await import('yauzl-promise')
    const zipFile = await open(zipPath)
    const extractedFiles: string[] = []

    try {
      for await (const entry of zipFile) {
        if (entry.filename.endsWith('/')) continue // skip directories

        const readStream = await entry.openReadStream()
        const chunks: Uint8Array[] = []
        for await (const chunk of readStream) {
          chunks.push(chunk as Uint8Array)
        }
        const content = Buffer.concat(chunks)

        extractedFiles.push(entry.filename)

        const { join, dirname } = await import('node:path')
        const { mkdir: mkdirFs, writeFile: writeFileFs } = await import('node:fs/promises')

        const targetPath = join(destDir, entry.filename)
        await mkdirFs(dirname(targetPath), { recursive: true })
        await writeFileFs(targetPath, content)
      }
    } finally {
      await zipFile.close()
    }

    return ok(flattenPrefix(extractedFiles))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(zipError(zipPath, message))
  }
}

// --- Download asset (async, uses fetch) ---

export const downloadAsset = async (
  url: string,
  destPath: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
  token?: string,
): Promise<Result<string, TemplateError>> => {
  try {
    const headers: Record<string, string> = { Accept: 'application/octet-stream' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetchFn(url, { headers })
    if (!response.ok) {
      return err({
        tag: 'api',
        inner: { tag: 'http', status: response.status, url, message: response.statusText },
      })
    }

    const buffer = await response.arrayBuffer()
    const { writeFile: writeFileFs } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    const { mkdir: mkdirFs } = await import('node:fs/promises')

    await mkdirFs(dirname(destPath), { recursive: true })
    await writeFileFs(destPath, Buffer.from(buffer))

    return ok(destPath)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'api', inner: { tag: 'network', message } })
  }
}
