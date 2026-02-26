import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

const execFileAsync = promisify(execFile)

export type GitError = {
  readonly tag: 'git_error'
  readonly command: string
  readonly message: string
}

const run = async (
  args: ReadonlyArray<string>,
  cwd: string,
): Promise<Result<string, GitError>> => {
  try {
    const { stdout } = await execFileAsync('git', [...args], { cwd })
    return ok(stdout.trim())
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({ tag: 'git_error', command: `git ${args.join(' ')}`, message })
  }
}

export const isGitRepo = async (path: string): Promise<Result<boolean, GitError>> => {
  const result = await run(['rev-parse', '--is-inside-work-tree'], path)
  return result.match(
    () => ok(true),
    () => ok(false),
  )
}

export const initGitRepo = async (path: string): Promise<Result<void, GitError>> => {
  const init = await run(['init'], path)
  if (init.isErr()) return err(init.error)

  const add = await run(['add', '.'], path)
  if (add.isErr()) return err(add.error)

  const commit = await run(
    ['commit', '--allow-empty', '-m', 'Initial commit from faber template'],
    path,
  )
  if (commit.isErr()) return err(commit.error)

  return ok(undefined)
}

export const checkTool = async (tool: string): Promise<Result<boolean, GitError>> => {
  try {
    const { stdout } = await execFileAsync('which', [tool])
    return ok(stdout.trim().length > 0)
  } catch {
    return ok(false)
  }
}
