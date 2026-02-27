import { Command } from 'commander'
import { AGENTS } from './core/agents.ts'
import { validateInitOptions, resolveProjectPath, runInit } from './commands/init.ts'
import { formatVersionInfo } from './commands/version.ts'
import { formatCheckResult } from './commands/check.ts'
import { formatSuccess, formatError } from './core/ui.ts'
import { checkTool } from './utils/git.ts'
import {
  runExtensionList,
  runExtensionSearch,
  runExtensionInfo,
  runExtensionAdd,
  runExtensionRemove,
  runExtensionUpdate,
  formatCommandError,
} from './commands/extension/index.ts'
import { emptyRegistry } from './extensions/registry.ts'

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
        noGit: !opts.git,
        force: opts.force,
        aiSkills: opts.aiSkills,
        githubToken: opts.githubToken,
      })

      if (result.isErr()) {
        console.error(formatError(result.error.message, result.error.tag))
        process.exit(1)
        return
      }

      const validOpts = result.value
      const projectPath = resolveProjectPath(validOpts.projectName, validOpts.here, process.cwd())
      console.log(formatSuccess(`Initializing faber project at ${projectPath}...`))

      const initResult = await runInit({
        projectPath,
        ai: validOpts.ai,
        script: validOpts.script,
        noGit: validOpts.noGit,
        aiSkills: validOpts.aiSkills,
      })

      initResult.match(
        (meta) => {
          console.log(formatSuccess(`Created ${meta.filesCreated} files`))
          if (meta.agent) console.log(formatSuccess(`Agent: ${meta.agent}`))
          console.log(formatSuccess('Done! Run "faber check" to verify your setup.'))
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

  // --- extension group ---
  const extension = program
    .command('extension')
    .description('Manage faber extensions')

  extension
    .command('list')
    .description('List installed extensions')
    .action(async () => {
      const result = await runExtensionList({ cwd: process.cwd() })
      result.match(
        (r) => console.log(r.formatted),
        (e) => { console.error(formatError(formatCommandError(e), e.tag)); process.exit(1) },
      )
    })

  extension
    .command('add')
    .description('Install an extension from a local directory')
    .argument('<source>', 'Path to extension directory')
    .option('--ai <agent>', `AI assistant for command rendering (${agentChoices})`)
    .action(async (source: string, opts) => {
      const result = await runExtensionAdd({ cwd: process.cwd(), source, ai: opts.ai })
      result.match(
        (r) => console.log(formatSuccess(`Installed ${r.id}@${r.version} (${r.filesCreated} files)`)),
        (e) => { console.error(formatError(formatCommandError(e), e.tag)); process.exit(1) },
      )
    })

  extension
    .command('remove')
    .description('Remove an installed extension')
    .argument('<id>', 'Extension ID')
    .option('--keep-config', 'Keep extension config files', false)
    .action(async (id: string, opts) => {
      const result = await runExtensionRemove({ cwd: process.cwd(), id, keepConfig: opts.keepConfig })
      result.match(
        (r) => console.log(formatSuccess(`Removed ${r.id}@${r.version}`)),
        (e) => { console.error(formatError(formatCommandError(e), e.tag)); process.exit(1) },
      )
    })

  extension
    .command('search')
    .description('Search available extensions in the catalog')
    .option('--query <text>', 'Search query')
    .option('--tag <tag>', 'Filter by tag')
    .option('--author <author>', 'Filter by author')
    .option('--verified', 'Show only verified extensions', false)
    .action(async (opts) => {
      // TODO: fetch catalog from network, for now use empty catalog
      const catalog = { schemaVersion: '1.0', extensions: {} }
      const result = runExtensionSearch({
        catalog,
        query: opts.query,
        tag: opts.tag,
        author: opts.author,
        verifiedOnly: opts.verified,
      })
      result.match(
        (r) => console.log(r.formatted),
        (e) => { console.error(formatError(formatCommandError(e), e.tag)); process.exit(1) },
      )
    })

  extension
    .command('info')
    .description('Show detailed information about an extension')
    .argument('<id>', 'Extension ID')
    .action(async (id: string) => {
      // TODO: fetch catalog from network, for now use empty catalog
      const catalog = { schemaVersion: '1.0', extensions: {} }
      const registryResult = await import('./commands/extension/common.ts').then(m => m.loadRegistry(process.cwd()))
      const registry = registryResult.isOk() ? registryResult.value : emptyRegistry()
      const result = runExtensionInfo({ catalog, registry, id })
      result.match(
        (r) => console.log(r.formatted),
        (e) => { console.error(formatError(formatCommandError(e), e.tag)); process.exit(1) },
      )
    })

  extension
    .command('update')
    .description('Check for available extension updates')
    .action(async () => {
      // TODO: fetch catalog from network, for now use empty catalog
      const catalog = { schemaVersion: '1.0', extensions: {} }
      const result = await runExtensionUpdate({ cwd: process.cwd(), catalog })
      result.match(
        (r) => console.log(r.formatted),
        (e) => { console.error(formatError(formatCommandError(e), e.tag)); process.exit(1) },
      )
    })

  return program
}
