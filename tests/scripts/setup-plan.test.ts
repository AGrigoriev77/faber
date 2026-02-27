import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  setupPlan,
  formatOutput,
  type SetupPlanResult,
} from '../../scripts/setup-plan.ts'

describe('setupPlan', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'faber-setup-plan-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates feature dir when it does not exist', () => {
    const featureDir = join(tempDir, 'specs', '001-my-feature')
    const implPlan = join(featureDir, 'plan.md')

    const result = setupPlan({
      repoRoot: tempDir,
      featureDir,
      featureSpec: join(featureDir, 'spec.md'),
      implPlan,
      currentBranch: '001-my-feature',
      hasGit: true,
    })

    expect(result.ok).toBe(true)
    expect(existsSync(featureDir)).toBe(true)
  })

  it('copies plan template when it exists', () => {
    const featureDir = join(tempDir, 'specs', '001-my-feature')
    const implPlan = join(featureDir, 'plan.md')
    const templateDir = join(tempDir, '.specify', 'templates')
    const templatePath = join(templateDir, 'plan-template.md')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(templatePath, '# Plan Template\n\nContent here.')

    const result = setupPlan({
      repoRoot: tempDir,
      featureDir,
      featureSpec: join(featureDir, 'spec.md'),
      implPlan,
      currentBranch: '001-my-feature',
      hasGit: true,
    })

    expect(result.ok).toBe(true)
    expect(existsSync(implPlan)).toBe(true)
    expect(readFileSync(implPlan, 'utf-8')).toBe('# Plan Template\n\nContent here.')
  })

  it('creates empty plan.md when template does not exist', () => {
    const featureDir = join(tempDir, 'specs', '001-my-feature')
    const implPlan = join(featureDir, 'plan.md')

    const result = setupPlan({
      repoRoot: tempDir,
      featureDir,
      featureSpec: join(featureDir, 'spec.md'),
      implPlan,
      currentBranch: '001-my-feature',
      hasGit: true,
    })

    expect(result.ok).toBe(true)
    expect(existsSync(implPlan)).toBe(true)
    expect(readFileSync(implPlan, 'utf-8')).toBe('')
  })

  it('does not overwrite feature dir if it already exists', () => {
    const featureDir = join(tempDir, 'specs', '001-my-feature')
    const existingFile = join(featureDir, 'existing.md')

    mkdirSync(featureDir, { recursive: true })
    writeFileSync(existingFile, 'keep me')

    const implPlan = join(featureDir, 'plan.md')

    setupPlan({
      repoRoot: tempDir,
      featureDir,
      featureSpec: join(featureDir, 'spec.md'),
      implPlan,
      currentBranch: '001-my-feature',
      hasGit: true,
    })

    expect(readFileSync(existingFile, 'utf-8')).toBe('keep me')
  })

  it('returns correct paths in result', () => {
    const featureDir = join(tempDir, 'specs', '001-my-feature')
    const implPlan = join(featureDir, 'plan.md')
    const featureSpec = join(featureDir, 'spec.md')

    const result = setupPlan({
      repoRoot: tempDir,
      featureDir,
      featureSpec,
      implPlan,
      currentBranch: '001-my-feature',
      hasGit: true,
    })

    expect(result).toEqual({
      ok: true,
      featureSpec,
      implPlan,
      specsDir: featureDir,
      branch: '001-my-feature',
      hasGit: true,
      templateCopied: false,
    })
  })

  it('sets templateCopied to true when template is copied', () => {
    const featureDir = join(tempDir, 'specs', '001-my-feature')
    const implPlan = join(featureDir, 'plan.md')
    const templateDir = join(tempDir, '.specify', 'templates')

    mkdirSync(templateDir, { recursive: true })
    writeFileSync(join(templateDir, 'plan-template.md'), '# Template')

    const result = setupPlan({
      repoRoot: tempDir,
      featureDir,
      featureSpec: join(featureDir, 'spec.md'),
      implPlan,
      currentBranch: '001-my-feature',
      hasGit: true,
    })

    expect(result.templateCopied).toBe(true)
  })
})

describe('formatOutput', () => {
  const result: SetupPlanResult = {
    ok: true,
    featureSpec: '/repo/specs/001-feat/spec.md',
    implPlan: '/repo/specs/001-feat/plan.md',
    specsDir: '/repo/specs/001-feat',
    branch: '001-feat',
    hasGit: true,
    templateCopied: true,
  }

  it('outputs correct JSON in --json mode', () => {
    const output = formatOutput(result, true)
    const parsed = JSON.parse(output) as Record<string, string>

    expect(parsed).toEqual({
      FEATURE_SPEC: '/repo/specs/001-feat/spec.md',
      IMPL_PLAN: '/repo/specs/001-feat/plan.md',
      SPECS_DIR: '/repo/specs/001-feat',
      BRANCH: '001-feat',
      HAS_GIT: 'true',
    })
  })

  it('outputs correct JSON with hasGit false', () => {
    const noGitResult: SetupPlanResult = { ...result, hasGit: false }
    const output = formatOutput(noGitResult, true)
    const parsed = JSON.parse(output) as Record<string, string>

    expect(parsed['HAS_GIT']).toBe('false')
  })

  it('outputs correct text in non-json mode', () => {
    const output = formatOutput(result, false)

    expect(output).toContain('FEATURE_SPEC: /repo/specs/001-feat/spec.md')
    expect(output).toContain('IMPL_PLAN: /repo/specs/001-feat/plan.md')
    expect(output).toContain('SPECS_DIR: /repo/specs/001-feat')
    expect(output).toContain('BRANCH: 001-feat')
    expect(output).toContain('HAS_GIT: true')
  })

  it('text output has exactly 5 lines', () => {
    const output = formatOutput(result, false)
    const lines = output.split('\n').filter((l) => l.length > 0)

    expect(lines).toHaveLength(5)
  })
})
