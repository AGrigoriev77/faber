import { describe, it, expect, beforeEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { runExtensionAdd } from '../../../src/commands/extension/add.ts'
import { addExtension, emptyRegistry, serializeRegistry } from '../../../src/extensions/registry.ts'

let tmpDir: string
let extSourceDir: string

const VALID_MANIFEST = `
schema_version: "1.0"
extension:
  id: test-ext
  name: Test Extension
  version: "1.0.0"
  description: A test extension
requires:
  faber_version: ">=0.1.0"
provides:
  commands:
    - name: faber.test-ext.run
      file: commands/run.md
`

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'faber-ext-add-'))
  extSourceDir = join(tmpDir, 'source-ext')

  // Create faber project
  await mkdir(join(tmpDir, 'project', '.faber', 'extensions'), { recursive: true })

  // Create extension source
  await mkdir(join(extSourceDir, 'commands'), { recursive: true })
  await writeFile(join(extSourceDir, 'extension.yml'), VALID_MANIFEST)
  await writeFile(join(extSourceDir, 'commands', 'run.md'), '# Run command\n\nHello $ARGUMENTS')

  return async () => { await rm(tmpDir, { recursive: true, force: true }) }
})

const projectDir = () => join(tmpDir, 'project')

describe('runExtensionAdd', () => {
  it('installs extension from local directory', async () => {
    const result = await runExtensionAdd({
      cwd: projectDir(),
      source: extSourceDir,
    })
    expect(result.isOk()).toBe(true)
    const val = result._unsafeUnwrap()
    expect(val.id).toBe('test-ext')
    expect(val.version).toBe('1.0.0')
    expect(val.filesCreated).toBeGreaterThan(0)
  })

  it('saves extension to registry', async () => {
    await runExtensionAdd({ cwd: projectDir(), source: extSourceDir })

    const regContent = await readFile(
      join(projectDir(), '.faber', 'extensions', '.registry'),
      'utf-8',
    )
    const reg = JSON.parse(regContent)
    expect(reg.extensions['test-ext']).toBeDefined()
    expect(reg.extensions['test-ext'].version).toBe('1.0.0')
  })

  it('returns not_a_project when .faber missing', async () => {
    const emptyDir = join(tmpDir, 'empty')
    await mkdir(emptyDir, { recursive: true })

    const result = await runExtensionAdd({ cwd: emptyDir, source: extSourceDir })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_a_project')
  })

  it('returns already_installed when extension exists', async () => {
    const reg = addExtension(emptyRegistry(), 'test-ext', {
      version: '1.0.0',
      source: 'local',
      installedAt: '2026-01-01T00:00:00Z',
    })
    await writeFile(
      join(projectDir(), '.faber', 'extensions', '.registry'),
      serializeRegistry(reg),
    )

    const result = await runExtensionAdd({ cwd: projectDir(), source: extSourceDir })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('already_installed')
  })

  it('returns compatibility error for incompatible version', async () => {
    const incompatManifest = VALID_MANIFEST.replace('>=0.1.0', '>=99.0.0')
    await writeFile(join(extSourceDir, 'extension.yml'), incompatManifest)

    const result = await runExtensionAdd({ cwd: projectDir(), source: extSourceDir })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('compatibility')
  })

  it('returns manifest_io error for missing manifest', async () => {
    const noManifestDir = join(tmpDir, 'no-manifest')
    await mkdir(noManifestDir, { recursive: true })

    const result = await runExtensionAdd({ cwd: projectDir(), source: noManifestDir })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('manifest_io')
  })
})
