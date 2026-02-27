import { describe, it, expect } from 'vitest'
import { test as fcTest } from '@fast-check/vitest'
import fc from 'fast-check'
import {
  extractBranchNumber,
  isFeatureBranch,
  buildFeaturePaths,
  findFeatureDirByPrefix,
} from '../../scripts/ts/common.ts'

describe('extractBranchNumber', () => {
  it('extracts number from valid feature branch', () => {
    expect(extractBranchNumber('004-user-auth')).toBe(4)
  })

  it('extracts number from branch with leading zeros', () => {
    expect(extractBranchNumber('001-init')).toBe(1)
    expect(extractBranchNumber('010-feature')).toBe(10)
    expect(extractBranchNumber('100-big')).toBe(100)
  })

  it('returns null for non-feature branches', () => {
    expect(extractBranchNumber('main')).toBeNull()
    expect(extractBranchNumber('develop')).toBeNull()
    expect(extractBranchNumber('feature/xyz')).toBeNull()
  })

  it('returns null for branches without 3-digit prefix', () => {
    expect(extractBranchNumber('04-short')).toBeNull()
    expect(extractBranchNumber('1-too-short')).toBeNull()
  })

  it('extracts from branches with longer numbers', () => {
    expect(extractBranchNumber('999-max')).toBe(999)
  })

  fcTest.prop([fc.integer({ min: 1, max: 999 }), fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/)])(
    'extractBranchNumber round-trips with formatted branches',
    (num, suffix) => {
      const padded = String(num).padStart(3, '0')
      const branch = `${padded}-${suffix}`
      expect(extractBranchNumber(branch)).toBe(num)
    },
  )
})

describe('isFeatureBranch', () => {
  it('returns true for valid feature branches', () => {
    expect(isFeatureBranch('001-init')).toBe(true)
    expect(isFeatureBranch('042-user-auth')).toBe(true)
    expect(isFeatureBranch('999-last')).toBe(true)
  })

  it('returns false for non-feature branches', () => {
    expect(isFeatureBranch('main')).toBe(false)
    expect(isFeatureBranch('develop')).toBe(false)
    expect(isFeatureBranch('feature/xyz')).toBe(false)
    expect(isFeatureBranch('04-short')).toBe(false)
    expect(isFeatureBranch('')).toBe(false)
  })
})

describe('buildFeaturePaths', () => {
  it('constructs all paths from repo root and branch', () => {
    const paths = buildFeaturePaths('/repo', '004-user-auth')
    expect(paths.repoRoot).toBe('/repo')
    expect(paths.currentBranch).toBe('004-user-auth')
    expect(paths.featureDir).toBe('/repo/specs/004-user-auth')
    expect(paths.featureSpec).toBe('/repo/specs/004-user-auth/spec.md')
    expect(paths.implPlan).toBe('/repo/specs/004-user-auth/plan.md')
    expect(paths.tasks).toBe('/repo/specs/004-user-auth/tasks.md')
    expect(paths.research).toBe('/repo/specs/004-user-auth/research.md')
    expect(paths.dataModel).toBe('/repo/specs/004-user-auth/data-model.md')
    expect(paths.quickstart).toBe('/repo/specs/004-user-auth/quickstart.md')
    expect(paths.contractsDir).toBe('/repo/specs/004-user-auth/contracts')
  })

  it('uses prefix-based lookup with specDirs', () => {
    const paths = buildFeaturePaths('/repo', '004-fix-bug', ['004-user-auth'])
    expect(paths.featureDir).toBe('/repo/specs/004-user-auth')
    expect(paths.featureSpec).toBe('/repo/specs/004-user-auth/spec.md')
  })

  it('falls back to branch name when no prefix match in specDirs', () => {
    const paths = buildFeaturePaths('/repo', '004-new', ['005-other'])
    expect(paths.featureDir).toBe('/repo/specs/004-new')
  })
})

describe('findFeatureDirByPrefix', () => {
  it('finds directory matching numeric prefix', () => {
    const result = findFeatureDirByPrefix(['004-user-auth', '005-payments'], '004')
    expect(result).toBe('004-user-auth')
  })

  it('returns null when no match', () => {
    const result = findFeatureDirByPrefix(['005-payments', '006-admin'], '004')
    expect(result).toBeNull()
  })

  it('returns first match when multiple exist', () => {
    const result = findFeatureDirByPrefix(['004-first', '004-second'], '004')
    expect(result).toBe('004-first')
  })

  it('returns null for empty array', () => {
    const result = findFeatureDirByPrefix([], '004')
    expect(result).toBeNull()
  })

  it('handles non-numeric prefix gracefully', () => {
    const result = findFeatureDirByPrefix(['004-auth'], 'main')
    expect(result).toBeNull()
  })
})
