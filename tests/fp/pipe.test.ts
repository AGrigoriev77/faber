import { describe, it, expect } from 'vitest'
import { pipe, flow } from '../../src/fp/pipe.ts'

describe('fp/pipe', () => {
  const double = (x: number) => x * 2
  const inc = (x: number) => x + 1
  const toString = (x: number) => `value:${x}`

  it('pipes a value through 2 functions', () => {
    expect(pipe(5, double, inc)).toBe(11)
  })

  it('pipes a value through 3 functions', () => {
    expect(pipe(5, double, inc, toString)).toBe('value:11')
  })

  it('pipes a value through 4 functions', () => {
    const negate = (s: string) => `!(${s})`
    expect(pipe(5, double, inc, toString, negate)).toBe('!(value:11)')
  })

  it('pipes a value through 5 functions', () => {
    const len = (s: string) => s.length
    const isEven = (n: number) => n % 2 === 0
    // 5*2=10, +1=11, "value:11".length=8, 8%2===0 → true
    expect(pipe(5, double, inc, toString, len, isEven)).toBe(true)
  })

  it('preserves types through the chain', () => {
    const result: string = pipe(10, double, toString)
    expect(result).toBe('value:20')
  })
})

describe('fp/flow', () => {
  const double = (x: number) => x * 2
  const inc = (x: number) => x + 1
  const toString = (x: number) => `value:${x}`

  it('creates a composable function from 2 functions', () => {
    const fn = flow(double, inc)
    expect(fn(5)).toBe(11)
  })

  it('creates a composable function from 3 functions', () => {
    const fn = flow(double, inc, toString)
    expect(fn(5)).toBe('value:11')
  })

  it('created function is reusable', () => {
    const fn = flow(double, inc)
    expect(fn(1)).toBe(3)
    expect(fn(2)).toBe(5)
    expect(fn(10)).toBe(21)
  })
})
