import { describe, it, expect } from 'vitest'
import {
  formatCheckResult,
  formatCheckItem,
  formatCheckReport,
  summarizeCheck,
  buildCheckList,
  EXPECTED_TEMPLATES,
  EXPECTED_SCRIPTS,
  EXPECTED_COMMANDS,
  type ToolCheckResult,
  type CheckItem,
  type AgentInfo,
} from '../../src/commands/check.ts'

// --- formatCheckResult (backward compat) ---

describe('formatCheckResult', () => {
  it('formats found tool', () => {
    const result: ToolCheckResult = { tool: 'git', status: 'found' }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('git')
    expect(formatted).toContain('found')
  })

  it('formats missing required tool', () => {
    const result: ToolCheckResult = { tool: 'git', status: 'missing_required' }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('git')
    expect(formatted).toContain('missing')
  })

  it('formats missing optional tool', () => {
    const result: ToolCheckResult = { tool: 'vscode', status: 'missing_optional' }
    const formatted = formatCheckResult(result)
    expect(formatted).toContain('vscode')
    expect(formatted).toContain('optional')
  })
})

// --- formatCheckItem ---

describe('formatCheckItem', () => {
  it('formats found item with indentation', () => {
    const item: CheckItem = { category: 'templates', name: 'spec-template.md', status: 'found' }
    const formatted = formatCheckItem(item)
    expect(formatted).toMatch(/^\s+/)
    expect(formatted).toContain('spec-template.md')
    expect(formatted).toContain('found')
  })

  it('formats missing required item', () => {
    const item: CheckItem = { category: 'structure', name: '.faber/', status: 'missing_required' }
    const formatted = formatCheckItem(item)
    expect(formatted).toContain('.faber/')
    expect(formatted).toContain('missing')
    expect(formatted).toContain('required')
  })

  it('formats missing optional item', () => {
    const item: CheckItem = { category: 'commands', name: 'faber.specify', status: 'missing_optional' }
    const formatted = formatCheckItem(item)
    expect(formatted).toContain('faber.specify')
    expect(formatted).toContain('optional')
  })
})

// --- formatCheckReport ---

describe('formatCheckReport', () => {
  it('groups items by category with headers', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'tools', name: 'git', status: 'found' },
      { category: 'structure', name: '.faber/', status: 'found' },
      { category: 'structure', name: '.faber/templates/', status: 'missing_required' },
    ]
    const report = formatCheckReport(items)
    expect(report).toContain('System Tools')
    expect(report).toContain('Project Structure')
    expect(report).toContain('git')
    expect(report).toContain('.faber/')
  })

  it('omits empty categories', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'tools', name: 'git', status: 'found' },
    ]
    const report = formatCheckReport(items)
    expect(report).toContain('System Tools')
    expect(report).not.toContain('Templates')
    expect(report).not.toContain('Scripts')
  })

  it('preserves category order', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'scripts', name: 'common.ts', status: 'found' },
      { category: 'tools', name: 'git', status: 'found' },
    ]
    const report = formatCheckReport(items)
    const toolsIdx = report.indexOf('System Tools')
    const scriptsIdx = report.indexOf('Scripts')
    expect(toolsIdx).toBeLessThan(scriptsIdx)
  })

  it('includes agent name in commands header', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'commands', name: 'faber.specify', status: 'found' },
    ]
    const report = formatCheckReport(items, 'claude')
    expect(report).toContain('Agent Commands (claude)')
  })

  it('uses plain header when no agent name', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'commands', name: 'faber.specify', status: 'found' },
    ]
    const report = formatCheckReport(items)
    expect(report).toContain('Agent Commands')
    expect(report).not.toContain('(')
  })
})

// --- summarizeCheck ---

describe('summarizeCheck', () => {
  it('counts all passed', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'tools', name: 'git', status: 'found' },
      { category: 'structure', name: '.faber/', status: 'found' },
    ]
    const summary = summarizeCheck(items)
    expect(summary).toContain('2/2')
    expect(summary).toContain('passed')
  })

  it('counts partial pass', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'tools', name: 'git', status: 'found' },
      { category: 'structure', name: '.faber/', status: 'missing_required' },
      { category: 'templates', name: 'spec-template.md', status: 'found' },
    ]
    const summary = summarizeCheck(items)
    expect(summary).toContain('2/3')
  })

  it('counts zero pass', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'tools', name: 'git', status: 'missing_required' },
    ]
    const summary = summarizeCheck(items)
    expect(summary).toContain('0/1')
  })

  it('treats missing_optional as not passed', () => {
    const items: ReadonlyArray<CheckItem> = [
      { category: 'commands', name: 'faber.specify', status: 'missing_optional' },
    ]
    const summary = summarizeCheck(items)
    expect(summary).toContain('0/1')
  })
})

// --- buildCheckList ---

describe('buildCheckList', () => {
  it('includes structure checks', () => {
    const list = buildCheckList('/project')
    const structureItems = list.filter((e) => e.item.category === 'structure')
    expect(structureItems).toHaveLength(3)
    expect(structureItems.map((e) => e.item.name)).toEqual(['.faber/', '.faber/templates/', '.faber/scripts/'])
  })

  it('includes all template checks', () => {
    const list = buildCheckList('/project')
    const templateItems = list.filter((e) => e.item.category === 'templates')
    expect(templateItems).toHaveLength(6)
    expect(templateItems.map((e) => e.item.name)).toEqual(EXPECTED_TEMPLATES)
  })

  it('includes all script checks', () => {
    const list = buildCheckList('/project')
    const scriptItems = list.filter((e) => e.item.category === 'scripts')
    expect(scriptItems).toHaveLength(5)
    expect(scriptItems.map((e) => e.item.name)).toEqual(EXPECTED_SCRIPTS)
  })

  it('excludes commands when no agent', () => {
    const list = buildCheckList('/project')
    const commandItems = list.filter((e) => e.item.category === 'commands')
    expect(commandItems).toHaveLength(0)
  })

  it('includes command checks when agent provided', () => {
    const agent: AgentInfo = { name: 'claude', dir: '.claude/commands', extension: '.md' }
    const list = buildCheckList('/project', agent)
    const commandItems = list.filter((e) => e.item.category === 'commands')
    expect(commandItems).toHaveLength(10)
    expect(commandItems.at(0)!.item.name).toBe('faber.analyze')
    expect(commandItems.at(0)!.path).toContain('.claude/commands/faber.analyze.md')
  })

  it('uses correct extension for non-markdown agents', () => {
    const agent: AgentInfo = { name: 'gemini', dir: '.gemini/commands', extension: '.toml' }
    const list = buildCheckList('/project', agent)
    const commandItems = list.filter((e) => e.item.category === 'commands')
    expect(commandItems.at(0)!.path).toContain('faber.analyze.toml')
  })

  it('uses correct paths for templates', () => {
    const list = buildCheckList('/project')
    const specTemplate = list.find((e) => e.item.name === 'spec-template.md')
    expect(specTemplate?.path).toContain('.faber/templates/spec-template.md')
  })

  it('uses correct paths for scripts', () => {
    const list = buildCheckList('/project')
    const common = list.find((e) => e.item.name === 'common.ts')
    expect(common?.path).toContain('.faber/scripts/common.ts')
  })

  it('total items = 14 without agent, 24 with agent', () => {
    const withoutAgent = buildCheckList('/project')
    expect(withoutAgent).toHaveLength(14)

    const agent: AgentInfo = { name: 'claude', dir: '.claude/commands', extension: '.md' }
    const withAgent = buildCheckList('/project', agent)
    expect(withAgent).toHaveLength(24)
  })
})

// --- Constants ---

describe('constants', () => {
  it('EXPECTED_TEMPLATES has 6 entries', () => {
    expect(EXPECTED_TEMPLATES).toHaveLength(6)
  })

  it('EXPECTED_SCRIPTS has 5 entries', () => {
    expect(EXPECTED_SCRIPTS).toHaveLength(5)
  })

  it('EXPECTED_COMMANDS has 10 entries', () => {
    expect(EXPECTED_COMMANDS).toHaveLength(10)
  })
})
