import { join } from 'node:path'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { AGENTS } from '../core/agents.ts'

// --- Types ---

export interface InitOptions {
  readonly projectName: string
  readonly ai: string
  readonly script: string
  readonly here: boolean
  readonly noGit: boolean
  readonly force: boolean
  readonly aiSkills: boolean
  readonly githubToken?: string
  readonly aiCommandsDir?: string
}

export type InitError =
  | { readonly tag: 'validation'; readonly message: string }
  | { readonly tag: 'fs'; readonly message: string }
  | { readonly tag: 'download'; readonly message: string }

const VALID_SCRIPT_TYPES = new Set(['sh', 'ps'])

// --- Pure validation ---

export const validateInitOptions = (opts: InitOptions): Result<InitOptions, InitError> => {
  if (!opts.here && !opts.projectName.trim()) {
    return err({ tag: 'validation', message: 'Project name is required (or use --here)' })
  }

  if (opts.ai && !AGENTS.has(opts.ai as never)) {
    return err({ tag: 'validation', message: `Unknown AI agent: ${opts.ai}` })
  }

  if (!VALID_SCRIPT_TYPES.has(opts.script)) {
    return err({ tag: 'validation', message: `Invalid script type: ${opts.script}. Use sh or ps` })
  }

  if (opts.aiSkills && !opts.ai) {
    return err({ tag: 'validation', message: '--ai-skills requires --ai to be set' })
  }

  return ok(opts)
}

// --- Path resolution ---

export const resolveProjectPath = (name: string, here: boolean, cwd: string): string =>
  here ? cwd : join(cwd, name)
