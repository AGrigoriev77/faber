import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

export const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${x}`)
}

type Brand<T, B extends string> = T & { readonly __brand: B }

export type ExtensionId = Brand<string, 'ExtensionId'>
export type SemVer = Brand<string, 'SemVer'>
export type AbsolutePath = Brand<string, 'AbsolutePath'>

export interface ValidationError {
  readonly field: string
  readonly message: string
}

export const extensionId = (raw: string): Result<ExtensionId, ValidationError> =>
  raw.length > 0 && /^[a-z0-9-]+$/.test(raw)
    ? ok(raw as ExtensionId)
    : err({ field: 'extensionId', message: `Invalid extension ID: "${raw}". Must match /^[a-z0-9-]+$/` })

export const semVer = (raw: string): Result<SemVer, ValidationError> =>
  /^\d+\.\d+\.\d+$/.test(raw)
    ? ok(raw as SemVer)
    : err({ field: 'semVer', message: `Invalid semver: "${raw}". Must match M.m.p` })

export const absolutePath = (raw: string): Result<AbsolutePath, ValidationError> =>
  /^(\/|[A-Za-z]:\\)/.test(raw)
    ? ok(raw as AbsolutePath)
    : err({ field: 'absolutePath', message: `Invalid absolute path: "${raw}". Must start with / or drive letter` })
