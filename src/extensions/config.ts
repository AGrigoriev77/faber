export type Config = Readonly<Record<string, unknown>>

export const deepMerge = (base: Config, override: Config): Config => {
  const result: Record<string, unknown> = { ...base }

  for (const key of Object.keys(override)) {
    const baseVal = base[key]
    const overVal = override[key]

    if (
      baseVal !== null && overVal !== null &&
      typeof baseVal === 'object' && typeof overVal === 'object' &&
      !Array.isArray(baseVal) && !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(baseVal as Config, overVal as Config)
    } else {
      result[key] = overVal
    }
  }

  return result
}

export const mergeConfigs = (
  defaults: Config,
  project: Config,
  local: Config,
  env: Config,
): Config =>
  deepMerge(deepMerge(deepMerge(defaults, project), local), env)

export const envToConfig = (extensionId: string): Config => {
  const prefix = `SPECKIT_${extensionId.replace(/-/g, '_').toUpperCase()}_`
  const config: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix)) continue

    const parts = key.slice(prefix.length).toLowerCase().split('_')
    let current: Record<string, unknown> = config

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    current[parts[parts.length - 1]!] = value
  }

  return config
}

export const getValue = (config: Config, keyPath: string, defaultValue?: unknown): unknown => {
  const keys = keyPath.split('.')
  let current: unknown = config

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue
    }
    const obj = current as Record<string, unknown>
    if (!(key in obj)) {
      return defaultValue
    }
    current = obj[key]
  }

  return current
}

export const hasValue = (config: Config, keyPath: string): boolean => {
  const keys = keyPath.split('.')
  let current: unknown = config

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false
    }
    const obj = current as Record<string, unknown>
    if (!(key in obj)) {
      return false
    }
    current = obj[key]
  }

  return true
}
