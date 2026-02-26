import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

export interface AgentFormat {
  readonly dir: string
  readonly format: 'markdown' | 'toml'
  readonly args: string
  readonly extension: string
}

export type RegistrarError = {
  readonly tag: 'unsupported_agent'
  readonly agent: string
}

type Frontmatter = Record<string, unknown>

const formats: ReadonlyArray<readonly [string, AgentFormat]> = [
  ['amp',       { dir: '.agents/commands',   format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['auggie',    { dir: '.augment/rules',     format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['bob',       { dir: '.bob/commands',      format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['claude',    { dir: '.claude/commands',   format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['codebuddy', { dir: '.codebuddy/commands',format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['copilot',   { dir: '.github/agents',     format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['cursor',    { dir: '.cursor/commands',   format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['gemini',    { dir: '.gemini/commands',   format: 'toml',     args: '{{args}}',   extension: '.toml' }],
  ['kilocode',  { dir: '.kilocode/rules',    format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['opencode',  { dir: '.opencode/command',  format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['q',         { dir: '.amazonq/prompts',   format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['qodercli',  { dir: '.qoder/commands',    format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['qwen',      { dir: '.qwen/commands',     format: 'toml',     args: '{{args}}',   extension: '.toml' }],
  ['roo',       { dir: '.roo/rules',         format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['shai',      { dir: '.shai/commands',     format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
  ['windsurf',  { dir: '.windsurf/workflows',format: 'markdown', args: '$ARGUMENTS', extension: '.md' }],
]

export const AGENT_FORMATS: ReadonlyMap<string, AgentFormat> = new Map(formats)

export const getAgentFormat = (agent: string): Result<AgentFormat, RegistrarError> => {
  const fmt = AGENT_FORMATS.get(agent)
  return fmt ? ok(fmt) : err({ tag: 'unsupported_agent', agent })
}

export const parseFrontmatter = (content: string): readonly [Frontmatter, string] => {
  if (!content.startsWith('---')) return [{}, content]

  const end = content.indexOf('---', 3)
  if (end === -1) return [{}, content]

  const fmStr = content.slice(3, end).trim()
  const body = content.slice(end + 3).trim()

  try {
    const parsed = parseYaml(fmStr)
    if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
      return [{}, body]
    }
    return [parsed as Frontmatter, body]
  } catch {
    return [{}, body]
  }
}

export const renderFrontmatter = (fm: Frontmatter): string => {
  if (Object.keys(fm).length === 0) return ''
  const yaml = stringifyYaml(fm, { sortMapEntries: false })
  return `---\n${yaml}---\n`
}

export const renderMarkdownCommand = (fm: Frontmatter, body: string, extId: string): string => {
  const context = `\n<!-- Extension: ${extId} -->\n<!-- Config: .faber/extensions/${extId}/ -->\n`
  return renderFrontmatter(fm) + context + body
}

export const renderTomlCommand = (fm: Frontmatter, body: string, extId: string): string => {
  const lines: string[] = []

  if (fm['description']) {
    const desc = String(fm['description']).replace(/"/g, '\\"')
    lines.push(`description = "${desc}"`)
    lines.push('')
  }

  lines.push(`# Extension: ${extId}`)
  lines.push(`# Config: .faber/extensions/${extId}/`)
  lines.push('')
  lines.push('prompt = """')
  lines.push(body)
  lines.push('"""')

  return lines.join('\n')
}

export const convertArgPlaceholder = (content: string, from: string, to: string): string =>
  content.replaceAll(from, to)

export const adjustScriptPaths = (fm: Frontmatter): Frontmatter => {
  const scripts = fm['scripts']
  if (!scripts || typeof scripts !== 'object') return fm

  const adjusted: Record<string, string> = {}
  for (const [key, value] of Object.entries(scripts as Record<string, string>)) {
    adjusted[key] = value.startsWith('../../scripts/')
      ? `.faber/scripts/${value.slice(14)}`
      : value
  }

  return { ...fm, scripts: adjusted }
}
