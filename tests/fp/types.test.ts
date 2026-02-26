import { describe, it, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import fc from 'fast-check'
import {
  assertNever,
  extensionId,
  semVer,
  absolutePath,
} from '../../src/fp/types.ts'
import type { ExtensionId, SemVer, AbsolutePath } from '../../src/fp/types.ts'

describe('assertNever', () => {
  it('throws on unexpected value at runtime', () => {
    expect(() => assertNever('unexpected' as never)).toThrow('Unexpected value: unexpected')
  })

  it('works in exhaustive switch', () => {
    type Color = { readonly tag: 'red' } | { readonly tag: 'blue' }
    const describeColor = (c: Color): string => {
      switch (c.tag) {
        case 'red': return 'warm'
        case 'blue': return 'cool'
        default: return assertNever(c as never)
      }
    }
    expect(describeColor({ tag: 'red' })).toBe('warm')
    expect(describeColor({ tag: 'blue' })).toBe('cool')
  })
})

describe('ExtensionId', () => {
  it('accepts valid lowercase-hyphen ids', () => {
    expect(extensionId('my-extension').isOk()).toBe(true)
    expect(extensionId('a').isOk()).toBe(true)
    expect(extensionId('hello-world-123').isOk()).toBe(true)
  })

  it('rejects empty string', () => {
    expect(extensionId('').isErr()).toBe(true)
  })

  it('rejects uppercase', () => {
    expect(extensionId('MyExtension').isErr()).toBe(true)
  })

  it('rejects spaces', () => {
    expect(extensionId('my extension').isErr()).toBe(true)
  })

  it('rejects special characters', () => {
    expect(extensionId('my_ext').isErr()).toBe(true)
    expect(extensionId('my.ext').isErr()).toBe(true)
  })

  it('returns branded type on success', () => {
    const result = extensionId('valid-id')
    expect(result._unsafeUnwrap()).toBe('valid-id')
    const typed: ExtensionId = result._unsafeUnwrap()
    expect(typed).toBe('valid-id')
  })

  test.prop([fc.string()])('rejects any string with uppercase', (raw) => {
    if (/[A-Z]/.test(raw)) {
      expect(extensionId(raw).isErr()).toBe(true)
    }
  })

  test.prop([fc.string()])('rejects any string with invalid chars', (raw) => {
    if (/[^a-z0-9-]/.test(raw)) {
      expect(extensionId(raw).isErr()).toBe(true)
    }
  })
})

describe('SemVer', () => {
  it('accepts valid semver strings', () => {
    expect(semVer('1.0.0').isOk()).toBe(true)
    expect(semVer('0.1.0').isOk()).toBe(true)
    expect(semVer('12.34.56').isOk()).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(semVer('1.0').isErr()).toBe(true)
    expect(semVer('v1.0.0').isErr()).toBe(true)
    expect(semVer('1.0.0.0').isErr()).toBe(true)
    expect(semVer('abc').isErr()).toBe(true)
    expect(semVer('').isErr()).toBe(true)
  })

  it('returns branded type on success', () => {
    const result = semVer('1.2.3')
    const typed: SemVer = result._unsafeUnwrap()
    expect(typed).toBe('1.2.3')
  })

  test.prop([fc.nat(), fc.nat(), fc.nat()])('accepts any valid M.m.p', (major, minor, patch) => {
    const raw = `${major}.${minor}.${patch}`
    expect(semVer(raw).isOk()).toBe(true)
  })
})

describe('AbsolutePath', () => {
  it('accepts unix absolute paths', () => {
    expect(absolutePath('/home/user').isOk()).toBe(true)
    expect(absolutePath('/').isOk()).toBe(true)
  })

  it('accepts windows absolute paths', () => {
    expect(absolutePath('C:\\Users\\me').isOk()).toBe(true)
    expect(absolutePath('D:\\').isOk()).toBe(true)
  })

  it('rejects relative paths', () => {
    expect(absolutePath('relative/path').isErr()).toBe(true)
    expect(absolutePath('./here').isErr()).toBe(true)
    expect(absolutePath('../up').isErr()).toBe(true)
    expect(absolutePath('').isErr()).toBe(true)
  })

  it('returns branded type on success', () => {
    const result = absolutePath('/usr/bin')
    const typed: AbsolutePath = result._unsafeUnwrap()
    expect(typed).toBe('/usr/bin')
  })

  test.prop([fc.string()])('rejects strings not starting with / or drive letter', (raw) => {
    if (!/^(\/|[A-Za-z]:\\)/.test(raw)) {
      expect(absolutePath(raw).isErr()).toBe(true)
    }
  })
})
