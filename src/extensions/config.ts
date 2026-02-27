import { deepMerge, isPlainObject } from '../fp/objects.ts'
import type { PlainObject } from '../fp/objects.ts'

export type Config = PlainObject

export { deepMerge }

export const mergeConfigs = (
  defaults: Config,
  project: Config,
  local: Config,
  env: Config,
): Config =>
  [project, local, env].reduce(deepMerge, defaults)

const SENTINEL = Symbol('not-found')

const traversePath = (config: Config, keys: ReadonlyArray<string>): unknown =>
  keys.reduce<unknown>(
    (current, key) => {
      if (current === SENTINEL) return SENTINEL
      if (!isPlainObject(current)) return SENTINEL
      const obj = current as Record<string, unknown>
      return key in obj ? obj[key] : SENTINEL
    },
    config as unknown,
  )

export const getValue = (config: Config, keyPath: string, defaultValue?: unknown): unknown => {
  const result = traversePath(config, keyPath.split('.'))
  return result === SENTINEL ? defaultValue : result
}

export const hasValue = (config: Config, keyPath: string): boolean =>
  traversePath(config, keyPath.split('.')) !== SENTINEL

const buildNestedValue = (parts: ReadonlyArray<string>, value: string): Config =>
  parts.reduceRight<Config>((acc, part) => ({ [part]: acc }), value as unknown as Config)

export const envToConfig = (extensionId: string): Config => {
  const prefix = `SPECKIT_${extensionId.replace(/-/g, '_').toUpperCase()}_`
  return Object.entries(process.env)
    .filter(([key]) => key.startsWith(prefix))
    .reduce<Config>((config, [key, value]) => {
      const parts = key.slice(prefix.length).toLowerCase().split('_')
      return deepMerge(config, buildNestedValue(parts, value ?? ''))
    }, {})
}
