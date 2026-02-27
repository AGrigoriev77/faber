/**
 * Shared immutable object utilities.
 * Used by config.ts (extension config merge) and templates.ts (JSON merge).
 */

export type PlainObject = Readonly<Record<string, unknown>>

export const isPlainObject = (value: unknown): value is PlainObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const mergeValue = (baseVal: unknown, overVal: unknown): unknown =>
  isPlainObject(baseVal) && isPlainObject(overVal)
    ? deepMerge(baseVal, overVal)
    : overVal

export const deepMerge = (base: PlainObject, override: PlainObject): PlainObject =>
  Object.keys(override).reduce(
    (acc, key) => ({ ...acc, [key]: mergeValue(base[key], override[key]) }),
    { ...base },
  )
