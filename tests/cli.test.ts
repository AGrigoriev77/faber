import { describe, it, expect } from 'vitest'
import { createProgram } from '../src/cli.ts'

describe('createProgram', () => {
  it('creates a Commander program', () => {
    const program = createProgram()
    expect(program.name()).toBe('faber')
  })

  it('has init command', () => {
    const program = createProgram()
    const initCmd = program.commands.find((c) => c.name() === 'init')
    expect(initCmd).toBeDefined()
  })

  it('has check command', () => {
    const program = createProgram()
    const checkCmd = program.commands.find((c) => c.name() === 'check')
    expect(checkCmd).toBeDefined()
  })

  it('has version command', () => {
    const program = createProgram()
    const versionCmd = program.commands.find((c) => c.name() === 'version')
    expect(versionCmd).toBeDefined()
  })

  it('init has --ai option', () => {
    const program = createProgram()
    const initCmd = program.commands.find((c) => c.name() === 'init')!
    const aiOpt = initCmd.options.find((o) => o.long === '--ai')
    expect(aiOpt).toBeDefined()
  })

  it('init has --script option', () => {
    const program = createProgram()
    const initCmd = program.commands.find((c) => c.name() === 'init')!
    const scriptOpt = initCmd.options.find((o) => o.long === '--script')
    expect(scriptOpt).toBeDefined()
  })

  it('init has --here option', () => {
    const program = createProgram()
    const initCmd = program.commands.find((c) => c.name() === 'init')!
    const hereOpt = initCmd.options.find((o) => o.long === '--here')
    expect(hereOpt).toBeDefined()
  })

  it('init has --no-git option', () => {
    const program = createProgram()
    const initCmd = program.commands.find((c) => c.name() === 'init')!
    const noGitOpt = initCmd.options.find((o) => o.long === '--no-git')
    expect(noGitOpt).toBeDefined()
  })

  it('--no-git flag is correctly parsed as noGit: true', async () => {
    const program = createProgram()
    const initCmd = program.commands.find((c) => c.name() === 'init')!

    let capturedOpts: Record<string, unknown> | undefined
    // Replace action to capture parsed options without running init
    initCmd.action((_name: string, opts: Record<string, unknown>) => {
      capturedOpts = opts
    })

    await program.parseAsync(['node', 'faber', 'init', 'test-proj', '--no-git', '--ai', 'claude'])
    expect(capturedOpts).toBeDefined()
    expect(capturedOpts!.git).toBe(false)
  })

  it('git defaults to true when --no-git is not passed', async () => {
    const program = createProgram()
    const initCmd = program.commands.find((c) => c.name() === 'init')!

    let capturedOpts: Record<string, unknown> | undefined
    initCmd.action((_name: string, opts: Record<string, unknown>) => {
      capturedOpts = opts
    })

    await program.parseAsync(['node', 'faber', 'init', 'test-proj', '--ai', 'claude'])
    expect(capturedOpts).toBeDefined()
    expect(capturedOpts!.git).toBe(true)
  })
})
