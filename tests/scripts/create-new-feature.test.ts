import { describe, it, expect } from 'vitest'
import { test as fcTest } from '@fast-check/vitest'
import fc from 'fast-check'
import {
  STOP_WORDS,
  generateBranchName,
  cleanBranchName,
  formatBranchNumber,
  getNextNumber,
  buildFullBranchName,
} from '../../scripts/ts/create-new-feature.ts'

// ─── STOP_WORDS ───────────────────────────────────────────────────────

describe('STOP_WORDS', () => {
  it('is a ReadonlySet with 48 entries', () => {
    expect(STOP_WORDS).toBeInstanceOf(Set)
    expect(STOP_WORDS.size).toBe(48)
  })

  it('contains all expected stop words', () => {
    const expected = [
      'i', 'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at',
      'by', 'with', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
      'can', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'my',
      'your', 'our', 'their', 'want', 'need', 'add', 'get', 'set',
    ]
    expected.forEach((w) => {
      expect(STOP_WORDS.has(w), `Expected STOP_WORDS to contain "${w}"`).toBe(true)
    })
  })
})

// ─── generateBranchName ───────────────────────────────────────────────

describe('generateBranchName', () => {
  it('filters stop words and short words', () => {
    expect(generateBranchName('Add user authentication system')).toBe('user-authentication-system')
  })

  it('keeps uppercase acronyms even if short', () => {
    expect(generateBranchName('Implement OAuth2 API integration')).toBe('implement-oauth2-api-integration')
  })

  it('takes at most 4 words when exactly 4 meaningful words', () => {
    const result = generateBranchName('implement oauth2 api integration')
    expect(result.split('-').length).toBeLessThanOrEqual(4)
  })

  it('takes at most 3 words when more than 4 meaningful words', () => {
    const result = generateBranchName('implement user authentication system service layer')
    expect(result.split('-').length).toBe(3)
  })

  it('handles description with only stop words — returns empty', () => {
    const result = generateBranchName('add the set')
    // all words are stop words — nothing meaningful remains
    expect(result).toBe('')
  })

  it('handles empty string', () => {
    const result = generateBranchName('')
    expect(typeof result).toBe('string')
  })

  it('lowercases output', () => {
    const result = generateBranchName('IMPLEMENT BIG FEATURE')
    expect(result).toBe(result.toLowerCase())
  })

  // Property-based: output never contains stop words
  fcTest.prop([fc.stringMatching(/^[a-zA-Z ]{1,80}$/)])(
    'output never contains stop words as whole segments',
    (desc) => {
      const result = generateBranchName(desc)
      const segments = result.split('-').filter((s) => s.length > 0)
      segments.forEach((seg) => {
        expect(STOP_WORDS.has(seg), `segment "${seg}" is a stop word`).toBe(false)
      })
    },
  )

  // Property-based: at most 4 words in output
  fcTest.prop([fc.stringMatching(/^[a-zA-Z ]{1,100}$/)])(
    'output has at most 4 word segments',
    (desc) => {
      const result = generateBranchName(desc)
      const segments = result.split('-').filter((s) => s.length > 0)
      expect(segments.length).toBeLessThanOrEqual(4)
    },
  )
})

// ─── cleanBranchName ──────────────────────────────────────────────────

describe('cleanBranchName', () => {
  it('lowercases input', () => {
    expect(cleanBranchName('Hello-World')).toBe('hello-world')
  })

  it('replaces non-alphanumeric with hyphens', () => {
    expect(cleanBranchName('hello world!')).toBe('hello-world')
  })

  it('collapses multiple hyphens', () => {
    expect(cleanBranchName('hello---world')).toBe('hello-world')
  })

  it('trims leading and trailing hyphens', () => {
    expect(cleanBranchName('-hello-world-')).toBe('hello-world')
  })

  it('handles empty string', () => {
    expect(cleanBranchName('')).toBe('')
  })

  it('handles string of only special chars', () => {
    expect(cleanBranchName('!!!')).toBe('')
  })

  // Property-based: output always matches the clean pattern
  fcTest.prop([fc.string({ minLength: 0, maxLength: 100 })])(
    'output matches /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/ or is empty',
    (input) => {
      const result = cleanBranchName(input)
      if (result.length === 0) {
        expect(result).toBe('')
      } else {
        expect(result).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
      }
    },
  )
})

// ─── formatBranchNumber ───────────────────────────────────────────────

describe('formatBranchNumber', () => {
  it('pads single digit to 3 chars', () => {
    expect(formatBranchNumber(1)).toBe('001')
  })

  it('pads double digit to 3 chars', () => {
    expect(formatBranchNumber(10)).toBe('010')
  })

  it('keeps triple digit as-is', () => {
    expect(formatBranchNumber(999)).toBe('999')
  })

  it('handles zero', () => {
    expect(formatBranchNumber(0)).toBe('000')
  })

  it('handles numbers over 999', () => {
    expect(formatBranchNumber(1000)).toBe('1000')
  })
})

// ─── getNextNumber ────────────────────────────────────────────────────

describe('getNextNumber', () => {
  it('returns 1 for empty array', () => {
    expect(getNextNumber([])).toBe(1)
  })

  it('returns max + 1 for sequential array', () => {
    expect(getNextNumber([1, 2, 3])).toBe(4)
  })

  it('returns max + 1 for non-sequential array', () => {
    expect(getNextNumber([5, 1, 3])).toBe(6)
  })

  it('handles single element', () => {
    expect(getNextNumber([42])).toBe(43)
  })

  it('handles duplicates', () => {
    expect(getNextNumber([3, 3, 3])).toBe(4)
  })
})

// ─── buildFullBranchName ──────────────────────────────────────────────

describe('buildFullBranchName', () => {
  it('combines number and suffix', () => {
    expect(buildFullBranchName(4, 'user-auth')).toBe('004-user-auth')
  })

  it('handles large number', () => {
    expect(buildFullBranchName(123, 'feature')).toBe('123-feature')
  })

  it('truncates suffix if total exceeds 244 bytes', () => {
    const longSuffix = 'a'.repeat(250)
    const result = buildFullBranchName(1, longSuffix)
    // 244 bytes max: "001-" = 4, so suffix max = 240
    expect(result.length).toBeLessThanOrEqual(244)
    expect(result.startsWith('001-')).toBe(true)
  })

  it('removes trailing hyphen after truncation', () => {
    // Create a suffix that when truncated at 240 chars would end with a hyphen
    // "aaa...aaa-bbb" where truncation lands right after the hyphen
    const segmentLen = 239
    const suffix = 'a'.repeat(segmentLen) + '-bbb'
    const result = buildFullBranchName(1, suffix)
    expect(result.length).toBeLessThanOrEqual(244)
    expect(result.endsWith('-')).toBe(false)
  })

  it('does not truncate when exactly at limit', () => {
    // "001-" = 4 chars, suffix = 240 chars => total = 244, exactly at limit
    const suffix = 'x'.repeat(240)
    const result = buildFullBranchName(1, suffix)
    expect(result.length).toBe(244)
    expect(result).toBe('001-' + suffix)
  })
})
