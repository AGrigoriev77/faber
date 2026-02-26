import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { assertNever } from '../fp/types.ts'

// --- Discriminated union for conditions ---

export type HookCondition =
  | { readonly tag: 'config_is_set'; readonly keyPath: string }
  | { readonly tag: 'config_equals'; readonly keyPath: string; readonly value: string }
  | { readonly tag: 'config_not_equals'; readonly keyPath: string; readonly value: string }
  | { readonly tag: 'env_is_set'; readonly varName: string }
  | { readonly tag: 'env_equals'; readonly varName: string; readonly value: string }
  | { readonly tag: 'env_not_equals'; readonly varName: string; readonly value: string }

export type ConditionError = {
  readonly tag: 'invalid_condition'
  readonly raw: string
}

const CONFIG_IS_SET_RE = /^config\.([a-z0-9_.]+)\s+is\s+set$/i
const CONFIG_CMP_RE = /^config\.([a-z0-9_.]+)\s*(==|!=)\s*["']([^"']+)["']$/i
const ENV_IS_SET_RE = /^env\.([A-Z0-9_]+)\s+is\s+set$/i
const ENV_CMP_RE = /^env\.([A-Z0-9_]+)\s*(==|!=)\s*["']([^"']+)["']$/i

export const parseCondition = (raw: string): Result<HookCondition, ConditionError> => {
  const trimmed = raw.trim()
  let match: RegExpMatchArray | null

  match = trimmed.match(CONFIG_IS_SET_RE)
  if (match) return ok({ tag: 'config_is_set', keyPath: match[1]! })

  match = trimmed.match(CONFIG_CMP_RE)
  if (match) {
    const tag = match[2] === '==' ? 'config_equals' as const : 'config_not_equals' as const
    return ok({ tag, keyPath: match[1]!, value: match[3]! })
  }

  match = trimmed.match(ENV_IS_SET_RE)
  if (match) return ok({ tag: 'env_is_set', varName: match[1]! })

  match = trimmed.match(ENV_CMP_RE)
  if (match) {
    const tag = match[2] === '==' ? 'env_equals' as const : 'env_not_equals' as const
    return ok({ tag, varName: match[1]!, value: match[3]! })
  }

  return err({ tag: 'invalid_condition', raw: trimmed })
}

// --- Condition evaluation ---

export interface ConditionContext {
  readonly configHas: (keyPath: string) => boolean
  readonly configGet: (keyPath: string) => unknown
}

const normalize = (value: unknown): string =>
  typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)

export const evaluateCondition = (cond: HookCondition, ctx: ConditionContext): boolean => {
  switch (cond.tag) {
    case 'config_is_set':
      return ctx.configHas(cond.keyPath)

    case 'config_equals':
      return normalize(ctx.configGet(cond.keyPath)) === cond.value

    case 'config_not_equals':
      return normalize(ctx.configGet(cond.keyPath)) !== cond.value

    case 'env_is_set':
      return cond.varName in process.env

    case 'env_equals':
      return (process.env[cond.varName] ?? '') === cond.value

    case 'env_not_equals':
      return (process.env[cond.varName] ?? '') !== cond.value
    default:
      return assertNever(cond)
  }
}

// --- Hook entries ---

export interface HookEntry {
  readonly extension: string
  readonly command: string
  readonly enabled: boolean
  readonly optional: boolean
  readonly prompt: string
  readonly description: string
  readonly condition: string | null
}

export type HooksConfig = Readonly<Record<string, ReadonlyArray<HookEntry>>>

export const filterEnabledHooks = (hooks: ReadonlyArray<HookEntry>): ReadonlyArray<HookEntry> =>
  hooks.filter((h) => h.enabled)

export const registerHook = (
  config: HooksConfig,
  event: string,
  entry: HookEntry,
): HooksConfig => {
  const existing = config[event] ?? []
  const idx = existing.findIndex((h) => h.extension === entry.extension)

  const updated = idx >= 0
    ? existing.map((h, i) => (i === idx ? entry : h))
    : [...existing, entry]

  return { ...config, [event]: updated }
}

export const unregisterHooks = (
  config: HooksConfig,
  extensionId: string,
): HooksConfig => {
  const result: Record<string, ReadonlyArray<HookEntry>> = {}

  for (const [event, hooks] of Object.entries(config)) {
    const filtered = hooks.filter((h) => h.extension !== extensionId)
    if (filtered.length > 0) {
      result[event] = filtered
    }
  }

  return result
}
