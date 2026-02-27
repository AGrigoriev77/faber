/**
 * Update AI agent context files with information from plan.md.
 * Called by `faber plan` command.
 *
 * Pure functions are exported for testing. CLI logic is behind import.meta.main guard.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveFeaturePaths } from './common.ts'

// ─── Types ──────────────────────────────────────────────────────────────

export interface PlanData {
  readonly lang: string
  readonly framework: string
  readonly db: string
  readonly projectType: string
}

interface AgentEntry {
  readonly path: string
  readonly name: string
}

// ─── Constants ──────────────────────────────────────────────────────────

const SKIP_VALUES = ['NEEDS CLARIFICATION', 'N/A'] as const

const isSkipValue = (value: string): boolean =>
  SKIP_VALUES.some((sv) => value.includes(sv))

export const AGENT_FILE_PATHS: ReadonlyMap<string, AgentEntry> = new Map<string, AgentEntry>([
  ['claude', { path: 'CLAUDE.md', name: 'Claude Code' }],
  ['gemini', { path: 'GEMINI.md', name: 'Gemini CLI' }],
  ['copilot', { path: '.github/agents/copilot-instructions.md', name: 'GitHub Copilot' }],
  ['cursor-agent', { path: '.cursor/rules/specify-rules.mdc', name: 'Cursor IDE' }],
  ['qwen', { path: 'QWEN.md', name: 'Qwen Code' }],
  ['opencode', { path: 'AGENTS.md', name: 'opencode' }],
  ['codex', { path: 'AGENTS.md', name: 'Codex CLI' }],
  ['windsurf', { path: '.windsurf/rules/specify-rules.md', name: 'Windsurf' }],
  ['kilocode', { path: '.kilocode/rules/specify-rules.md', name: 'Kilo Code' }],
  ['auggie', { path: '.augment/rules/specify-rules.md', name: 'Auggie CLI' }],
  ['roo', { path: '.roo/rules/specify-rules.md', name: 'Roo Code' }],
  ['codebuddy', { path: 'CODEBUDDY.md', name: 'CodeBuddy CLI' }],
  ['qodercli', { path: 'QODER.md', name: 'Qoder CLI' }],
  ['amp', { path: 'AGENTS.md', name: 'Amp' }],
  ['shai', { path: 'SHAI.md', name: 'SHAI' }],
  ['q', { path: 'AGENTS.md', name: 'Amazon Q Developer CLI' }],
  ['agy', { path: '.agent/rules/specify-rules.md', name: 'Antigravity' }],
  ['bob', { path: 'AGENTS.md', name: 'IBM Bob' }],
])

// ─── Pure Functions ─────────────────────────────────────────────────────

/**
 * Extract a field value from plan.md content by pattern.
 * Looks for `**fieldPattern**: value` lines.
 * Returns null for missing, "NEEDS CLARIFICATION", or "N/A" values.
 */
export const extractPlanField = (content: string, fieldPattern: string): string | null => {
  const regex = new RegExp(`^\\*\\*${escapeRegex(fieldPattern)}\\*\\*:\\s*(.+)$`, 'm')
  const match = regex.exec(content)
  if (!match) return null

  const value = match[1]!.trim()
  return isSkipValue(value) ? null : value
}

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Format technology stack string from language and framework.
 * Skips "NEEDS CLARIFICATION" and "N/A" parts.
 */
export const formatTechStack = (lang: string, framework: string): string => {
  const parts = [lang, framework]
    .filter((v) => v !== '' && !isSkipValue(v))
  return parts.join(' + ')
}

/**
 * Get project directory structure based on project type.
 */
export const getProjectStructure = (projectType: string): string =>
  projectType.includes('web')
    ? 'backend/\nfrontend/\ntests/'
    : 'src/\ntests/'

/**
 * Get build/test commands appropriate for the given language.
 */
export const getCommandsForLanguage = (lang: string): string => {
  if (lang.includes('Python')) return 'cd src && pytest && ruff check .'
  if (lang.includes('Rust')) return 'cargo test && cargo clippy'
  if (lang.includes('JavaScript') || lang.includes('TypeScript')) return 'npm test && npm run lint'
  return `# Add commands for ${lang}`
}

/**
 * Parse plan.md content into structured data.
 */
export const parsePlanData = (content: string): PlanData => ({
  lang: extractPlanField(content, 'Language/Version') ?? '',
  framework: extractPlanField(content, 'Primary Dependencies') ?? '',
  db: extractPlanField(content, 'Storage') ?? '',
  projectType: extractPlanField(content, 'Project Type') ?? '',
})

/**
 * Update existing agent file content with new tech stack / changes.
 * Pure string transformation -- no I/O.
 */
export const updateExistingContent = (
  content: string,
  techStack: string,
  db: string,
  branch: string,
  date: string,
): string => {
  const lines = content.split('\n')

  // Determine which new tech entries to add (skip duplicates)
  const newTechEntries: ReadonlyArray<string> = [
    ...(techStack !== '' && !content.includes(techStack)
      ? [`- ${techStack} (${branch})`]
      : []),
    ...(isValidDb(db) && !content.includes(db)
      ? [`- ${db} (${branch})`]
      : []),
  ]

  // Build new change entry
  const newChangeEntry = buildChangeEntry(techStack, db, branch)

  const hasTechSection = lines.some((l) => l === '## Active Technologies')
  const hasChangesSection = lines.some((l) => l === '## Recent Changes')

  // Process lines through a fold
  const state = lines.reduce(
    (acc, line) => processLine(acc, line, newTechEntries, newChangeEntry, date),
    {
      output: [] as ReadonlyArray<string>,
      inTechSection: false,
      inChangesSection: false,
      techEntriesAdded: false,
      changesEntryAdded: false,
      oldChangesCount: 0,
    },
  )

  // Handle end-of-file tech section (never closed by another heading)
  const outputAfterTech = state.inTechSection && !state.techEntriesAdded && newTechEntries.length > 0
    ? [...state.output, ...newTechEntries]
    : [...state.output]

  // Append missing sections
  const outputAfterAppends = appendMissingSections(
    outputAfterTech,
    hasTechSection,
    hasChangesSection,
    newTechEntries,
    newChangeEntry,
  )

  return outputAfterAppends.join('\n')
}

// ─── Internal helpers for updateExistingContent ─────────────────────────

const isValidDb = (db: string): boolean =>
  db !== '' && !isSkipValue(db)

const buildChangeEntry = (techStack: string, db: string, branch: string): string => {
  if (techStack !== '') return `- ${branch}: Added ${techStack}`
  if (isValidDb(db)) return `- ${branch}: Added ${db}`
  return ''
}

interface LineState {
  readonly output: ReadonlyArray<string>
  readonly inTechSection: boolean
  readonly inChangesSection: boolean
  readonly techEntriesAdded: boolean
  readonly changesEntryAdded: boolean
  readonly oldChangesCount: number
}

const isHeading = (line: string): boolean => /^## /.test(line)

const processLine = (
  state: LineState,
  line: string,
  newTechEntries: ReadonlyArray<string>,
  newChangeEntry: string,
  date: string,
): LineState => {
  // Entering Active Technologies section
  if (line === '## Active Technologies') {
    return { ...state, output: [...state.output, line], inTechSection: true, inChangesSection: false }
  }

  // Exiting tech section via next heading
  if (state.inTechSection && isHeading(line)) {
    const techLines = !state.techEntriesAdded && newTechEntries.length > 0
      ? [...state.output, ...newTechEntries, line]
      : [...state.output, line]
    return {
      ...state,
      output: techLines,
      inTechSection: false,
      techEntriesAdded: true,
      ...(line === '## Recent Changes' ? { inChangesSection: true } : {}),
      // If this heading is Recent Changes, add the change entry right after
      ...(line === '## Recent Changes' && newChangeEntry !== ''
        ? { output: [...techLines.slice(0, -1), line, newChangeEntry], changesEntryAdded: true, inChangesSection: true }
        : {}),
    }
  }

  // Exiting tech section via empty line -- add entries before empty line
  if (state.inTechSection && line === '' && !state.techEntriesAdded && newTechEntries.length > 0) {
    return {
      ...state,
      output: [...state.output, ...newTechEntries, line],
      techEntriesAdded: true,
    }
  }

  // Entering Recent Changes section
  if (line === '## Recent Changes' && !state.inTechSection) {
    const baseOutput = [...state.output, line]
    return {
      ...state,
      output: newChangeEntry !== '' ? [...baseOutput, newChangeEntry] : baseOutput,
      inChangesSection: true,
      changesEntryAdded: newChangeEntry !== '',
    }
  }

  // Exiting changes section via next heading
  if (state.inChangesSection && isHeading(line)) {
    return { ...state, output: [...state.output, line], inChangesSection: false }
  }

  // Inside changes section, limit old list entries to 2
  if (state.inChangesSection && line.startsWith('- ')) {
    return state.oldChangesCount < 2
      ? { ...state, output: [...state.output, line], oldChangesCount: state.oldChangesCount + 1 }
      : state // skip this old entry (over limit)
  }

  // Update timestamp line
  if (/\*\*Last updated\*\*:.*\d{4}-\d{2}-\d{2}/.test(line)) {
    const updated = line.replace(/\d{4}-\d{2}-\d{2}/, date)
    return { ...state, output: [...state.output, updated] }
  }

  // Default: pass through
  return { ...state, output: [...state.output, line] }
}

const appendMissingSections = (
  output: ReadonlyArray<string>,
  hasTechSection: boolean,
  hasChangesSection: boolean,
  newTechEntries: ReadonlyArray<string>,
  newChangeEntry: string,
): ReadonlyArray<string> => {
  const withTech = !hasTechSection && newTechEntries.length > 0
    ? [...output, '', '## Active Technologies', ...newTechEntries]
    : [...output]

  return !hasChangesSection && newChangeEntry !== ''
    ? [...withTech, '', '## Recent Changes', newChangeEntry]
    : withTech
}

// ─── CLI (impure shell) ─────────────────────────────────────────────────

/* v8 ignore start */
const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}

const updateAgentFile = (
  repoRoot: string,
  agentPath: string,
  agentName: string,
  planData: PlanData,
  branch: string,
  date: string,
  templatePath: string,
): void => {
  const fullPath = join(repoRoot, agentPath)
  const techStack = formatTechStack(planData.lang, planData.framework)

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8')
    const updated = updateExistingContent(content, techStack, planData.db, branch, date)
    writeFileSync(fullPath, updated, 'utf-8')
    log(`Updated existing ${agentName} context file: ${fullPath}`)
  } else {
    // Create new file from template
    const dir = dirname(fullPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    if (existsSync(templatePath)) {
      const template = readFileSync(templatePath, 'utf-8')
      const projectName = repoRoot.split('/').pop() ?? 'project'
      const projectStructure = getProjectStructure(planData.projectType)
      const commands = getCommandsForLanguage(planData.lang)

      const techEntry = techStack !== ''
        ? `- ${techStack} (${branch})`
        : `- (${branch})`
      const changeEntry = techStack !== ''
        ? `- ${branch}: Added ${techStack}`
        : `- ${branch}: Added`

      const filled = template
        .replace(/\[PROJECT NAME\]/g, projectName)
        .replace(/\[DATE\]/g, date)
        .replace(/\[EXTRACTED FROM ALL PLAN\.MD FILES\]/g, techEntry)
        .replace(/\[ACTUAL STRUCTURE FROM PLANS\]/g, projectStructure)
        .replace(/\[ONLY COMMANDS FOR ACTIVE TECHNOLOGIES\]/g, commands)
        .replace(/\[LANGUAGE-SPECIFIC, ONLY FOR LANGUAGES IN USE\]/g, `${planData.lang}: Follow standard conventions`)
        .replace(/\[LAST 3 FEATURES AND WHAT THEY ADDED\]/g, changeEntry)

      writeFileSync(fullPath, filled, 'utf-8')
      log(`Created new ${agentName} context file: ${fullPath}`)
    } else {
      log(`WARNING: Template not found at ${templatePath}, cannot create ${agentName} file`)
    }
  }
}

/* v8 ignore start */
if (import.meta.main) {
  const agentType = process.argv[2] ?? ''
  const cwd = process.cwd()
  const paths = resolveFeaturePaths(cwd)
  const date = new Date().toISOString().slice(0, 10)

  if (!existsSync(paths.implPlan)) {
    log(`ERROR: No plan.md found at ${paths.implPlan}`)
    process.exit(1)
  }

  const planContent = readFileSync(paths.implPlan, 'utf-8')
  const planData = parsePlanData(planContent)
  const templatePath = join(paths.repoRoot, '.specify', 'templates', 'agent-file-template.md')

  log(`=== Updating agent context files for feature ${paths.currentBranch} ===`)

  if (agentType !== '') {
    const entry = AGENT_FILE_PATHS.get(agentType)
    if (!entry) {
      log(`ERROR: Unknown agent type '${agentType}'`)
      process.exit(1)
    }
    updateAgentFile(paths.repoRoot, entry.path, entry.name, planData, paths.currentBranch, date, templatePath)
  } else {
    // Deduplicate by path, keep only entries with existing files
    const uniqueExisting = [...AGENT_FILE_PATHS.values()]
      .reduce<ReadonlyArray<AgentEntry>>((acc, entry) =>
        acc.some((e) => e.path === entry.path) ? acc : [...acc, entry],
      [])
      .filter((entry) => existsSync(join(paths.repoRoot, entry.path)))

    if (uniqueExisting.length === 0) {
      log('No existing agent files found, creating default Claude file...')
      const claude = AGENT_FILE_PATHS.get('claude')!
      updateAgentFile(paths.repoRoot, claude.path, claude.name, planData, paths.currentBranch, date, templatePath)
    } else {
      uniqueExisting.forEach((entry) =>
        updateAgentFile(paths.repoRoot, entry.path, entry.name, planData, paths.currentBranch, date, templatePath),
      )
    }
  }

  log('Agent context update completed successfully')
}
