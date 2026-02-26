import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  readFile,
  writeFile,
  mkdir,
  exists,
  copyFile,
  readJson,
  writeJson,
} from '../../src/utils/fs.ts'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'faber-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('writeFile + readFile', () => {
  it('writes and reads a text file', async () => {
    const path = join(tmpDir, 'hello.txt')
    const writeResult = await writeFile(path, 'hello world')
    expect(writeResult.isOk()).toBe(true)

    const readResult = await readFile(path)
    expect(readResult.isOk()).toBe(true)
    expect(readResult._unsafeUnwrap()).toBe('hello world')
  })

  it('returns err when reading nonexistent file', async () => {
    const result = await readFile(join(tmpDir, 'nope.txt'))
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })

  it('FsError includes path', async () => {
    const path = join(tmpDir, 'nope.txt')
    const result = await readFile(path)
    expect(result._unsafeUnwrapErr().path).toBe(path)
  })
})

describe('mkdir', () => {
  it('creates a directory', async () => {
    const path = join(tmpDir, 'subdir')
    const result = await mkdir(path)
    expect(result.isOk()).toBe(true)

    const ex = await exists(path)
    expect(ex._unsafeUnwrap()).toBe(true)
  })

  it('creates nested directories (recursive)', async () => {
    const path = join(tmpDir, 'a', 'b', 'c')
    const result = await mkdir(path)
    expect(result.isOk()).toBe(true)

    const ex = await exists(path)
    expect(ex._unsafeUnwrap()).toBe(true)
  })

  it('succeeds if directory already exists', async () => {
    const path = join(tmpDir, 'existing')
    await mkdir(path)
    const result = await mkdir(path)
    expect(result.isOk()).toBe(true)
  })
})

describe('exists', () => {
  it('returns true for existing file', async () => {
    const path = join(tmpDir, 'file.txt')
    await writeFile(path, 'data')
    const result = await exists(path)
    expect(result._unsafeUnwrap()).toBe(true)
  })

  it('returns false for nonexistent path', async () => {
    const result = await exists(join(tmpDir, 'nope'))
    expect(result._unsafeUnwrap()).toBe(false)
  })
})

describe('copyFile', () => {
  it('copies a file', async () => {
    const src = join(tmpDir, 'src.txt')
    const dest = join(tmpDir, 'dest.txt')
    await writeFile(src, 'content')

    const result = await copyFile(src, dest)
    expect(result.isOk()).toBe(true)

    const read = await readFile(dest)
    expect(read._unsafeUnwrap()).toBe('content')
  })

  it('returns err when source does not exist', async () => {
    const result = await copyFile(join(tmpDir, 'nope'), join(tmpDir, 'dest'))
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })
})

describe('readJson + writeJson', () => {
  it('writes and reads JSON', async () => {
    const path = join(tmpDir, 'data.json')
    const data = { name: 'faber', version: 1, nested: { ok: true } }

    const writeResult = await writeJson(path, data)
    expect(writeResult.isOk()).toBe(true)

    const readResult = await readJson(path)
    expect(readResult.isOk()).toBe(true)
    expect(readResult._unsafeUnwrap()).toEqual(data)
  })

  it('returns err for invalid JSON', async () => {
    const path = join(tmpDir, 'bad.json')
    await writeFile(path, 'not json {{{')

    const result = await readJson(path)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('parse')
  })

  it('returns not_found for missing file', async () => {
    const result = await readJson(join(tmpDir, 'nope.json'))
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })
})

describe('FsError discriminated union', () => {
  it('not_found has path', async () => {
    const result = await readFile(join(tmpDir, 'x'))
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('not_found')
    if (error.tag === 'not_found') {
      expect(error.path).toContain('x')
    }
  })

  it('parse has path and message', async () => {
    const path = join(tmpDir, 'bad.json')
    await writeFile(path, '{invalid}')
    const result = await readJson(path)
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('parse')
    if (error.tag === 'parse') {
      expect(error.path).toBe(path)
      expect(error.message).toBeTruthy()
    }
  })
})
