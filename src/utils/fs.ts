import * as nodeFs from 'node:fs/promises'
import { ok, err } from 'neverthrow'
import type { ResultAsync } from 'neverthrow'

export type FsError =
  | { readonly tag: 'not_found'; readonly path: string }
  | { readonly tag: 'permission'; readonly path: string; readonly message: string }
  | { readonly tag: 'parse'; readonly path: string; readonly message: string }
  | { readonly tag: 'io'; readonly path: string; readonly message: string }

const toFsError = (e: unknown, path: string): FsError => {
  if (e instanceof Error && 'code' in e) {
    if (e.code === 'ENOENT') return { tag: 'not_found', path }
    if (e.code === 'EACCES' || e.code === 'EPERM') return { tag: 'permission', path, message: e.message }
  }
  const message = e instanceof Error ? e.message : String(e)
  return { tag: 'io', path, message }
}

export const readFile = async (path: string): Promise<ResultAsync<string, FsError>> => {
  try {
    const content = await nodeFs.readFile(path, 'utf-8')
    return ok(content)
  } catch (e) {
    return err(toFsError(e, path))
  }
}

export const writeFile = async (path: string, content: string): Promise<ResultAsync<void, FsError>> => {
  try {
    await nodeFs.writeFile(path, content, 'utf-8')
    return ok(undefined)
  } catch (e) {
    return err(toFsError(e, path))
  }
}

export const mkdir = async (path: string): Promise<ResultAsync<void, FsError>> => {
  try {
    await nodeFs.mkdir(path, { recursive: true })
    return ok(undefined)
  } catch (e) {
    return err(toFsError(e, path))
  }
}

export const exists = async (path: string): Promise<ResultAsync<boolean, FsError>> => {
  try {
    await nodeFs.access(path)
    return ok(true)
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
      return ok(false)
    }
    return err(toFsError(e, path))
  }
}

export const copyFile = async (src: string, dest: string): Promise<ResultAsync<void, FsError>> => {
  try {
    await nodeFs.copyFile(src, dest)
    return ok(undefined)
  } catch (e) {
    return err(toFsError(e, src))
  }
}

export const readJson = async (path: string): Promise<ResultAsync<unknown, FsError>> => {
  const content = await readFile(path)
  if (content.isErr()) return err(content.error)

  try {
    return ok(JSON.parse(content.value))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'parse', path, message })
  }
}

export const writeJson = async (path: string, data: unknown): Promise<ResultAsync<void, FsError>> => {
  try {
    const content = JSON.stringify(data, null, 2) + '\n'
    return writeFile(path, content)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'io', path, message })
  }
}
