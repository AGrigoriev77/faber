import { join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'

// --- Constants ---

const SKILL_PREFIX = 'faber'

export const SKILL_DESCRIPTIONS: ReadonlyMap<string, string> = new Map([
  ['specify', 'Create detailed specifications from natural language requirements'],
  ['plan', 'Generate a technical implementation plan from a specification'],
  ['tasks', 'Break down a plan into actionable development tasks with TDD markers'],
  ['implement', 'Execute all tasks following TDD red-green-refactor workflow'],
  ['analyze', 'Analyze consistency across specs, plans, and tasks'],
  ['clarify', 'Ask clarifying questions about ambiguous requirements'],
  ['constitution', 'Manage project principles and architectural constraints'],
  ['checklist', 'Validate requirements quality with a structured checklist'],
  ['taskstoissues', 'Convert task list into GitHub issues'],
])

// --- Pure helpers ---

export const skillName = (commandName: string): string =>
  `${SKILL_PREFIX}-${commandName}`

export const normalizeCommandName = (filename: string): string => {
  let name = filename
  if (name.endsWith('.md')) name = name.slice(0, -3)
  if (name.startsWith('speckit.')) name = name.slice(8)
  if (name.startsWith('faber.')) name = name.slice(6)
  return name
}

export const buildSkillFrontmatter = (
  commandName: string,
  description: string | undefined,
  sourcePath: string,
): Readonly<Record<string, unknown>> => {
  const desc = description
    ?? SKILL_DESCRIPTIONS.get(commandName)
    ?? `Faber ${commandName} skill`

  return {
    name: skillName(commandName),
    description: desc,
    compatibility: `Requires faber project structure (.specify/ directory)`,
    metadata: {
      author: SKILL_PREFIX,
      source: sourcePath,
    },
  }
}

const titleCase = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1)

export const renderSkillFile = (
  commandName: string,
  frontmatter: Readonly<Record<string, unknown>>,
  body: string,
): string => {
  const yaml = stringifyYaml(frontmatter as Record<string, unknown>, { sortMapEntries: false })
  const heading = `# Faber ${titleCase(commandName)} Skill`

  return `---\n${yaml}---\n\n${heading}\n\n${body}\n`
}

export const skillDirPath = (skillsBaseDir: string, name: string): string =>
  join(skillsBaseDir, name)
