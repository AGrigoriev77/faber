/**
 * Consolidated prerequisite checking for faber commands.
 *
 * Validates that required files (plan.md, tasks.md, etc.) exist
 * for 7 faber commands: implement, analyze, tasks, test, taskstoissues, clarify, checklist.
 *
 * Pure functions are exported for testing; CLI logic is behind import.meta.main guard.
 */

import { existsSync, readdirSync } from 'node:fs'
import { resolveFeaturePaths, checkFeatureBranch } from './common.ts'

// ─── Constants ─────────────────────────────────────────────────────────

/** Canonical list of optional docs, in display order. */
const CANONICAL_DOCS: ReadonlyArray<string> = [
  'research.md',
  'data-model.md',
  'contracts/',
  'quickstart.md',
  'tasks.md',
]

// ─── Pure Functions ────────────────────────────────────────────────────

/**
 * Filter the canonical doc list to only include items present in `existing`.
 * Only include 'tasks.md' when `includeTasks` is true AND it is in `existing`.
 * Maintains canonical order regardless of input order.
 */
export const buildAvailableDocs = (
  existing: ReadonlyArray<string>,
  includeTasks: boolean,
): ReadonlyArray<string> => {
  const existingSet = new Set(existing)
  return CANONICAL_DOCS.filter((doc) => {
    if (doc === 'tasks.md') return includeTasks && existingSet.has(doc)
    return existingSet.has(doc)
  })
}

// ─── CLI arg parsing ───────────────────────────────────────────────────

interface CliFlags {
  readonly json: boolean
  readonly requireTasks: boolean
  readonly includeTasks: boolean
  readonly pathsOnly: boolean
  readonly requireSpec: boolean
}

const parseArgs = (argv: ReadonlyArray<string>): CliFlags => {
  const flags: CliFlags = {
    json: argv.includes('--json'),
    requireTasks: argv.includes('--require-tasks'),
    includeTasks: argv.includes('--include-tasks'),
    pathsOnly: argv.includes('--paths-only'),
    requireSpec: argv.includes('--require-spec'),
  }
  return flags
}

// ─── Helpers (CLI-only, not exported) ──────────────────────────────────

/* v8 ignore start */
/** Check which docs exist in the feature directory. */
const detectExistingDocs = (featureDir: string): ReadonlyArray<string> =>
  CANONICAL_DOCS.filter((doc) => {
    if (doc === 'contracts/') {
      const contractsPath = `${featureDir}/contracts`
      return (
        existsSync(contractsPath) &&
        readdirSync(contractsPath).length > 0
      )
    }
    return existsSync(`${featureDir}/${doc}`)
  })

const checkMark = (exists: boolean): string => (exists ? '\u2713' : '\u2717')

// ─── CLI entry point ───────────────────────────────────────────────────

/* v8 ignore start */
if (import.meta.main) {
  const flags = parseArgs(process.argv.slice(2))
  const paths = resolveFeaturePaths(process.cwd())

  // Validate feature branch
  const branchCheck = checkFeatureBranch(paths.currentBranch, paths.hasGit)
  if (!branchCheck.ok) {
    process.stderr.write(branchCheck.message + '\n')
    process.exit(1)
  }
  if (branchCheck.message) {
    process.stderr.write(branchCheck.message + '\n')
  }

  // ── Paths-only mode ──────────────────────────────────────────────────
  if (flags.pathsOnly) {
    if (flags.json) {
      const payload = {
        REPO_ROOT: paths.repoRoot,
        BRANCH: paths.currentBranch,
        FEATURE_DIR: paths.featureDir,
        FEATURE_SPEC: paths.featureSpec,
        IMPL_PLAN: paths.implPlan,
        TASKS: paths.tasks,
      }
      process.stdout.write(JSON.stringify(payload) + '\n')
    } else {
      process.stdout.write(`REPO_ROOT: ${paths.repoRoot}\n`)
      process.stdout.write(`BRANCH: ${paths.currentBranch}\n`)
      process.stdout.write(`FEATURE_DIR: ${paths.featureDir}\n`)
      process.stdout.write(`FEATURE_SPEC: ${paths.featureSpec}\n`)
      process.stdout.write(`IMPL_PLAN: ${paths.implPlan}\n`)
      process.stdout.write(`TASKS: ${paths.tasks}\n`)
    }
    process.exit(0)
  }

  // ── Validate required files ──────────────────────────────────────────
  if (!existsSync(paths.featureDir)) {
    process.stderr.write(`ERROR: Feature directory not found: ${paths.featureDir}\n`)
    process.stderr.write('Run /faber.specify first to create the feature structure.\n')
    process.exit(1)
  }

  if (flags.requireSpec && !existsSync(paths.featureSpec)) {
    process.stderr.write(`ERROR: spec.md not found in ${paths.featureDir}\n`)
    process.stderr.write('Run /faber.specify first to create the specification.\n')
    process.exit(1)
  }

  if (!existsSync(paths.implPlan)) {
    process.stderr.write(`ERROR: plan.md not found in ${paths.featureDir}\n`)
    process.stderr.write('Run /faber.plan first to create the implementation plan.\n')
    process.exit(1)
  }

  if (flags.requireTasks && !existsSync(paths.tasks)) {
    process.stderr.write(`ERROR: tasks.md not found in ${paths.featureDir}\n`)
    process.stderr.write('Run /faber.tasks first to create the task list.\n')
    process.exit(1)
  }

  // ── Build available docs ─────────────────────────────────────────────
  const existing = detectExistingDocs(paths.featureDir)
  const availableDocs = buildAvailableDocs(existing, flags.includeTasks)

  // ── Output ───────────────────────────────────────────────────────────
  if (flags.json) {
    const payload = {
      FEATURE_DIR: paths.featureDir,
      AVAILABLE_DOCS: availableDocs,
    }
    process.stdout.write(JSON.stringify(payload) + '\n')
  } else {
    process.stdout.write(`FEATURE_DIR:${paths.featureDir}\n`)
    process.stdout.write('AVAILABLE_DOCS:\n')

    const docsToShow = flags.includeTasks
      ? CANONICAL_DOCS
      : CANONICAL_DOCS.filter((d) => d !== 'tasks.md')

    docsToShow.forEach((doc) => {
      const exists = (existing as ReadonlyArray<string>).includes(doc)
      process.stdout.write(`  ${checkMark(exists)} ${doc}\n`)
    })
  }
}
