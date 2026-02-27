import { join } from 'node:path'
import chalk from 'chalk'

// --- Types ---

export type ToolStatus = 'found' | 'missing_required' | 'missing_optional'

export type CheckCategory = 'tools' | 'structure' | 'templates' | 'scripts' | 'commands'

export interface ToolCheckResult {
  readonly tool: string
  readonly status: ToolStatus
}

export interface CheckItem {
  readonly category: CheckCategory
  readonly name: string
  readonly status: ToolStatus
}

export interface AgentInfo {
  readonly name: string
  readonly dir: string
  readonly extension: string
}

// --- Constants ---

export const EXPECTED_TEMPLATES: ReadonlyArray<string> = [
  'spec-template.md',
  'plan-template.md',
  'tasks-template.md',
  'constitution-template.md',
  'checklist-template.md',
  'agent-file-template.md',
]

export const EXPECTED_SCRIPTS: ReadonlyArray<string> = [
  'check-prerequisites.ts',
  'common.ts',
  'create-new-feature.ts',
  'setup-plan.ts',
  'update-agent-context.ts',
]

export const EXPECTED_COMMANDS: ReadonlyArray<string> = [
  'analyze',
  'checklist',
  'clarify',
  'constitution',
  'implement',
  'plan',
  'specify',
  'tasks',
  'taskstoissues',
  'test',
]

// --- Formatting (pure) ---

const statusFormat: Record<ToolStatus, { readonly icon: string; readonly label: string }> = {
  found:            { icon: chalk.green('✓'),  label: 'found' },
  missing_required: { icon: chalk.red('✗'),    label: 'missing (required)' },
  missing_optional: { icon: chalk.yellow('○'), label: 'missing (optional)' },
}

const CATEGORY_LABELS: Record<CheckCategory, string> = {
  tools: 'System Tools',
  structure: 'Project Structure',
  templates: 'Templates',
  scripts: 'Scripts',
  commands: 'Agent Commands',
}

export const formatCheckResult = (result: ToolCheckResult): string => {
  const fmt = statusFormat[result.status]
  return `${fmt.icon} ${result.tool} — ${fmt.label}`
}

export const formatCheckItem = (item: CheckItem): string => {
  const fmt = statusFormat[item.status]
  return `  ${fmt.icon} ${item.name} — ${fmt.label}`
}

export const formatCheckReport = (items: ReadonlyArray<CheckItem>, agentName?: string): string => {
  const categories: ReadonlyArray<CheckCategory> = ['tools', 'structure', 'templates', 'scripts', 'commands']

  const groups = items.reduce<Record<string, ReadonlyArray<CheckItem>>>((acc, item) => ({
    ...acc,
    [item.category]: [...(acc[item.category] ?? []), item],
  }), {})

  return categories
    .filter((cat) => groups[cat]?.length)
    .map((cat) => {
      const header = cat === 'commands' && agentName
        ? `${CATEGORY_LABELS[cat]} (${agentName})`
        : CATEGORY_LABELS[cat]
      const lines = (groups[cat] ?? []).map(formatCheckItem)
      return `${header}\n${lines.join('\n')}`
    })
    .join('\n\n')
}

export const summarizeCheck = (items: ReadonlyArray<CheckItem>): string => {
  const passed = items.filter((i) => i.status === 'found').length
  const total = items.length
  const icon = passed === total ? chalk.green('✓') : chalk.red('✗')
  return `${icon} ${passed}/${total} checks passed`
}

// --- Pure check list builder ---

export interface CheckEntry {
  readonly path: string
  readonly item: Omit<CheckItem, 'status'>
}

export const buildCheckList = (projectPath: string, agent?: AgentInfo): ReadonlyArray<CheckEntry> => {
  const faberDir = join(projectPath, '.faber')

  const structure: ReadonlyArray<CheckEntry> = [
    { path: faberDir, item: { category: 'structure', name: '.faber/' } },
    { path: join(faberDir, 'templates'), item: { category: 'structure', name: '.faber/templates/' } },
    { path: join(faberDir, 'scripts'), item: { category: 'structure', name: '.faber/scripts/' } },
  ]

  const templates: ReadonlyArray<CheckEntry> = EXPECTED_TEMPLATES.map((file) => ({
    path: join(faberDir, 'templates', file),
    item: { category: 'templates' as const, name: file },
  }))

  const scripts: ReadonlyArray<CheckEntry> = EXPECTED_SCRIPTS.map((file) => ({
    path: join(faberDir, 'scripts', file),
    item: { category: 'scripts' as const, name: file },
  }))

  const commands: ReadonlyArray<CheckEntry> = agent
    ? EXPECTED_COMMANDS.map((cmd) => ({
        path: join(projectPath, agent.dir, `faber.${cmd}${agent.extension}`),
        item: { category: 'commands' as const, name: `faber.${cmd}` },
      }))
    : []

  return [...structure, ...templates, ...scripts, ...commands]
}
