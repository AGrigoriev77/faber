# faber

**CLI for Spec-Driven Development** — specs → plan → tasks → tests → code

A TypeScript rewrite of [spec-kit](https://github.com/idof/spec-kit) from scratch. The original is Python (~4,100 LOC). faber is ~2,400 LOC TypeScript + ~1,500 LOC tests, with an FP architecture (Result monads, immutability, pure functions) and mandatory TDD.

## What is it?

faber turns a natural language feature description into a full development cycle: specification, architectural plan, dependency-ordered tasks, tests, and code. Works with 19 AI agents (Claude, Copilot, Gemini, Cursor, and more).

Instead of jumping straight to code, faber forces you to think first: what are we building, how are we building it, what are the edge cases, what are the tests. The AI agent receives structured context and generates code from a precise specification, not a vague prompt.

### Differences from spec-kit

- **Language**: Python → TypeScript (Bun runtime)
- **Architecture**: imperative try/catch → FP: Result monads, `.andThen()` pipelines, discriminated unions, branded types
- **Tests**: optional → mandatory (TDD gate: `[TEST]` tasks block `[IMPL]`)
- **Templates**: extended — added Failure Modes, Invariants, State Machines, Pre/Post Conditions, Idempotency, Complexity Budget, property-based tests
- **New command `/faber.test`**: test scaffolding generation from acceptance criteria, invariants, failure modes, and state machines
- **Agents**: 19 supported formats (16 with unique command directories)

## Quick Start

```bash
# Install
bun install -g faber

# Initialize a new project
faber init my-app --ai claude

# Or in an existing project
cd my-app && faber init --here --ai claude
```

After initialization, slash commands are available in your AI agent:

```
/faber.specify   — create a feature specification
/faber.plan      — generate an architectural plan
/faber.tasks     — break the plan into dependency-ordered tasks
/faber.test      — generate tests from the specification (TDD red phase)
/faber.implement — write code to make tests pass
/faber.clarify   — clarify underspecified areas in the spec
/faber.analyze   — check cross-artifact consistency
/faber.checklist — generate a custom checklist for the feature
```

## Workflow

```
Feature description
    ↓ /faber.specify
Specification (failure modes, invariants, state machines, contracts)
    ↓ /faber.plan
Architectural plan (data flow, complexity budget, type design)
    ↓ /faber.tasks
Dependency-ordered tasks ([TEST] tasks block [IMPL])
    ↓ /faber.test
Tests from spec (acceptance criteria → test stubs, invariants → property tests)
    ↓ All tests red? TDD gate passed.
    ↓ /faber.implement
Code until green (green → refactor)
```

## What `/faber.test` generates

The command reads the specification and creates test scaffolding:

| Spec section | Test type |
|--------------|-----------|
| Acceptance criteria (Given/When/Then) | Unit / integration tests |
| Failure Modes table | Error path tests |
| Invariants (INV-1, INV-2...) | Property-based tests |
| State Machines (forbidden transitions) | Transition tests |
| Pre/Post Conditions | Contract tests |
| Idempotency requirements | Retry tests |

## Supported AI Agents

| Agent | ID | Commands directory | Format |
|-------|----|--------------------|--------|
| Claude Code | `claude` | `.claude/commands/` | Markdown |
| GitHub Copilot | `copilot` | `.github/agents/` | Markdown |
| Gemini CLI | `gemini` | `.gemini/commands/` | TOML |
| Cursor | `cursor` | `.cursor/commands/` | Markdown |
| Amazon Q Developer | `q` | `.amazonq/prompts/` | Markdown |
| Windsurf | `windsurf` | `.windsurf/workflows/` | Markdown |
| Amp | `amp` | `.agents/commands/` | Markdown |
| Augment (Auggie) | `auggie` | `.augment/rules/` | Markdown |
| IBM Bob | `bob` | `.bob/commands/` | Markdown |
| CodeBuddy | `codebuddy` | `.codebuddy/commands/` | Markdown |
| Kilo Code | `kilocode` | `.kilocode/rules/` | Markdown |
| opencode | `opencode` | `.opencode/command/` | Markdown |
| Qoder CLI | `qodercli` | `.qoder/commands/` | Markdown |
| Qwen Code | `qwen` | `.qwen/commands/` | TOML |
| Roo Code | `roo` | `.roo/rules/` | Markdown |
| SHAI | `shai` | `.shai/commands/` | Markdown |
| Antigravity | `agy` | — | — |
| Codex CLI | `codex` | — | — |
| Generic | `generic` | — | — |

## What `faber init` generates

```
my-app/
├── .faber/
│   └── templates/          # Spec, plan, and task templates
├── .claude/commands/        # Slash commands for the selected agent
│   ├── faber.specify.md
│   ├── faber.plan.md
│   ├── faber.tasks.md
│   ├── faber.test.md
│   ├── faber.implement.md
│   └── ...
├── .vscode/settings.json   # Editor settings
└── .git/                   # Git repository (unless --no-git)
```

## Architectural Safeguards in Templates

faber templates embed eight defensive mechanisms into the development process:

- **Failure Mode Analysis** — failure table for each component → test for each failure
- **Invariants** — business rules that must always hold → property-based tests
- **State Machines** — explicit states and forbidden transitions → test for each forbidden transition
- **Pre/Post Conditions** — contracts on critical operations → test for each condition
- **Idempotency** — which operations are safe to retry → test for duplicate calls
- **Data Flow Map** — where data flows and where errors can occur
- **Complexity Budget** — algorithmic complexity constraints
- **Make Illegal States Unrepresentable** — invalid states are impossible by type construction

## CLI

```bash
faber init [name]        # Initialize a project
  --ai <agent>           # AI agent (claude, copilot, gemini, cursor...)
  --script <sh|ps>       # Script type (bash or powershell)
  --here                 # Initialize in the current directory
  --no-git               # Skip git init

faber check              # Check installed tools
faber version            # Show version
```

## Development

```bash
git clone https://github.com/AGrigoriev77/faber.git
cd faber
bun install
bun test                 # 403 tests
bunx tsc --noEmit        # Type check
```

## License

MIT
