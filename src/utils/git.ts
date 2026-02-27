import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ok, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'

const execFileAsync = promisify(execFile)

export type GitError = {
  readonly tag: 'git_error'
  readonly command: string
  readonly message: string
}

const run = (
  args: ReadonlyArray<string>,
  cwd: string,
): ResultAsync<string, GitError> =>
  ResultAsync.fromPromise(
    execFileAsync('git', [...args], { cwd }).then(({ stdout }) => stdout.trim()),
    (e): GitError => ({
      tag: 'git_error',
      command: `git ${args.join(' ')}`,
      message: e instanceof Error ? e.message : String(e),
    }),
  )

export const isGitRepo = async (path: string): Promise<Result<boolean, GitError>> =>
  run(['rev-parse', '--is-inside-work-tree'], path)
    .map((): boolean => true)
    .orElse((): Result<boolean, GitError> => ok(false))

export const initGitRepo = async (path: string): Promise<Result<void, GitError>> =>
  run(['init'], path)
    .andThen(() => run(['add', '.'], path))
    .andThen(() => run(['commit', '--allow-empty', '-m', 'Initial commit from faber template'], path))
    .map(() => undefined as void)

export const checkTool = async (tool: string): Promise<Result<boolean, GitError>> =>
  ResultAsync.fromPromise(
    execFileAsync('which', [tool]).then(({ stdout }) => stdout.trim().length > 0),
    () => undefined,
  ).orElse((): Result<boolean, GitError> => ok(false))
