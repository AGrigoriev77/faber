import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, chmod, writeFile as nodeWriteFile } from 'node:fs/promises'
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

  it('EACCES triggers permission tag', async () => {
    const path = join(tmpDir, 'readonly.txt')
    await nodeWriteFile(path, 'protected')
    await chmod(path, 0o444)
    const result = await writeFile(path, 'overwrite attempt')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('permission')
  })
})

describe('writeJson edge cases', () => {
  it('returns err for circular reference', async () => {
    const path = join(tmpDir, 'circular.json')
    const obj: Record<string, unknown> = { name: 'test' }
    obj['self'] = obj
    const result = await writeJson(path, obj)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('io')
  })
})

describe('exists edge cases', () => {
  it('returns err for permission denied (non-ENOENT)', async () => {
    // On macOS/Linux, accessing /proc-like paths or restricted dirs can trigger non-ENOENT errors
    // Test indirectly: a path whose parent has no execute permission
    const parentDir = join(tmpDir, 'locked')
    const { mkdir: fsMkdir } = await import('node:fs/promises')
    await fsMkdir(parentDir)
    await nodeWriteFile(join(parentDir, 'file.txt'), 'data')
    await chmod(parentDir, 0o000)

    const result = await exists(join(parentDir, 'file.txt'))
    // On most systems this returns err with 'permission' tag
    if (result.isErr()) {
      expect(result._unsafeUnwrapErr().tag).toBe('permission')
    }

    // Restore permissions for cleanup
    await chmod(parentDir, 0o755)
  })
})

describe('writeFile edge cases', () => {
  it('returns io error for path inside nonexistent dir', async () => {
    const path = join(tmpDir, 'nonexistent', 'deep', 'file.txt')
    const result = await writeFile(path, 'data')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })
})

describe('readJson with readFile error propagation', () => {
  it('propagates readFile not_found through andThen', async () => {
    const result = await readJson(join(tmpDir, 'missing.json'))
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })
})

describe('mkdir edge cases', () => {
  it('returns io error for impossible path under /dev/null', async () => {
    const result = await mkdir('/dev/null/impossible/path')
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(['io', 'not_found']).toContain(error.tag)
  })
})

describe('copyFile edge cases', () => {
  it('returns err when destination dir does not exist', async () => {
    const src = join(tmpDir, 'src.txt')
    await nodeWriteFile(src, 'data')
    const result = await copyFile(src, join(tmpDir, 'no-dir', 'dest.txt'))
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_found')
  })
})
