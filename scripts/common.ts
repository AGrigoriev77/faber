/**
 * Shared utilities for faber scripts.
 * Pure functions are exported for testing. I/O functions use async.
 */

import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

// ─── Types ─────────────────────────────────────────────────────────────

export interface FeaturePaths {
  readonly repoRoot: string
  readonly currentBranch: string
  readonly hasGit: boolean
  readonly featureDir: string
  readonly featureSpec: string
  readonly implPlan: string
  readonly tasks: string
  readonly research: string
  readonly dataModel: string
  readonly quickstart: string
  readonly contractsDir: string
}

// ─── Pure Functions ────────────────────────────────────────────────────

const FEATURE_BRANCH_RE = /^(\d{3})-/

/** Extract the numeric prefix from a feature branch name (e.g. "004-auth" → 4). */
export const extractBranchNumber = (branch: string): number | null => {
  const m = FEATURE_BRANCH_RE.exec(branch)
  return m ? parseInt(m[1]!, 10) : null
}

/** Check if a branch name matches the feature branch pattern `NNN-*`. */
export const isFeatureBranch = (branch: string): boolean =>
  FEATURE_BRANCH_RE.test(branch)

/** Find a spec directory that matches a given numeric prefix. */
export const findFeatureDirByPrefix = (
  specDirs: ReadonlyArray<string>,
  branchPrefix: string,
): string | null => {
  const match = specDirs.find((d) => d.startsWith(`${branchPrefix}-`))
  return match ?? null
}

/**
 * Build all feature paths from a repo root and branch name.
 * Optionally accepts existing spec directory names for prefix-based lookup.
 */
export const buildFeaturePaths = (
  repoRoot: string,
  branch: string,
  specDirs?: ReadonlyArray<string>,
): FeaturePaths => {
  const prefix = extractBranchNumber(branch)
  const prefixStr = prefix !== null ? String(prefix).padStart(3, '0') : null

  const resolvedDir =
    prefixStr !== null && specDirs
      ? findFeatureDirByPrefix(specDirs, prefixStr) ?? branch
      : branch

  const featureDir = join(repoRoot, 'specs', resolvedDir)

  return {
    repoRoot,
    currentBranch: branch,
    hasGit: false, // set by resolveFeaturePaths
    featureDir,
    featureSpec: join(featureDir, 'spec.md'),
    implPlan: join(featureDir, 'plan.md'),
    tasks: join(featureDir, 'tasks.md'),
    research: join(featureDir, 'research.md'),
    dataModel: join(featureDir, 'data-model.md'),
    quickstart: join(featureDir, 'quickstart.md'),
    contractsDir: join(featureDir, 'contracts'),
  }
}

// ─── I/O Functions ─────────────────────────────────────────────────────

/* v8 ignore start */
/** Build ancestor directory chain from start up to filesystem root. */
const ancestorDirs = (dir: string): ReadonlyArray<string> =>
  dir === dirname(dir) ? [] : [dir, ...ancestorDirs(dirname(dir))]

/** Search upward for `.git`, `.faber`, or `.specify` to find repo root. */
export const findRepoRoot = (startDir: string): string | null =>
  ancestorDirs(startDir).find((d) =>
    existsSync(join(d, '.git')) || existsSync(join(d, '.faber')) || existsSync(join(d, '.specify')),
  ) ?? null

/** Check if cwd is inside a git repo. */
export const hasGit = (cwd: string): boolean => {
  try {
    execSync('git rev-parse --show-toplevel', { cwd, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/** Get git repo root via `git rev-parse`. */
export const getGitRoot = (cwd: string): string | null => {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, stdio: 'pipe' })
      .toString()
      .trim()
  } catch {
    return null
  }
}

/** Get current branch name with fallback chain: env → git → specs scan → "main". */
export const getCurrentBranch = (cwd: string): string => {
  // 1. Environment variable
  if (process.env['SPECIFY_FEATURE']) {
    return process.env['SPECIFY_FEATURE']
  }

  // 2. Git
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      stdio: 'pipe',
    })
      .toString()
      .trim()
    if (branch) return branch
  } catch {
    // no git — continue
  }

  // 3. Scan specs/ for latest feature dir
  const repoRoot = findRepoRoot(cwd)
  if (repoRoot) {
    const specsDir = join(repoRoot, 'specs')
    if (existsSync(specsDir)) {
      const dirs = readdirSync(specsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)

      const latestFeature = dirs.reduce((best, name) => {
        const num = extractBranchNumber(name)
        const bestNum = extractBranchNumber(best)
        return num !== null && num > (bestNum ?? 0) ? name : best
      }, '')

      if (latestFeature) return latestFeature
    }
  }

  return 'main'
}

/** Resolve full FeaturePaths from the current working directory. */
export const resolveFeaturePaths = (cwd: string): FeaturePaths => {
  const gitAvailable = hasGit(cwd)
  const repoRoot = (gitAvailable ? getGitRoot(cwd) : null) ?? findRepoRoot(cwd) ?? cwd
  const branch = getCurrentBranch(cwd)

  // Scan specs/ for prefix-based lookup
  const specsDir = join(repoRoot, 'specs')
  const specDirs = existsSync(specsDir)
    ? readdirSync(specsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : []

  const paths = buildFeaturePaths(repoRoot, branch, specDirs)
  return { ...paths, hasGit: gitAvailable }
}

/** Validate feature branch — warns on non-git, errors on bad pattern. */
export const checkFeatureBranch = (
  branch: string,
  gitAvailable: boolean,
): { readonly ok: boolean; readonly message: string } => {
  if (!gitAvailable) {
    return {
      ok: true,
      message: '[faber] Warning: Git repository not detected; skipped branch validation',
    }
  }
  if (!isFeatureBranch(branch)) {
    return {
      ok: false,
      message: `ERROR: Not on a feature branch. Current branch: ${branch}\nFeature branches should be named like: 001-feature-name`,
    }
  }
  return { ok: true, message: '' }
}
