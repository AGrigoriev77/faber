import chalk from 'chalk'

// --- Types ---

export interface ToolCheckResult {
  readonly tool: string
  readonly found: boolean
  readonly required: boolean
}

// --- Formatting (pure) ---

export const formatCheckResult = (result: ToolCheckResult): string => {
  if (result.found) {
    return `${chalk.green('✓')} ${result.tool} — found`
  }

  if (result.required) {
    return `${chalk.red('✗')} ${result.tool} — missing (required)`
  }

  return `${chalk.yellow('○')} ${result.tool} — missing (optional)`
}
