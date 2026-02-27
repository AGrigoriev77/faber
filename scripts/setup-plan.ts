/**
 * setup-plan.ts — Initialize the plan file for a feature.
 * Called by `faber plan` command.
 *
 * Pure functions are exported for testing; CLI runs behind import.meta.main.
 */

import { mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveFeaturePaths, checkFeatureBranch } from './common.ts'

// ─── Types ─────────────────────────────────────────────────────────────

export interface SetupPlanInput {
  readonly repoRoot: string
  readonly featureDir: string
  readonly featureSpec: string
  readonly implPlan: string
  readonly currentBranch: string
  readonly hasGit: boolean
}

export interface SetupPlanResult {
  readonly ok: boolean
  readonly featureSpec: string
  readonly implPlan: string
  readonly specsDir: string
  readonly branch: string
  readonly hasGit: boolean
  readonly templateCopied: boolean
}

// ─── Pure Functions ────────────────────────────────────────────────────

/** Format the result for CLI output. */
export const formatOutput = (result: SetupPlanResult, json: boolean): string =>
  json
    ? JSON.stringify({
        FEATURE_SPEC: result.featureSpec,
        IMPL_PLAN: result.implPlan,
        SPECS_DIR: result.specsDir,
        BRANCH: result.branch,
        HAS_GIT: String(result.hasGit),
      })
    : [
        `FEATURE_SPEC: ${result.featureSpec}`,
        `IMPL_PLAN: ${result.implPlan}`,
        `SPECS_DIR: ${result.specsDir}`,
        `BRANCH: ${result.branch}`,
        `HAS_GIT: ${result.hasGit}`,
      ].join('\n')

// ─── I/O Functions ─────────────────────────────────────────────────────

/** Create feature dir, copy or create plan.md, return result. */
export const setupPlan = (input: SetupPlanInput): SetupPlanResult => {
  mkdirSync(input.featureDir, { recursive: true })

  const templatePath = join(input.repoRoot, '.specify', 'templates', 'plan-template.md')
  const templateExists = existsSync(templatePath)

  if (templateExists) {
    copyFileSync(templatePath, input.implPlan)
  } else {
    writeFileSync(input.implPlan, '')
  }

  return {
    ok: true,
    featureSpec: input.featureSpec,
    implPlan: input.implPlan,
    specsDir: input.featureDir,
    branch: input.currentBranch,
    hasGit: input.hasGit,
    templateCopied: templateExists,
  }
}

// ─── CLI Entry Point ───────────────────────────────────────────────────

/* v8 ignore start */
const parseArgs = (argv: ReadonlyArray<string>): { readonly json: boolean } => ({
  json: argv.includes('--json'),
})
if (import.meta.main) {
  const { json } = parseArgs(process.argv.slice(2))
  const paths = resolveFeaturePaths(process.cwd())

  const branchCheck = checkFeatureBranch(paths.currentBranch, paths.hasGit)
  if (branchCheck.message) {
    console.error(branchCheck.message)
  }
  if (!branchCheck.ok) {
    process.exit(1)
  }

  const result = setupPlan({
    repoRoot: paths.repoRoot,
    featureDir: paths.featureDir,
    featureSpec: paths.featureSpec,
    implPlan: paths.implPlan,
    currentBranch: paths.currentBranch,
    hasGit: paths.hasGit,
  })

  console.log(formatOutput(result, json))
}
