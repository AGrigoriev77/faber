import { describe, it, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import fc from 'fast-check'
import {
  AGENTS,
  getAgent,
  agentIds,
  resolveSkillsDir,
  type AgentId,
  type AgentConfig,
} from '../../src/core/agents.ts'

describe('AGENTS registry', () => {
  it('contains exactly 19 agents', () => {
    expect(AGENTS.size).toBe(19)
  })

  it('contains all expected agent ids', () => {
    const expected: ReadonlyArray<string> = [
      'copilot', 'claude', 'gemini', 'cursor-agent', 'qwen',
      'opencode', 'codex', 'windsurf', 'kilocode', 'auggie',
      'codebuddy', 'qodercli', 'roo', 'q', 'amp',
      'shai', 'agy', 'bob', 'generic',
    ]
    for (const id of expected) {
      expect(AGENTS.has(id as AgentId), `missing agent: ${id}`).toBe(true)
    }
  })

  it('every agent has required fields', () => {
    for (const [id, config] of AGENTS) {
      expect(config.name, `${id}: name`).toBeTruthy()
      expect(config.commandsSubdir, `${id}: commandsSubdir`).toBeTruthy()
      expect(typeof config.requiresCli, `${id}: requiresCli`).toBe('boolean')
    }
  })

  it('is immutable (ReadonlyMap)', () => {
    const map: ReadonlyMap<AgentId, AgentConfig> = AGENTS
    expect(map).toBe(AGENTS)
    // ReadonlyMap has no set/delete — compile-time guarantee
  })
})

describe('getAgent', () => {
  it('returns ok for known agent', () => {
    const result = getAgent('claude' as AgentId)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().name).toBe('Claude Code')
  })

  it('returns err for unknown agent', () => {
    const result = getAgent('nonexistent' as AgentId)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('unknown_agent')
  })

  test.prop([fc.string().filter(s => !agentIds().includes(s as AgentId))])(
    'always returns err for arbitrary non-agent strings',
    (raw) => {
      expect(getAgent(raw as AgentId).isErr()).toBe(true)
    },
  )
})

describe('agentIds', () => {
  it('returns array of 19 ids', () => {
    expect(agentIds()).toHaveLength(19)
  })

  it('returns sorted array', () => {
    const ids = agentIds()
    const sorted = [...ids].sort()
    expect(ids).toEqual(sorted)
  })

  it('every id is a key in AGENTS', () => {
    for (const id of agentIds()) {
      expect(AGENTS.has(id)).toBe(true)
    }
  })
})

describe('agent configs — specific agents', () => {
  it('copilot uses agents/ subdir', () => {
    const copilot = AGENTS.get('copilot' as AgentId)!
    expect(copilot.commandsSubdir).toBe('agents')
    expect(copilot.folder).toBe('.github/')
    expect(copilot.requiresCli).toBe(false)
  })

  it('claude has install url and requires CLI', () => {
    const claude = AGENTS.get('claude' as AgentId)!
    expect(claude.folder).toBe('.claude/')
    expect(claude.installUrl).toBeTruthy()
    expect(claude.requiresCli).toBe(true)
  })

  it('opencode uses singular command subdir', () => {
    const opencode = AGENTS.get('opencode' as AgentId)!
    expect(opencode.commandsSubdir).toBe('command')
  })

  it('codex uses prompts subdir', () => {
    const codex = AGENTS.get('codex' as AgentId)!
    expect(codex.commandsSubdir).toBe('prompts')
  })

  it('windsurf uses workflows subdir', () => {
    const windsurf = AGENTS.get('windsurf' as AgentId)!
    expect(windsurf.commandsSubdir).toBe('workflows')
  })

  it('generic has no folder', () => {
    const generic = AGENTS.get('generic' as AgentId)!
    expect(generic.folder).toBeNull()
  })

  it('q uses .amazonq/ folder and prompts subdir', () => {
    const q = AGENTS.get('q' as AgentId)!
    expect(q.folder).toBe('.amazonq/')
    expect(q.commandsSubdir).toBe('prompts')
  })
})

describe('resolveSkillsDir', () => {
  it('returns override for codex', () => {
    expect(resolveSkillsDir('codex' as AgentId)).toBe('.agents/skills')
  })

  it('returns folder + skills for agent with folder', () => {
    expect(resolveSkillsDir('claude' as AgentId)).toBe('.claude/skills')
  })

  it('returns default for agent without folder (generic)', () => {
    expect(resolveSkillsDir('generic' as AgentId)).toBe('.agents/skills')
  })

  it('returns default for unknown agent', () => {
    expect(resolveSkillsDir('nonexistent' as AgentId)).toBe('.agents/skills')
  })
})

