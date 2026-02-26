import { describe, it, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import fc from 'fast-check'
import {
  parseManifest,
  validateManifest,
} from '../../src/extensions/manifest.ts'

const validYaml = `
schema_version: "1.0"
extension:
  id: my-extension
  name: My Extension
  version: "1.0.0"
  description: A test extension
requires:
  speckit_version: ">=1.0.0"
provides:
  commands:
    - name: speckit.my-extension.run
      file: commands/run.md
`

const validData = {
  schema_version: '1.0',
  extension: {
    id: 'my-extension',
    name: 'My Extension',
    version: '1.0.0',
    description: 'A test extension',
  },
  requires: {
    speckit_version: '>=1.0.0',
  },
  provides: {
    commands: [
      { name: 'speckit.my-extension.run', file: 'commands/run.md' },
    ],
  },
}

describe('parseManifest', () => {
  it('parses valid YAML into raw data', () => {
    const result = parseManifest(validYaml)
    expect(result.isOk()).toBe(true)
    const data = result._unsafeUnwrap()
    expect(data['schema_version']).toBe('1.0')
    expect((data['extension'] as Record<string, unknown>)['id']).toBe('my-extension')
  })

  it('returns err for invalid YAML', () => {
    const result = parseManifest('{{invalid: yaml: [')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('yaml_parse')
  })

  it('returns err for empty string', () => {
    const result = parseManifest('')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('yaml_parse')
  })

  it('returns err for non-object YAML', () => {
    const result = parseManifest('just a string')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('yaml_parse')
  })
})

describe('validateManifest', () => {
  it('validates a correct manifest', () => {
    const result = validateManifest(validData)
    expect(result.isOk()).toBe(true)
    const manifest = result._unsafeUnwrap()
    expect(manifest.extension.id).toBe('my-extension')
    expect(manifest.extension.name).toBe('My Extension')
    expect(manifest.extension.version).toBe('1.0.0')
    expect(manifest.extension.description).toBe('A test extension')
    expect(manifest.requires.speckitVersion).toBe('>=1.0.0')
    expect(manifest.provides.commands).toHaveLength(1)
  })

  it('rejects missing schema_version', () => {
    const data = { ...validData, schema_version: undefined }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'schema_version')
  })

  it('rejects wrong schema_version', () => {
    const data = { ...validData, schema_version: '2.0' }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'schema_version')
  })

  it('rejects missing extension.id', () => {
    const data = {
      ...validData,
      extension: { ...validData.extension, id: undefined },
    }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'extension.id')
  })

  it('rejects invalid extension.id format', () => {
    const data = {
      ...validData,
      extension: { ...validData.extension, id: 'Invalid_ID' },
    }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'extension.id')
  })

  it('rejects missing extension.name', () => {
    const data = {
      ...validData,
      extension: { ...validData.extension, name: undefined },
    }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'extension.name')
  })

  it('rejects invalid extension.version', () => {
    const data = {
      ...validData,
      extension: { ...validData.extension, version: 'not-a-version' },
    }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'extension.version')
  })

  it('rejects missing requires.speckit_version', () => {
    const data = { ...validData, requires: {} }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'requires.speckit_version')
  })

  it('rejects missing provides.commands', () => {
    const data = { ...validData, provides: {} }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'provides.commands')
  })

  it('rejects empty commands array', () => {
    const data = { ...validData, provides: { commands: [] } }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'provides.commands')
  })

  it('rejects command without name', () => {
    const data = {
      ...validData,
      provides: { commands: [{ file: 'x.md' }] },
    }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'commands[0].name')
  })

  it('rejects command without file', () => {
    const data = {
      ...validData,
      provides: { commands: [{ name: 'speckit.ext.cmd' }] },
    }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'commands[0].file')
  })

  it('rejects invalid command name format', () => {
    const data = {
      ...validData,
      provides: { commands: [{ name: 'bad-name', file: 'x.md' }] },
    }
    const result = validateManifest(data)
    expect(result.isErr()).toBe(true)
    expectFieldError(result, 'commands[0].name')
  })

  it('accepts hooks as optional', () => {
    const result = validateManifest(validData)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().hooks).toEqual({})
  })

  it('preserves hooks when present', () => {
    const data = { ...validData, hooks: { 'post-install': 'setup.sh' } }
    const result = validateManifest(data)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().hooks).toEqual({ 'post-install': 'setup.sh' })
  })

  it('accepts multiple valid commands', () => {
    const data = {
      ...validData,
      provides: {
        commands: [
          { name: 'speckit.my-extension.run', file: 'run.md' },
          { name: 'speckit.my-extension.check', file: 'check.md' },
        ],
      },
    }
    const result = validateManifest(data)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().provides.commands).toHaveLength(2)
  })

  test.prop([fc.string().filter(s => /[A-Z_.]/.test(s))])(
    'rejects extension id with uppercase/underscore/dot',
    (id) => {
      const data = {
        ...validData,
        extension: { ...validData.extension, id },
      }
      expect(validateManifest(data).isErr()).toBe(true)
    },
  )

  test.prop([fc.nat(), fc.nat(), fc.nat()])(
    'accepts any valid semver as extension version',
    (major, minor, patch) => {
      const data = {
        ...validData,
        extension: { ...validData.extension, version: `${major}.${minor}.${patch}` },
      }
      expect(validateManifest(data).isOk()).toBe(true)
    },
  )
})

describe('parseManifest + validateManifest pipeline', () => {
  it('full pipeline: YAML string → validated Manifest', () => {
    const result = parseManifest(validYaml).andThen(validateManifest)
    expect(result.isOk()).toBe(true)
    const manifest = result._unsafeUnwrap()
    expect(manifest.extension.id).toBe('my-extension')
  })

  it('pipeline fails on bad YAML', () => {
    const result = parseManifest('{{bad').andThen(validateManifest)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('yaml_parse')
  })

  it('pipeline fails on valid YAML but invalid manifest', () => {
    const result = parseManifest('foo: bar').andThen(validateManifest)
    expect(result.isErr()).toBe(true)
  })
})

function expectFieldError(result: ReturnType<typeof validateManifest>, field: string) {
  const error = result._unsafeUnwrapErr()
  expect(error.tag).toBe('validation')
  if (error.tag === 'validation') {
    expect(error.field).toBe(field)
  }
}
