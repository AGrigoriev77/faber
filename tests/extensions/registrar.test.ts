import { describe, it, expect } from 'vitest'
import {
  AGENT_FORMATS,
  getAgentFormat,
  parseFrontmatter,
  renderFrontmatter,
  renderMarkdownCommand,
  renderTomlCommand,
  convertArgPlaceholder,
  adjustScriptPaths,
} from '../../src/extensions/registrar.ts'

// --- AGENT_FORMATS ---

describe('AGENT_FORMATS', () => {
  it('has 16 agent entries', () => {
    expect(AGENT_FORMATS.size).toBe(16)
  })

  it('claude uses markdown format', () => {
    const claude = AGENT_FORMATS.get('claude')!
    expect(claude.format).toBe('markdown')
    expect(claude.dir).toBe('.claude/commands')
    expect(claude.args).toBe('$ARGUMENTS')
    expect(claude.extension).toBe('.md')
  })

  it('gemini uses toml format', () => {
    const gemini = AGENT_FORMATS.get('gemini')!
    expect(gemini.format).toBe('toml')
    expect(gemini.dir).toBe('.gemini/commands')
    expect(gemini.args).toBe('{{args}}')
    expect(gemini.extension).toBe('.toml')
  })

  it('qwen uses toml format', () => {
    const qwen = AGENT_FORMATS.get('qwen')!
    expect(qwen.format).toBe('toml')
    expect(qwen.args).toBe('{{args}}')
  })

  it('copilot uses .github/agents dir', () => {
    expect(AGENT_FORMATS.get('copilot')!.dir).toBe('.github/agents')
  })

  it('opencode uses singular command dir', () => {
    expect(AGENT_FORMATS.get('opencode')!.dir).toBe('.opencode/command')
  })

  it('q uses .amazonq/prompts dir', () => {
    expect(AGENT_FORMATS.get('q')!.dir).toBe('.amazonq/prompts')
  })

  it('all agent formats have required fields', () => {
    for (const [agent, format] of AGENT_FORMATS) {
      expect(format.dir, `${agent} dir`).toBeTruthy()
      expect(format.format, `${agent} format`).toMatch(/^(markdown|toml)$/)
      expect(format.args, `${agent} args`).toBeTruthy()
      expect(format.extension, `${agent} extension`).toMatch(/^\.\w+$/)
    }
  })

  it('each agent entry is a tuple [string, AgentFormat]', () => {
    const agents = [...AGENT_FORMATS.keys()]
    expect(agents.length).toBe(16)
    for (const key of agents) {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    }
  })

  it('markdown agents use .md extension and $ARGUMENTS', () => {
    for (const [, format] of AGENT_FORMATS) {
      if (format.format === 'markdown') {
        expect(format.extension).toBe('.md')
        expect(format.args).toBe('$ARGUMENTS')
      }
    }
  })

  it('toml agents use .toml extension and {{args}}', () => {
    for (const [, format] of AGENT_FORMATS) {
      if (format.format === 'toml') {
        expect(format.extension).toBe('.toml')
        expect(format.args).toBe('{{args}}')
      }
    }
  })

  it('every dir starts with a dot', () => {
    for (const [, format] of AGENT_FORMATS) {
      expect(format.dir.startsWith('.')).toBe(true)
    }
  })
})

describe('getAgentFormat', () => {
  it('returns ok for known agent', () => {
    const result = getAgentFormat('claude')
    expect(result.isOk()).toBe(true)
  })

  it('returns err for unknown agent', () => {
    const result = getAgentFormat('nonexistent')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().tag).toBe('unsupported_agent')
  })
})

// --- parseFrontmatter ---

describe('parseFrontmatter', () => {
  it('parses valid frontmatter + body', () => {
    const content = `---
description: Hello
scripts:
  run: scripts/run.sh
---

Body content here.`
    const [fm, body] = parseFrontmatter(content)
    expect(fm['description']).toBe('Hello')
    expect((fm['scripts'] as Record<string, string>)['run']).toBe('scripts/run.sh')
    expect(body).toBe('Body content here.')
  })

  it('returns empty frontmatter when no delimiters', () => {
    const [fm, body] = parseFrontmatter('Just body text')
    expect(fm).toEqual({})
    expect(body).toBe('Just body text')
  })

  it('returns empty frontmatter when only opening delimiter', () => {
    const [fm, body] = parseFrontmatter('---\nno closing')
    expect(fm).toEqual({})
    expect(body).toBe('---\nno closing')
  })

  it('handles empty frontmatter block', () => {
    const [fm, body] = parseFrontmatter('---\n---\nBody')
    expect(fm).toEqual({})
    expect(body).toBe('Body')
  })

  it('handles invalid YAML in frontmatter gracefully', () => {
    const [fm, body] = parseFrontmatter('---\n{{bad yaml\n---\nBody')
    expect(fm).toEqual({})
    expect(body).toBe('Body')
  })
})

// --- renderFrontmatter ---

describe('renderFrontmatter', () => {
  it('renders frontmatter with delimiters', () => {
    const result = renderFrontmatter({ description: 'Hello' })
    expect(result).toContain('---')
    expect(result).toContain('description: Hello')
  })

  it('returns empty string for empty object', () => {
    expect(renderFrontmatter({})).toBe('')
  })
})

// --- renderMarkdownCommand ---

describe('renderMarkdownCommand', () => {
  it('combines frontmatter + context note + body', () => {
    const result = renderMarkdownCommand({ description: 'Test' }, 'Body here', 'my-ext')
    expect(result).toContain('description: Test')
    expect(result).toContain('<!-- Extension: my-ext -->')
    expect(result).toContain('Body here')
  })

  it('includes config path in context', () => {
    const result = renderMarkdownCommand({}, 'body', 'jira')
    expect(result).toContain('<!-- Config: .faber/extensions/jira/ -->')
  })
})

// --- renderTomlCommand ---

describe('renderTomlCommand', () => {
  it('renders TOML with description and prompt', () => {
    const result = renderTomlCommand({ description: 'My command' }, 'Prompt body', 'my-ext')
    expect(result).toContain('description = "My command"')
    expect(result).toContain('# Extension: my-ext')
    expect(result).toContain('prompt = """')
    expect(result).toContain('Prompt body')
    expect(result).toContain('"""')
  })

  it('escapes quotes in description', () => {
    const result = renderTomlCommand({ description: 'Say "hello"' }, 'body', 'ext')
    expect(result).toContain('description = "Say \\"hello\\""')
  })

  it('omits description line when missing', () => {
    const result = renderTomlCommand({}, 'body', 'ext')
    expect(result).not.toContain('description =')
    expect(result).toContain('prompt = """')
  })
})

// --- convertArgPlaceholder ---

describe('convertArgPlaceholder', () => {
  it('converts $ARGUMENTS to {{args}}', () => {
    expect(convertArgPlaceholder('Use $ARGUMENTS here', '$ARGUMENTS', '{{args}}'))
      .toBe('Use {{args}} here')
  })

  it('converts multiple occurrences', () => {
    expect(convertArgPlaceholder('$ARGUMENTS and $ARGUMENTS', '$ARGUMENTS', '{{args}}'))
      .toBe('{{args}} and {{args}}')
  })

  it('no-op when placeholder not found', () => {
    expect(convertArgPlaceholder('no args', '$ARGUMENTS', '{{args}}'))
      .toBe('no args')
  })
})

// --- adjustScriptPaths ---

describe('adjustScriptPaths', () => {
  it('rewrites ../../scripts/ to .faber/scripts/', () => {
    const fm = {
      scripts: { run: '../../scripts/bash/run.sh', check: '../../scripts/check.sh' },
    }
    const result = adjustScriptPaths(fm)
    const scripts = result['scripts'] as Record<string, string>
    expect(scripts['run']).toBe('.faber/scripts/bash/run.sh')
    expect(scripts['check']).toBe('.faber/scripts/check.sh')
  })

  it('does not mutate original', () => {
    const fm = { scripts: { run: '../../scripts/run.sh' } }
    adjustScriptPaths(fm)
    expect((fm['scripts'] as Record<string, string>)['run']).toBe('../../scripts/run.sh')
  })

  it('passes through non-relative paths', () => {
    const fm = { scripts: { run: 'local/run.sh' } }
    const result = adjustScriptPaths(fm)
    expect((result['scripts'] as Record<string, string>)['run']).toBe('local/run.sh')
  })

  it('returns unchanged if no scripts key', () => {
    const fm = { description: 'hello' }
    expect(adjustScriptPaths(fm)).toEqual({ description: 'hello' })
  })
})
