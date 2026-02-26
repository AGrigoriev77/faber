import { describe, it, expect } from 'vitest'
import { test } from '@fast-check/vitest'
import fc from 'fast-check'
import {
  compareVersions,
  checkCompatibility,
  checkNotInstalled,
  checkIsInstalled,
  buildRegistryEntry,
  renderCommandForAgent,
  extensionDir,
  commandTargetPath,
} from '../../src/extensions/manager.ts'
import { emptyRegistry, addExtension } from '../../src/extensions/registry.ts'
import type { Manifest } from '../../src/extensions/manifest.ts'
import type { AgentFormat } from '../../src/extensions/registrar.ts'

// --- compareVersions ---

describe('compareVersions', () => {
  it('equal versions return 0', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })

  it('greater major returns positive', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0)
  })

  it('lesser major returns negative', () => {
    expect(compareVersions('0.9.0', '1.0.0')).toBeLessThan(0)
  })

  it('compares minor when major equal', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0)
    expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0)
  })

  it('compares patch when major.minor equal', () => {
    expect(compareVersions('1.2.3', '1.2.1')).toBeGreaterThan(0)
    expect(compareVersions('1.2.1', '1.2.3')).toBeLessThan(0)
  })

  it('handles missing patch (treats as 0)', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
  })

  test.prop([
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  ])('version equals itself', (a, b, c) => {
    const v = `${a}.${b}.${c}`
    expect(compareVersions(v, v)).toBe(0)
  })

  test.prop([
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  ])('comparison is antisymmetric', (a, b, c) => {
    const v1 = `${a}.${b}.${c}`
    const v2 = `${a}.${b}.${c + 1}`
    expect(Math.sign(compareVersions(v1, v2))).toBe(-Math.sign(compareVersions(v2, v1)))
  })
})

// --- checkCompatibility ---

describe('checkCompatibility', () => {
  it('passes when version satisfies >=', () => {
    const result = checkCompatibility('1.0.0', '>=0.5.0')
    expect(result.isOk()).toBe(true)
  })

  it('passes when version equals >=', () => {
    const result = checkCompatibility('0.5.0', '>=0.5.0')
    expect(result.isOk()).toBe(true)
  })

  it('fails when version below >=', () => {
    const result = checkCompatibility('0.4.0', '>=0.5.0')
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('compatibility')
    if (error.tag === 'compatibility') {
      expect(error.required).toBe('>=0.5.0')
      expect(error.actual).toBe('0.4.0')
    }
  })

  it('handles < constraint', () => {
    expect(checkCompatibility('1.0.0', '<2.0.0').isOk()).toBe(true)
    expect(checkCompatibility('2.0.0', '<2.0.0').isErr()).toBe(true)
  })

  it('handles combined constraints (>=X,<Y)', () => {
    expect(checkCompatibility('1.5.0', '>=1.0.0,<2.0.0').isOk()).toBe(true)
    expect(checkCompatibility('0.9.0', '>=1.0.0,<2.0.0').isErr()).toBe(true)
    expect(checkCompatibility('2.0.0', '>=1.0.0,<2.0.0').isErr()).toBe(true)
  })

  it('handles == constraint', () => {
    expect(checkCompatibility('1.0.0', '==1.0.0').isOk()).toBe(true)
    expect(checkCompatibility('1.0.1', '==1.0.0').isErr()).toBe(true)
  })

  it('handles <= constraint', () => {
    expect(checkCompatibility('1.0.0', '<=1.0.0').isOk()).toBe(true)
    expect(checkCompatibility('1.0.1', '<=1.0.0').isErr()).toBe(true)
  })

  it('handles > constraint', () => {
    expect(checkCompatibility('1.0.1', '>1.0.0').isOk()).toBe(true)
    expect(checkCompatibility('1.0.0', '>1.0.0').isErr()).toBe(true)
  })
})

// --- checkNotInstalled ---

describe('checkNotInstalled', () => {
  it('ok when extension not in registry', () => {
    const registry = emptyRegistry()
    expect(checkNotInstalled(registry, 'my-ext').isOk()).toBe(true)
  })

  it('err when extension already installed', () => {
    const registry = addExtension(emptyRegistry(), 'my-ext', {
      version: '1.0.0',
      source: 'local',
      installedAt: new Date().toISOString(),
    })
    const result = checkNotInstalled(registry, 'my-ext')
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.tag).toBe('already_installed')
  })
})

// --- checkIsInstalled ---

describe('checkIsInstalled', () => {
  it('ok with entry when installed', () => {
    const entry = { version: '1.0.0', source: 'local', installedAt: new Date().toISOString() }
    const registry = addExtension(emptyRegistry(), 'my-ext', entry)
    const result = checkIsInstalled(registry, 'my-ext')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().version).toBe('1.0.0')
  })

  it('err when not installed', () => {
    const result = checkIsInstalled(emptyRegistry(), 'nope')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('not_installed')
  })
})

// --- buildRegistryEntry ---

const makeManifest = (overrides: Partial<Manifest> = {}): Manifest => ({
  schemaVersion: '1.0',
  extension: {
    id: 'test-ext',
    name: 'Test Extension',
    version: '1.2.3',
    description: 'A test extension',
  },
  requires: { faberVersion: '>=0.1.0' },
  provides: { commands: [{ name: 'test-cmd', file: 'commands/test.md' }] },
  hooks: {},
  ...overrides,
})

describe('buildRegistryEntry', () => {
  it('creates entry from manifest', () => {
    const manifest = makeManifest()
    const entry = buildRegistryEntry(manifest, 'local')
    expect(entry.version).toBe('1.2.3')
    expect(entry.source).toBe('local')
    expect(entry.installedAt).toBeDefined()
  })

  it('uses manifest version', () => {
    const manifest = makeManifest({
      extension: { id: 'x', name: 'X', version: '3.0.0', description: '' },
    })
    const entry = buildRegistryEntry(manifest, 'catalog')
    expect(entry.version).toBe('3.0.0')
  })

  it('installedAt is valid ISO date', () => {
    const entry = buildRegistryEntry(makeManifest(), 'local')
    const date = new Date(entry.installedAt)
    expect(isNaN(date.getTime())).toBe(false)
  })
})

// --- renderCommandForAgent ---

describe('renderCommandForAgent', () => {
  const markdownFormat: AgentFormat = {
    dir: '.claude/commands',
    format: 'markdown',
    args: '$ARGUMENTS',
    extension: '.md',
  }

  const tomlFormat: AgentFormat = {
    dir: '.gemini/commands',
    format: 'toml',
    args: '{{args}}',
    extension: '.toml',
  }

  const source = `---
description: My command
---

Do the thing with $ARGUMENTS`

  it('renders markdown format with context comments', () => {
    const result = renderCommandForAgent(source, 'claude', markdownFormat, 'my-ext')
    expect(result.content).toContain('<!-- Extension: my-ext -->')
    expect(result.content).toContain('description: My command')
    expect(result.content).toContain('Do the thing with $ARGUMENTS')
  })

  it('renders toml format with prompt block', () => {
    const result = renderCommandForAgent(source, 'gemini', tomlFormat, 'my-ext')
    expect(result.content).toContain('prompt = """')
    expect(result.content).toContain('# Extension: my-ext')
    expect(result.content).toContain('Do the thing with {{args}}')
  })

  it('converts arg placeholder for toml format', () => {
    const result = renderCommandForAgent(source, 'gemini', tomlFormat, 'my-ext')
    expect(result.content).not.toContain('$ARGUMENTS')
    expect(result.content).toContain('{{args}}')
  })

  it('preserves arg placeholder for markdown format using $ARGUMENTS', () => {
    const result = renderCommandForAgent(source, 'claude', markdownFormat, 'my-ext')
    expect(result.content).toContain('$ARGUMENTS')
  })

  it('sets correct agentName', () => {
    const result = renderCommandForAgent(source, 'claude', markdownFormat, 'my-ext')
    expect(result.agentName).toBe('claude')
  })

  it('sets correct relativePath', () => {
    const result = renderCommandForAgent(source, 'claude', markdownFormat, 'my-ext')
    expect(result.relativePath).toBe('.claude/commands/my-ext.md')
  })

  it('handles source without frontmatter', () => {
    const result = renderCommandForAgent('Just a body', 'claude', markdownFormat, 'my-ext')
    expect(result.content).toContain('Just a body')
    expect(result.content).toContain('<!-- Extension: my-ext -->')
  })

  it('adjusts script paths in frontmatter', () => {
    const sourceWithScripts = `---
description: Test
scripts:
  run: ../../scripts/bash/run.sh
---

Body`
    const result = renderCommandForAgent(sourceWithScripts, 'claude', markdownFormat, 'my-ext')
    expect(result.content).toContain('.faber/scripts/bash/run.sh')
    expect(result.content).not.toContain('../../scripts/')
  })
})

// --- extensionDir ---

describe('extensionDir', () => {
  it('joins project root with .faber/extensions/<id>', () => {
    const result = extensionDir('/home/user/project', 'jira-sync')
    expect(result).toBe('/home/user/project/.faber/extensions/jira-sync')
  })

  it('handles trailing slash in project root', () => {
    const result = extensionDir('/home/user/project/', 'my-ext')
    // path.join normalizes
    expect(result).toContain('.faber/extensions/my-ext')
  })
})

// --- commandTargetPath ---

describe('commandTargetPath', () => {
  const mdFormat: AgentFormat = {
    dir: '.claude/commands',
    format: 'markdown',
    args: '$ARGUMENTS',
    extension: '.md',
  }

  const tomlFormat: AgentFormat = {
    dir: '.gemini/commands',
    format: 'toml',
    args: '{{args}}',
    extension: '.toml',
  }

  it('builds markdown command path', () => {
    const result = commandTargetPath('/project', mdFormat, 'my-cmd')
    expect(result).toBe('/project/.claude/commands/my-cmd.md')
  })

  it('builds toml command path', () => {
    const result = commandTargetPath('/project', tomlFormat, 'my-cmd')
    expect(result).toBe('/project/.gemini/commands/my-cmd.toml')
  })
})
