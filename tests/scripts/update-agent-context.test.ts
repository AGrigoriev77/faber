import { describe, it, expect } from 'vitest'
import {
  extractPlanField,
  formatTechStack,
  AGENT_FILE_PATHS,
  getProjectStructure,
  getCommandsForLanguage,
  parsePlanData,
  updateExistingContent,
} from '../../scripts/ts/update-agent-context.ts'

// ─── extractPlanField ─────────────────────────────────────────────────

describe('extractPlanField', () => {
  it('extracts a valid field value', () => {
    const content = '**Language/Version**: TypeScript 5.4\n**Storage**: PostgreSQL'
    expect(extractPlanField(content, 'Language/Version')).toBe('TypeScript 5.4')
  })

  it('extracts second field correctly', () => {
    const content = '**Language/Version**: TypeScript 5.4\n**Storage**: PostgreSQL'
    expect(extractPlanField(content, 'Storage')).toBe('PostgreSQL')
  })

  it('returns null when field is missing', () => {
    const content = '**Language/Version**: TypeScript 5.4'
    expect(extractPlanField(content, 'Storage')).toBeNull()
  })

  it('returns null for NEEDS CLARIFICATION value', () => {
    const content = '**Language/Version**: NEEDS CLARIFICATION'
    expect(extractPlanField(content, 'Language/Version')).toBeNull()
  })

  it('returns null for N/A value', () => {
    const content = '**Storage**: N/A'
    expect(extractPlanField(content, 'Storage')).toBeNull()
  })

  it('trims whitespace from value', () => {
    const content = '**Language/Version**:   TypeScript 5.4   '
    expect(extractPlanField(content, 'Language/Version')).toBe('TypeScript 5.4')
  })

  it('returns first match when field appears multiple times', () => {
    const content = '**Storage**: Redis\nSome text\n**Storage**: PostgreSQL'
    expect(extractPlanField(content, 'Storage')).toBe('Redis')
  })

  it('returns null for empty content', () => {
    expect(extractPlanField('', 'Language/Version')).toBeNull()
  })

  it('handles field with NEEDS CLARIFICATION embedded in longer text', () => {
    const content = '**Language/Version**: NEEDS CLARIFICATION for this'
    expect(extractPlanField(content, 'Language/Version')).toBeNull()
  })
})

// ─── formatTechStack ──────────────────────────────────────────────────

describe('formatTechStack', () => {
  it('combines language and framework', () => {
    expect(formatTechStack('TypeScript', 'Bun')).toBe('TypeScript + Bun')
  })

  it('returns only language when framework is empty', () => {
    expect(formatTechStack('TypeScript', '')).toBe('TypeScript')
  })

  it('returns only framework when language is empty', () => {
    expect(formatTechStack('', 'Bun')).toBe('Bun')
  })

  it('returns empty string when both are empty', () => {
    expect(formatTechStack('', '')).toBe('')
  })

  it('skips N/A framework', () => {
    expect(formatTechStack('TypeScript', 'N/A')).toBe('TypeScript')
  })

  it('skips NEEDS CLARIFICATION language', () => {
    expect(formatTechStack('NEEDS CLARIFICATION', 'Bun')).toBe('Bun')
  })

  it('skips NEEDS CLARIFICATION framework', () => {
    expect(formatTechStack('TypeScript', 'NEEDS CLARIFICATION')).toBe('TypeScript')
  })

  it('returns empty string when both are N/A or NEEDS CLARIFICATION', () => {
    expect(formatTechStack('NEEDS CLARIFICATION', 'N/A')).toBe('')
  })
})

// ─── AGENT_FILE_PATHS ─────────────────────────────────────────────────

describe('AGENT_FILE_PATHS', () => {
  it('has exactly 18 entries (no generic)', () => {
    expect(AGENT_FILE_PATHS.size).toBe(18)
  })

  it('contains claude entry with correct path and name', () => {
    const claude = AGENT_FILE_PATHS.get('claude')
    expect(claude).toEqual({ path: 'CLAUDE.md', name: 'Claude Code' })
  })

  it('contains copilot entry with subdirectory path', () => {
    const copilot = AGENT_FILE_PATHS.get('copilot')
    expect(copilot).toEqual({
      path: '.github/agents/copilot-instructions.md',
      name: 'GitHub Copilot',
    })
  })

  it('contains cursor-agent entry', () => {
    const cursor = AGENT_FILE_PATHS.get('cursor-agent')
    expect(cursor).toEqual({
      path: '.cursor/rules/specify-rules.mdc',
      name: 'Cursor IDE',
    })
  })

  it('maps opencode, codex, amp, q, and bob to AGENTS.md', () => {
    const agentsUsers = ['opencode', 'codex', 'amp', 'q', 'bob'] as const
    agentsUsers.forEach((key) => {
      expect(AGENT_FILE_PATHS.get(key)?.path).toBe('AGENTS.md')
    })
  })

  it('contains all expected agent keys', () => {
    const expectedKeys = [
      'claude', 'gemini', 'copilot', 'cursor-agent', 'qwen',
      'opencode', 'codex', 'windsurf', 'kilocode', 'auggie',
      'roo', 'codebuddy', 'qodercli', 'amp', 'shai', 'q', 'agy', 'bob',
    ]
    expectedKeys.forEach((key) => {
      expect(AGENT_FILE_PATHS.has(key)).toBe(true)
    })
  })

  it('does not contain generic', () => {
    expect(AGENT_FILE_PATHS.has('generic')).toBe(false)
  })
})

// ─── getProjectStructure ──────────────────────────────────────────────

describe('getProjectStructure', () => {
  it('returns web structure for web project type', () => {
    expect(getProjectStructure('web')).toBe('backend/\nfrontend/\ntests/')
  })

  it('returns web structure when type contains "web"', () => {
    expect(getProjectStructure('full-stack web app')).toBe('backend/\nfrontend/\ntests/')
  })

  it('returns standard structure for non-web projects', () => {
    expect(getProjectStructure('cli')).toBe('src/\ntests/')
  })

  it('returns standard structure for empty string', () => {
    expect(getProjectStructure('')).toBe('src/\ntests/')
  })
})

// ─── getCommandsForLanguage ───────────────────────────────────────────

describe('getCommandsForLanguage', () => {
  it('returns Python commands', () => {
    expect(getCommandsForLanguage('Python 3.12')).toBe('cd src && pytest && ruff check .')
  })

  it('returns Rust commands', () => {
    expect(getCommandsForLanguage('Rust 1.75')).toBe('cargo test && cargo clippy')
  })

  it('returns JavaScript commands for TypeScript', () => {
    expect(getCommandsForLanguage('TypeScript 5.4')).toBe('npm test && npm run lint')
  })

  it('returns JavaScript commands for JavaScript', () => {
    expect(getCommandsForLanguage('JavaScript ES2024')).toBe('npm test && npm run lint')
  })

  it('returns default commands for unknown language', () => {
    expect(getCommandsForLanguage('Go 1.22')).toBe('# Add commands for Go 1.22')
  })

  it('returns default commands for empty string', () => {
    expect(getCommandsForLanguage('')).toBe('# Add commands for ')
  })
})

// ─── parsePlanData ────────────────────────────────────────────────────

describe('parsePlanData', () => {
  const samplePlan = [
    '# Implementation Plan',
    '',
    '**Project Type**: web application',
    '**Language/Version**: TypeScript 5.4',
    '**Primary Dependencies**: Bun + Vite',
    '**Storage**: PostgreSQL 16',
    '',
    '## Architecture',
    'Some description...',
  ].join('\n')

  it('extracts all four fields from valid plan', () => {
    const data = parsePlanData(samplePlan)
    expect(data.lang).toBe('TypeScript 5.4')
    expect(data.framework).toBe('Bun + Vite')
    expect(data.db).toBe('PostgreSQL 16')
    expect(data.projectType).toBe('web application')
  })

  it('returns empty strings for missing fields', () => {
    const data = parsePlanData('# Empty plan\nNo fields here')
    expect(data.lang).toBe('')
    expect(data.framework).toBe('')
    expect(data.db).toBe('')
    expect(data.projectType).toBe('')
  })

  it('handles N/A fields as empty', () => {
    const content = '**Language/Version**: TypeScript\n**Storage**: N/A'
    const data = parsePlanData(content)
    expect(data.lang).toBe('TypeScript')
    expect(data.db).toBe('')
  })

  it('handles NEEDS CLARIFICATION fields as empty', () => {
    const content = '**Language/Version**: NEEDS CLARIFICATION\n**Storage**: Redis'
    const data = parsePlanData(content)
    expect(data.lang).toBe('')
    expect(data.db).toBe('Redis')
  })
})

// ─── updateExistingContent ────────────────────────────────────────────

describe('updateExistingContent', () => {
  const baseContent = [
    '# Project Context',
    '',
    '**Last updated**: 2024-01-01',
    '',
    '## Active Technologies',
    '- Python 3.11 (001-init)',
    '',
    '## Recent Changes',
    '- 001-init: Added Python 3.11',
    '- 000-setup: Initial setup',
    '',
    '## Other Section',
    'Some content here.',
  ].join('\n')

  it('adds new tech to Active Technologies section', () => {
    const result = updateExistingContent(
      baseContent, 'TypeScript + Bun', '', '002-feature', '2024-06-15',
    )
    expect(result).toContain('- TypeScript + Bun (002-feature)')
    // Original tech preserved
    expect(result).toContain('- Python 3.11 (001-init)')
  })

  it('adds db to Active Technologies when provided', () => {
    const result = updateExistingContent(
      baseContent, 'TypeScript', 'PostgreSQL', '002-feature', '2024-06-15',
    )
    expect(result).toContain('- PostgreSQL (002-feature)')
  })

  it('adds new change to Recent Changes section', () => {
    const result = updateExistingContent(
      baseContent, 'TypeScript + Bun', '', '002-feature', '2024-06-15',
    )
    expect(result).toContain('- 002-feature: Added TypeScript + Bun')
  })

  it('keeps max 2 old entries in Recent Changes', () => {
    const contentWith3Changes = [
      '# Project',
      '',
      '## Recent Changes',
      '- 003-third: Added Go',
      '- 002-second: Added Rust',
      '- 001-first: Added Python',
      '',
      '## Other',
    ].join('\n')

    const result = updateExistingContent(
      contentWith3Changes, 'TypeScript', '', '004-new', '2024-06-15',
    )
    // New entry + 2 old entries = 3 total
    expect(result).toContain('- 004-new: Added TypeScript')
    expect(result).toContain('- 003-third: Added Go')
    expect(result).toContain('- 002-second: Added Rust')
    // Third old entry should be dropped
    expect(result).not.toContain('- 001-first: Added Python')
  })

  it('updates timestamp', () => {
    const result = updateExistingContent(
      baseContent, 'TypeScript', '', '002-feature', '2024-06-15',
    )
    expect(result).toContain('**Last updated**: 2024-06-15')
    expect(result).not.toContain('**Last updated**: 2024-01-01')
  })

  it('appends Active Technologies section when missing', () => {
    const contentNoSections = '# Project\n\nSome text here.\n'
    const result = updateExistingContent(
      contentNoSections, 'TypeScript', '', '002-feature', '2024-06-15',
    )
    expect(result).toContain('## Active Technologies')
    expect(result).toContain('- TypeScript (002-feature)')
  })

  it('appends Recent Changes section when missing', () => {
    const contentNoSections = '# Project\n\nSome text here.\n'
    const result = updateExistingContent(
      contentNoSections, 'TypeScript', '', '002-feature', '2024-06-15',
    )
    expect(result).toContain('## Recent Changes')
    expect(result).toContain('- 002-feature: Added TypeScript')
  })

  it('does not add tech entry if already present', () => {
    const result = updateExistingContent(
      baseContent, 'Python 3.11', '', '002-feature', '2024-06-15',
    )
    // Should NOT duplicate "Python 3.11" in Active Technologies
    const techMatches = result.match(/- Python 3\.11/g)
    expect(techMatches).toHaveLength(1)
  })

  it('does not add db entry if already present', () => {
    const contentWithDb = [
      '# Project',
      '',
      '## Active Technologies',
      '- PostgreSQL (001-init)',
      '',
      '## Recent Changes',
      '- 001-init: Setup',
    ].join('\n')

    const result = updateExistingContent(
      contentWithDb, '', 'PostgreSQL', '002-feature', '2024-06-15',
    )
    const dbMatches = result.match(/- PostgreSQL/g)
    expect(dbMatches).toHaveLength(1)
  })

  it('skips db entry for N/A value', () => {
    const result = updateExistingContent(
      baseContent, 'TypeScript', 'N/A', '002-feature', '2024-06-15',
    )
    expect(result).not.toContain('- N/A')
  })

  it('skips db entry for NEEDS CLARIFICATION value', () => {
    const result = updateExistingContent(
      baseContent, 'TypeScript', 'NEEDS CLARIFICATION', '002-feature', '2024-06-15',
    )
    expect(result).not.toContain('- NEEDS CLARIFICATION')
  })

  it('handles content with no empty line between sections', () => {
    const tightContent = [
      '## Active Technologies',
      '- Go (001-init)',
      '## Recent Changes',
      '- 001-init: Added Go',
      '## Other',
    ].join('\n')

    const result = updateExistingContent(
      tightContent, 'TypeScript', '', '002-feature', '2024-06-15',
    )
    expect(result).toContain('- TypeScript (002-feature)')
    expect(result).toContain('- 002-feature: Added TypeScript')
  })

  it('preserves content after Recent Changes section', () => {
    const result = updateExistingContent(
      baseContent, 'TypeScript', '', '002-feature', '2024-06-15',
    )
    expect(result).toContain('## Other Section')
    expect(result).toContain('Some content here.')
  })
})
