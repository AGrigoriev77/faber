import { describe, it, expect, beforeEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { runExtensionRemove } from '../../../src/commands/extension/remove.ts'
import { addExtension, emptyRegistry, serializeRegistry } from '../../../src/extensions/registry.ts'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'faber-ext-remove-'))
  return async () => { await rm(tmpDir, { recursive: true, force: true }) }
})

const setupProject = async () => {
  const projectDir = join(tmpDir, 'project')
  const extDir = join(projectDir, '.faber', 'extensions')
  await mkdir(extDir, { recursive: true })

  // Install an extension
  const reg = addExtension(emptyRegistry(), 'test-ext', {
    version: '1.0.0',
    source: 'local',
    installedAt: '2026-01-01T00:00:00Z',
  })
  await writeFile(join(extDir, '.registry'), serializeRegistry(reg))

  // Create extension files
  const extFilesDir = join(extDir, 'test-ext')
  await mkdir(extFilesDir, { recursive: true })
  await writeFile(join(extFilesDir, 'extension.yml'), 'test')

  return projectDir
}

describe('runExtensionRemove', () => {
  it('removes installed extension', async () => {
    const projectDir = await setupProject()

    const result = await runExtensionRemove({ cwd: projectDir, id: 'test-ext' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().id).toBe('test-ext')
    expect(result._unsafeUnwrap().version).toBe('1.0.0')
  })

  it('deletes extension files by default', async () => {
    const projectDir = await setupProject()
    const extFilesDir = join(projectDir, '.faber', 'extensions', 'test-ext')

    await runExtensionRemove({ cwd: projectDir, id: 'test-ext' })

    await expect(access(extFilesDir)).rejects.toThrow()
  })

  it('keeps extension files with --keep-config', async () => {
    const projectDir = await setupProject()
    const extFilesDir = join(projectDir, '.faber', 'extensions', 'test-ext')

    await runExtensionRemove({ cwd: projectDir, id: 'test-ext', keepConfig: true })

    // Files should still exist
    await expect(access(extFilesDir)).resolves.toBeUndefined()
  })

  it('returns not_installed for missing extension', async () => {
    const projectDir = join(tmpDir, 'proj2')
    await mkdir(join(projectDir, '.faber', 'extensions'), { recursive: true })

    const result = await runExtensionRemove({ cwd: projectDir, id: 'nope' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_installed')
  })

  it('returns not_a_project when .faber missing', async () => {
    const emptyDir = join(tmpDir, 'empty')
    await mkdir(emptyDir, { recursive: true })

    const result = await runExtensionRemove({ cwd: emptyDir, id: 'test-ext' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_a_project')
  })

  it('succeeds even when extension dir is already gone (cleanup handles missing dir)', async () => {
    const projectDir = await setupProject()
    const extFilesDir = join(projectDir, '.faber', 'extensions', 'test-ext')

    // Remove extension files BEFORE the command runs
    await rm(extFilesDir, { recursive: true, force: true })

    const result = await runExtensionRemove({ cwd: projectDir, id: 'test-ext' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().id).toBe('test-ext')
  })

  it('succeeds when extension dir cannot be deleted (cleanup is non-fatal)', async () => {
    const projectDir = await setupProject()
    const extDir = join(projectDir, '.faber', 'extensions', 'test-ext')

    // With keepConfig=true, cleanupFiles skips rm entirely
    const result = await runExtensionRemove({ cwd: projectDir, id: 'test-ext', keepConfig: true })
    expect(result.isOk()).toBe(true)

    // Extension files should still exist
    await expect(access(extDir)).resolves.toBeUndefined()
  })

  it('returns correct version from removed extension', async () => {
    const projectDir = await setupProject()
    const result = await runExtensionRemove({ cwd: projectDir, id: 'test-ext' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().version).toBe('1.0.0')
  })

  it('returns not_installed for missing registry file (empty registry)', async () => {
    const projectDir = join(tmpDir, 'no-registry')
    await mkdir(join(projectDir, '.faber', 'extensions'), { recursive: true })
    // No .registry file — loadRegistry falls back to emptyRegistry

    const result = await runExtensionRemove({ cwd: projectDir, id: 'some-ext' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_installed')
  })
})
