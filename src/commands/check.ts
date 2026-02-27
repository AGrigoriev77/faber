import chalk from 'chalk'

// --- Types ---

export type ToolStatus = 'found' | 'missing_required' | 'missing_optional'

export interface ToolCheckResult {
  readonly tool: string
  readonly status: ToolStatus
}

// --- Formatting (pure) ---

const statusFormat: Record<ToolStatus, { readonly icon: string; readonly label: string }> = {
  found:            { icon: chalk.green('✓'),  label: 'found' },
  missing_required: { icon: chalk.red('✗'),    label: 'missing (required)' },
  missing_optional: { icon: chalk.yellow('○'), label: 'missing (optional)' },
}

export const formatCheckResult = (result: ToolCheckResult): string => {
  const fmt = statusFormat[result.status]
  return `${fmt.icon} ${result.tool} — ${fmt.label}`
}
