import { describe, it, expect } from 'vitest'
import {
  skillName,
  normalizeCommandName,
  SKILL_DESCRIPTIONS,
  buildSkillFrontmatter,
  renderSkillFile,
  skillDirPath,
} from '../../src/core/skills.ts'

// --- skillName ---

describe('skillName', () => {
  it('prefixes command name with faber-', () => {
    expect(skillName('specify')).toBe('faber-specify')
  })

  it('works for all standard commands', () => {
    expect(skillName('plan')).toBe('faber-plan')
    expect(skillName('tasks')).toBe('faber-tasks')
    expect(skillName('implement')).toBe('faber-implement')
  })
})

// --- normalizeCommandName ---

describe('normalizeCommandName', () => {
  it('strips .md extension', () => {
    expect(normalizeCommandName('specify.md')).toBe('specify')
  })

  it('strips speckit. prefix and .md extension', () => {
    expect(normalizeCommandName('speckit.specify.md')).toBe('specify')
  })

  it('strips faber. prefix and .md extension', () => {
    expect(normalizeCommandName('faber.specify.md')).toBe('specify')
  })

  it('handles name without prefix', () => {
    expect(normalizeCommandName('plan.md')).toBe('plan')
  })

  it('handles name without .md extension', () => {
    expect(normalizeCommandName('tasks')).toBe('tasks')
  })

  it('handles complex names', () => {
    expect(normalizeCommandName('taskstoissues.md')).toBe('taskstoissues')
  })
})

// --- SKILL_DESCRIPTIONS ---

describe('SKILL_DESCRIPTIONS', () => {
  it('has descriptions for standard commands', () => {
    expect(SKILL_DESCRIPTIONS.get('specify')).toBeDefined()
    expect(SKILL_DESCRIPTIONS.get('plan')).toBeDefined()
    expect(SKILL_DESCRIPTIONS.get('tasks')).toBeDefined()
    expect(SKILL_DESCRIPTIONS.get('implement')).toBeDefined()
  })

  it('descriptions are non-empty strings', () => {
    for (const [, desc] of SKILL_DESCRIPTIONS) {
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThan(0)
    }
  })
})

// --- buildSkillFrontmatter ---

describe('buildSkillFrontmatter', () => {
  it('builds frontmatter with name and description', () => {
    const fm = buildSkillFrontmatter('specify', 'Create specs', 'commands/specify.md')
    expect(fm['name']).toBe('faber-specify')
    expect(fm['description']).toBe('Create specs')
  })

  it('uses SKILL_DESCRIPTIONS when available', () => {
    const fm = buildSkillFrontmatter('specify', undefined, 'commands/specify.md')
    expect(fm['description']).toBe(SKILL_DESCRIPTIONS.get('specify'))
  })

  it('falls back to generic description', () => {
    const fm = buildSkillFrontmatter('custom-cmd', undefined, 'commands/custom-cmd.md')
    expect((fm['description'] as string).toLowerCase()).toContain('faber')
  })

  it('includes metadata with author and source', () => {
    const fm = buildSkillFrontmatter('plan', undefined, 'commands/plan.md')
    const meta = fm['metadata'] as Record<string, string>
    expect(meta['author']).toBe('faber')
    expect(meta['source']).toBe('commands/plan.md')
  })

  it('includes compatibility note', () => {
    const fm = buildSkillFrontmatter('plan', undefined, 'commands/plan.md')
    expect(fm['compatibility']).toContain('faber')
  })
})

// --- renderSkillFile ---

describe('renderSkillFile', () => {
  it('renders SKILL.md with frontmatter and body', () => {
    const fm = { name: 'faber-specify', description: 'Create specs' }
    const body = 'Do the thing with $ARGUMENTS'
    const result = renderSkillFile('specify', fm, body)

    expect(result).toContain('---')
    expect(result).toContain('name: faber-specify')
    expect(result).toContain('description: Create specs')
    expect(result).toContain('# Faber Specify Skill')
    expect(result).toContain('Do the thing with $ARGUMENTS')
  })

  it('starts with frontmatter delimiters', () => {
    const result = renderSkillFile('plan', { name: 'faber-plan' }, 'Body')
    expect(result.startsWith('---\n')).toBe(true)
  })

  it('has heading after frontmatter', () => {
    const result = renderSkillFile('tasks', { name: 'faber-tasks' }, 'Body')
    expect(result).toContain('# Faber Tasks Skill')
  })

  it('title-cases the command name in heading', () => {
    const result = renderSkillFile('taskstoissues', { name: 'faber-taskstoissues' }, 'Body')
    expect(result).toContain('# Faber Taskstoissues Skill')
  })

  it('body is separated from heading by blank line', () => {
    const result = renderSkillFile('plan', { name: 'x' }, 'My body')
    const lines = result.split('\n')
    const headingIdx = lines.findIndex((l) => l.startsWith('# Faber'))
    expect(lines[headingIdx + 1]).toBe('')
    expect(lines[headingIdx + 2]).toBe('My body')
  })
})

// --- skillDirPath ---

describe('skillDirPath', () => {
  it('joins base dir with skill name', () => {
    expect(skillDirPath('.claude/skills', 'faber-specify')).toBe(
      '.claude/skills/faber-specify',
    )
  })

  it('works with absolute paths', () => {
    expect(skillDirPath('/project/.claude/skills', 'faber-plan')).toBe(
      '/project/.claude/skills/faber-plan',
    )
  })
})
