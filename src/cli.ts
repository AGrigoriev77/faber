import { Command } from 'commander'
import { AGENTS } from './core/agents.ts'
import { validateInitOptions, resolveProjectPath } from './commands/init.ts'
import { formatVersionInfo } from './commands/version.ts'
import { formatCheckResult } from './commands/check.ts'
import { formatSuccess, formatError } from './core/ui.ts'
import { checkTool } from './utils/git.ts'

const VERSION = '0.1.0'

const agentChoices = [...AGENTS.keys()].join(', ')

export const createProgram = (): Command => {
  const program = new Command()
    .name('faber')
    .description('CLI for Spec-Driven Development — specs → plan → tasks → test → code')
    .version(VERSION)

  // --- init ---
  program
    .command('init')
    .description('Initialize a new faber project')
    .argument('[name]', 'Project name')
    .option('--ai <agent>', `AI assistant (${agentChoices})`)
    .option('--script <type>', 'Script type: sh or ps', 'sh')
    .option('--here', 'Initialize in current directory', false)
    .option('--no-git', 'Skip git initialization')
    .option('--force', 'Skip confirmations', false)
    .option('--ai-skills', 'Install agent skills', false)
    .option('--github-token <token>', 'GitHub token for API requests')
    .action(async (name: string | undefined, opts) => {
      const result = validateInitOptions({
        projectName: name ?? '',
        ai: opts.ai ?? '',
        script: opts.script,
        here: opts.here,
        noGit: opts.noGit ?? false,
        force: opts.force,
        aiSkills: opts.aiSkills,
        githubToken: opts.githubToken,
      })

      result.match(
        (validOpts) => {
          const projectPath = resolveProjectPath(validOpts.projectName, validOpts.here, process.cwd())
          console.log(formatSuccess(`Initializing faber project at ${projectPath}`))
          // TODO: download templates, extract, setup git, install skills
        },
        (error) => {
          console.error(formatError(error.message, error.tag))
          process.exit(1)
        },
      )
    })

  // --- check ---
  program
    .command('check')
    .description('Check installed tools')
    .action(async () => {
      const tools = ['git']
      for (const tool of tools) {
        const result = await checkTool(tool)
        result.match(
          (found) => {
            console.log(formatCheckResult({ tool, found, required: true }))
          },
          (_error) => {
            console.log(formatCheckResult({ tool, found: false, required: true }))
          },
        )
      }
    })

  // --- version ---
  program
    .command('version')
    .description('Show version information')
    .action(async () => {
      // TODO: fetch latest release version from GitHub
      console.log(formatVersionInfo(VERSION, null))
    })

  return program
}
