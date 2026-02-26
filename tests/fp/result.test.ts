import { describe, it, expect } from 'vitest'
import { ok, err, fromThrowable } from '../../src/fp/result.ts'
import type { Result } from '../../src/fp/result.ts'

describe('fp/result re-exports', () => {
  it('ok() creates a successful Result', () => {
    const result = ok(42)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(42)
  })

  it('err() creates a failed Result', () => {
    const result = err('something went wrong')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBe('something went wrong')
  })

  it('Result type is usable for annotation', () => {
    const fn = (x: number): Result<number, string> =>
      x > 0 ? ok(x) : err('must be positive')

    expect(fn(1).isOk()).toBe(true)
    expect(fn(-1).isErr()).toBe(true)
  })

  it('andThen chains successful results', () => {
    const double = (x: number): Result<number, string> => ok(x * 2)

    const result = ok(5).andThen(double)
    expect(result._unsafeUnwrap()).toBe(10)
  })

  it('andThen short-circuits on error', () => {
    const double = (x: number): Result<number, string> => ok(x * 2)

    const result = err<number, string>('fail').andThen(double)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBe('fail')
  })

  it('map transforms the ok value', () => {
    const result = ok(3).map((x) => x * 10)
    expect(result._unsafeUnwrap()).toBe(30)
  })

  it('match extracts value from ok or err', () => {
    const okResult = ok(42).match(
      (val) => `ok:${val}`,
      (e) => `err:${e}`,
    )
    expect(okResult).toBe('ok:42')

    const errResult = err('bad').match(
      (val) => `ok:${val}`,
      (e) => `err:${e}`,
    )
    expect(errResult).toBe('err:bad')
  })

  it('fromThrowable wraps throwing functions', () => {
    const safeParse = fromThrowable(
      JSON.parse,
      (e) => (e instanceof Error ? e.message : 'unknown'),
    )

    const good = safeParse('{"a":1}')
    expect(good.isOk()).toBe(true)

    const bad = safeParse('not json')
    expect(bad.isErr()).toBe(true)
  })
})
