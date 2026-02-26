import chalk from 'chalk'
import { assertNever } from '../fp/types.ts'

// --- Types ---

export type UiMessage =
  | { readonly tag: 'error'; readonly text: string }
  | { readonly tag: 'success'; readonly text: string }
  | { readonly tag: 'warning'; readonly text: string }
  | { readonly tag: 'info'; readonly text: string }

// --- Formatting (pure, no side effects) ---

export const formatError = (message: string, tag?: string): string =>
  tag ? chalk.red(`[${tag}] ${message}`) : chalk.red(message)

export const formatSuccess = (message: string): string =>
  chalk.green(message)

export const formatWarning = (message: string): string =>
  chalk.yellow(message)

export const formatList = (items: ReadonlyArray<string>): string => {
  if (items.length === 0) return ''
  return items.map((item) => `  ${chalk.dim('•')} ${item}`).join('\n')
}

export const formatTable = (
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): string => {
  const allRows = [headers, ...rows]

  // Calculate column widths
  const colWidths = headers.map((_, colIdx) =>
    Math.max(...allRows.map((row) => (row[colIdx] ?? '').length)),
  )

  const formatRow = (row: ReadonlyArray<string>): string =>
    row.map((cell, i) => cell.padEnd(colWidths[i] ?? 0)).join('  ')

  const headerLine = formatRow(headers)
  const separator = colWidths.map((w) => '─'.repeat(w)).join('──')

  const dataLines = rows.map(formatRow)

  return [headerLine, separator, ...dataLines].join('\n')
}

// --- Output (impure — side effects) ---

export const printMessage = (msg: UiMessage): void => {
  switch (msg.tag) {
    case 'error':
      console.error(formatError(msg.text))
      break
    case 'success':
      console.log(formatSuccess(msg.text))
      break
    case 'warning':
      console.warn(formatWarning(msg.text))
      break
    case 'info':
      console.log(msg.text)
      break
    default:
      return assertNever(msg)
  }
}
