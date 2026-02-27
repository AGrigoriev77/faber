/**
 * create-new-feature.ts — TypeScript rewrite of create-new-feature.sh
 *
 * Creates a new feature branch and spec directory.
 * Pure functions are exported for testing.
 * CLI logic is behind `import.meta.main` guard.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractBranchNumber, findRepoRoot, hasGit, getGitRoot } from './common.ts'

// ─── Constants ────────────────────────────────────────────────────────

export const STOP_WORDS: ReadonlySet<string> = new Set([
  'i', 'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at',
  'by', 'with', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'can', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'my',
  'your', 'our', 'their', 'want', 'need', 'add', 'get', 'set',
])

const MAX_BRANCH_LENGTH = 244

// ─── Pure Functions ───────────────────────────────────────────────────

/** Lowercase, replace non-alphanumeric with `-`, collapse multiples, trim edges. */
export const cleanBranchName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

/**
 * Generate a branch name suffix from a description.
 * Filters stop words, keeps words >= 3 chars (or uppercase acronyms from original),
 * takes first 3-4 meaningful words.
 */
export const generateBranchName = (description: string): string => {
  // Build a set of uppercase acronyms from the original description
  const acronyms = new Set(
    description
      .split(/\s+/)
      .filter((w) => w.length > 0 && w === w.toUpperCase() && /^[A-Z0-9]+$/.test(w))
      .map((w) => w.toLowerCase()),
  )

  const cleanWords = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)

  const meaningful = cleanWords.flatMap((word) => {
    if (STOP_WORDS.has(word)) return []
    // Keep if length >= 3 OR if the word appeared as an uppercase acronym in original
    if (word.length >= 3 || acronyms.has(word)) return [word]
    return []
  })

  if (meaningful.length === 0) {
    // Fallback: clean entire description, filter stop words, take first 3 segments
    const cleaned = cleanBranchName(description)
    const segments = cleaned
      .split('-')
      .filter((s) => s.length > 0 && !STOP_WORDS.has(s))
    return segments.slice(0, 3).join('-')
  }

  const maxWords = meaningful.length === 4 ? 4 : 3
  return meaningful.slice(0, maxWords).join('-')
}

/** Pad number to 3-digit string: 4 -> "004". */
export const formatBranchNumber = (n: number): string =>
  String(n).padStart(3, '0')

/** Get next feature number from existing numbers. Returns 1 if empty. */
export const getNextNumber = (existing: ReadonlyArray<number>): number =>
  existing.length === 0 ? 1 : Math.max(...existing) + 1

/** Build full branch name "004-user-auth", truncating suffix if total > 244 bytes. */
export const buildFullBranchName = (num: number, suffix: string): string => {
  const prefix = formatBranchNumber(num)
  const full = `${prefix}-${suffix}`

  if (full.length <= MAX_BRANCH_LENGTH) return full

  // prefix + "-" = prefix.length + 1
  const maxSuffix = MAX_BRANCH_LENGTH - prefix.length - 1
  const truncated = suffix.slice(0, maxSuffix).replace(/-+$/, '')
  return `${prefix}-${truncated}`
}

// ─── I/O Helpers ──────────────────────────────────────────────────────

/** Extract feature numbers from git branches (local + remote). */
const getNumbersFromBranches = (cwd: string): ReadonlyArray<number> => {
  try {
    execSync('git fetch --all --prune', { cwd, stdio: 'pipe' })
  } catch {
    // no remotes — ignore
  }

  try {
    const output = execSync('git branch -a', { cwd, stdio: 'pipe' }).toString()
    return output
      .split('\n')
      .map((line) => line.replace(/^[* ]+/, '').replace(/^remotes\/[^/]+\//, '').trim())
      .filter((name) => name.length > 0)
      .flatMap((name) => {
        const num = extractBranchNumber(name)
        return num !== null ? [num] : []
      })
  } catch {
    return []
  }
}

/** Extract feature numbers from specs/ directory names. */
const getNumbersFromSpecs = (specsDir: string): ReadonlyArray<number> => {
  if (!existsSync(specsDir)) return []
  return readdirSync(specsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const num = extractBranchNumber(d.name)
      return num !== null ? [num] : []
    })
}

// ─── Argument Parsing ─────────────────────────────────────────────────

interface ParsedArgs {
  readonly json: boolean
  readonly shortName: string
  readonly number: number | null
  readonly description: string
}

interface ParseState {
  readonly json: boolean
  readonly shortName: string
  readonly number: number | null
  readonly args: ReadonlyArray<string>
  readonly pendingFlag: string
}

const parseArgs = (argv: ReadonlyArray<string>): ParsedArgs => {
  const state = argv.reduce<ParseState>(
    (acc, arg) => {
      if (acc.pendingFlag === '--short-name') {
        if (arg.startsWith('--')) {
          process.stderr.write('Error: --short-name requires a value\n')
          process.exit(1)
        }
        return { ...acc, shortName: arg, pendingFlag: '' }
      }
      if (acc.pendingFlag === '--number') {
        if (arg.startsWith('--')) {
          process.stderr.write('Error: --number requires a value\n')
          process.exit(1)
        }
        return { ...acc, number: parseInt(arg, 10), pendingFlag: '' }
      }

      if (arg === '--json') return { ...acc, json: true }
      if (arg === '--short-name' || arg === '--number') return { ...acc, pendingFlag: arg }
      if (arg === '--help' || arg === '-h') {
        process.stdout.write(
          `Usage: create-new-feature [--json] [--short-name <name>] [--number N] <description...>\n\n` +
          `Options:\n` +
          `  --json              Output in JSON format\n` +
          `  --short-name <name> Provide a custom short name for the branch\n` +
          `  --number N          Specify branch number manually\n` +
          `  --help, -h          Show this help message\n`,
        )
        process.exit(0)
      }
      return { ...acc, args: [...acc.args, arg] }
    },
    { json: false, shortName: '', number: null, args: [], pendingFlag: '' },
  )

  if (state.pendingFlag) {
    process.stderr.write(`Error: ${state.pendingFlag} requires a value\n`)
    process.exit(1)
  }

  return {
    json: state.json,
    shortName: state.shortName,
    number: state.number,
    description: state.args.join(' '),
  }
}

// ─── Main (CLI) ───────────────────────────────────────────────────────

/* v8 ignore start */

if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2))

  if (!parsed.description) {
    process.stderr.write(
      'Usage: create-new-feature [--json] [--short-name <name>] [--number N] <description...>\n',
    )
    process.exit(1)
  }

  // Resolve repo root
  const gitAvailable = hasGit(process.cwd())
  const repoRoot =
    (gitAvailable ? getGitRoot(process.cwd()) : null) ??
    findRepoRoot(process.cwd()) ??
    null

  if (!repoRoot) {
    process.stderr.write(
      'Error: Could not determine repository root. Please run this script from within the repository.\n',
    )
    process.exit(1)
  }

  const specsDir = join(repoRoot, 'specs')
  mkdirSync(specsDir, { recursive: true })

  // Collect existing feature numbers
  const branchNums = gitAvailable ? getNumbersFromBranches(repoRoot) : []
  const specNums = getNumbersFromSpecs(specsDir)
  const allNums = [...branchNums, ...specNums]

  // Determine next number
  const featureNumber = parsed.number ?? getNextNumber(allNums)

  // Generate branch suffix
  const branchSuffix = parsed.shortName
    ? cleanBranchName(parsed.shortName)
    : generateBranchName(parsed.description)

  const branchName = buildFullBranchName(featureNumber, branchSuffix)
  const featureNum = formatBranchNumber(featureNumber)

  // Create branch if git available
  if (gitAvailable) {
    execSync(`git checkout -b ${branchName}`, { cwd: repoRoot, stdio: 'pipe' })
  } else {
    process.stderr.write(
      `[faber] Warning: Git repository not detected; skipped branch creation for ${branchName}\n`,
    )
  }

  // Create spec directory and file
  const featureDir = join(specsDir, branchName)
  mkdirSync(featureDir, { recursive: true })

  const template = join(repoRoot, '.faber', 'templates', 'spec-template.md')
  const specFile = join(featureDir, 'spec.md')

  if (existsSync(template)) {
    copyFileSync(template, specFile)
  } else {
    writeFileSync(specFile, '')
  }

  // Set environment variable
  process.env['SPECIFY_FEATURE'] = branchName

  // Output
  if (parsed.json) {
    process.stdout.write(
      JSON.stringify({
        BRANCH_NAME: branchName,
        SPEC_FILE: specFile,
        FEATURE_NUM: featureNum,
      }) + '\n',
    )
  } else {
    process.stdout.write(`BRANCH_NAME: ${branchName}\n`)
    process.stdout.write(`SPEC_FILE: ${specFile}\n`)
    process.stdout.write(`FEATURE_NUM: ${featureNum}\n`)
    process.stdout.write(`SPECIFY_FEATURE environment variable set to: ${branchName}\n`)
  }
}
