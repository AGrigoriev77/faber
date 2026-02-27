import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

export type AgentId = string & { readonly __brand: 'AgentId' }

export interface AgentConfig {
  readonly name: string
  readonly folder: string | null
  readonly commandsSubdir: string
  readonly installUrl: string | null
  readonly requiresCli: boolean
}

export type AgentError = {
  readonly tag: 'unknown_agent'
  readonly id: string
}

const DEFAULT_SKILLS_DIR = '.agents/skills'

const SKILLS_DIR_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ['codex', '.agents/skills'],
])

const agents: ReadonlyArray<readonly [AgentId, AgentConfig]> = [
  ['agy' as AgentId, {
    name: 'Antigravity',
    folder: '.agent/',
    commandsSubdir: 'workflows',
    installUrl: null,
    requiresCli: false,
  }],
  ['amp' as AgentId, {
    name: 'Amp',
    folder: '.agents/',
    commandsSubdir: 'commands',
    installUrl: 'https://ampcode.com/manual#install',
    requiresCli: true,
  }],
  ['auggie' as AgentId, {
    name: 'Auggie CLI',
    folder: '.augment/',
    commandsSubdir: 'commands',
    installUrl: 'https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli',
    requiresCli: true,
  }],
  ['bob' as AgentId, {
    name: 'IBM Bob',
    folder: '.bob/',
    commandsSubdir: 'commands',
    installUrl: null,
    requiresCli: false,
  }],
  ['claude' as AgentId, {
    name: 'Claude Code',
    folder: '.claude/',
    commandsSubdir: 'commands',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code/setup',
    requiresCli: true,
  }],
  ['codebuddy' as AgentId, {
    name: 'CodeBuddy',
    folder: '.codebuddy/',
    commandsSubdir: 'commands',
    installUrl: 'https://www.codebuddy.ai/cli',
    requiresCli: true,
  }],
  ['codex' as AgentId, {
    name: 'Codex CLI',
    folder: '.codex/',
    commandsSubdir: 'prompts',
    installUrl: 'https://github.com/openai/codex',
    requiresCli: true,
  }],
  ['copilot' as AgentId, {
    name: 'GitHub Copilot',
    folder: '.github/',
    commandsSubdir: 'agents',
    installUrl: null,
    requiresCli: false,
  }],
  ['cursor-agent' as AgentId, {
    name: 'Cursor',
    folder: '.cursor/',
    commandsSubdir: 'commands',
    installUrl: null,
    requiresCli: false,
  }],
  ['gemini' as AgentId, {
    name: 'Gemini CLI',
    folder: '.gemini/',
    commandsSubdir: 'commands',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
    requiresCli: true,
  }],
  ['generic' as AgentId, {
    name: 'Generic (bring your own agent)',
    folder: null,
    commandsSubdir: 'commands',
    installUrl: null,
    requiresCli: false,
  }],
  ['kilocode' as AgentId, {
    name: 'Kilo Code',
    folder: '.kilocode/',
    commandsSubdir: 'workflows',
    installUrl: null,
    requiresCli: false,
  }],
  ['opencode' as AgentId, {
    name: 'opencode',
    folder: '.opencode/',
    commandsSubdir: 'command',
    installUrl: 'https://opencode.ai',
    requiresCli: true,
  }],
  ['q' as AgentId, {
    name: 'Amazon Q Developer CLI',
    folder: '.amazonq/',
    commandsSubdir: 'prompts',
    installUrl: 'https://aws.amazon.com/developer/learning/q-developer-cli/',
    requiresCli: true,
  }],
  ['qodercli' as AgentId, {
    name: 'Qoder CLI',
    folder: '.qoder/',
    commandsSubdir: 'commands',
    installUrl: 'https://qoder.com/cli',
    requiresCli: true,
  }],
  ['qwen' as AgentId, {
    name: 'Qwen Code',
    folder: '.qwen/',
    commandsSubdir: 'commands',
    installUrl: 'https://github.com/QwenLM/qwen-code',
    requiresCli: true,
  }],
  ['roo' as AgentId, {
    name: 'Roo Code',
    folder: '.roo/',
    commandsSubdir: 'commands',
    installUrl: null,
    requiresCli: false,
  }],
  ['shai' as AgentId, {
    name: 'SHAI',
    folder: '.shai/',
    commandsSubdir: 'commands',
    installUrl: 'https://github.com/ovh/shai',
    requiresCli: true,
  }],
  ['windsurf' as AgentId, {
    name: 'Windsurf',
    folder: '.windsurf/',
    commandsSubdir: 'workflows',
    installUrl: null,
    requiresCli: false,
  }],
]

export const AGENTS: ReadonlyMap<AgentId, AgentConfig> = new Map(agents)

export const getAgent = (id: AgentId): Result<AgentConfig, AgentError> => {
  const config = AGENTS.get(id)
  return config
    ? ok(config)
    : err({ tag: 'unknown_agent' as const, id })
}

export const agentIds = (): ReadonlyArray<AgentId> =>
  [...AGENTS.keys()].sort()

export const resolveSkillsDir = (id: AgentId): string => {
  const override = SKILLS_DIR_OVERRIDES.get(id)
  if (override) return override

  const config = AGENTS.get(id)
  if (config?.folder) {
    return config.folder.replace(/\/$/, '') + '/skills'
  }

  return DEFAULT_SKILLS_DIR
}

