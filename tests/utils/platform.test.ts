import { describe, it, expect } from 'vitest'
import {
  detectPlatform,
  isWindows,
  isMac,
  isLinux,
} from '../../src/utils/platform.ts'

describe('detectPlatform', () => {
  it('returns darwin for darwin', () => {
    const p = detectPlatform('darwin')
    expect(p.tag).toBe('darwin')
  })

  it('returns linux for linux', () => {
    const p = detectPlatform('linux')
    expect(p.tag).toBe('linux')
  })

  it('returns win32 for win32', () => {
    const p = detectPlatform('win32')
    expect(p.tag).toBe('win32')
  })

  it('returns unknown for freebsd', () => {
    const p = detectPlatform('freebsd')
    expect(p.tag).toBe('unknown')
    if (p.tag === 'unknown') {
      expect(p.raw).toBe('freebsd')
    }
  })

  it('returns unknown for empty string', () => {
    const p = detectPlatform('')
    expect(p.tag).toBe('unknown')
  })
})

describe('isWindows / isMac / isLinux', () => {
  it('isWindows true only for win32', () => {
    expect(isWindows(detectPlatform('win32'))).toBe(true)
    expect(isWindows(detectPlatform('darwin'))).toBe(false)
    expect(isWindows(detectPlatform('linux'))).toBe(false)
  })

  it('isMac true only for darwin', () => {
    expect(isMac(detectPlatform('darwin'))).toBe(true)
    expect(isMac(detectPlatform('win32'))).toBe(false)
    expect(isMac(detectPlatform('linux'))).toBe(false)
  })

  it('isLinux true only for linux', () => {
    expect(isLinux(detectPlatform('linux'))).toBe(true)
    expect(isLinux(detectPlatform('darwin'))).toBe(false)
    expect(isLinux(detectPlatform('win32'))).toBe(false)
  })
})

describe('currentPlatform (smoke test)', () => {
  it('detectPlatform with process.platform returns known tag', () => {
    const p = detectPlatform(process.platform)
    expect(['darwin', 'linux', 'win32', 'unknown']).toContain(p.tag)
  })
})
