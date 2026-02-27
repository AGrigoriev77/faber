# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/faber.plan` command. See `.faber/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

### Error Handling Strategy

<!--
  Define how errors are handled at each architectural layer.
  AI agent uses this to generate appropriate error handling code and tests.
-->

| Layer | Error Type | Handling Strategy |
|-------|-----------|-------------------|
| [e.g., Input validation] | [e.g., ValidationError] | [e.g., Return Result.err with field details, never throw] |
| [e.g., Business logic] | [e.g., BusinessError] | [e.g., Discriminated union, propagate via .andThen()] |
| [e.g., I/O / Network] | [e.g., IoError] | [e.g., try/catch at boundary, wrap in Result, retry if transient] |
| [e.g., CLI / UI] | [e.g., All errors] | [e.g., .match() at top level, format for user, exit code] |

### Functional Patterns

<!--
  When the constitution includes Functional-First Architecture (Article IV),
  document the specific FP patterns this project will use.
  Skip this section if the project does not use FP.
-->

**Core Pattern**: Pure Core + Impure Shell
- Business logic lives in pure functions (same input → same output, no side effects)
- Side effects isolated at boundaries via adapter functions

**Result Type**: `Result<T, E>` for all fallible operations
- Chain operations: `.andThen()`, `.map()`, `.mapErr()`
- Terminal handling: `.match(onOk, onErr)` at CLI boundary
- No try/catch in business logic — only in I/O adapters

**Composition**: Pipe / Flow / Compose
- Data flows through function pipelines
- Each function takes one input, returns one output (or Result)

**Immutability**: Readonly by default
- `readonly` on all interface fields
- `ReadonlyArray<T>`, `ReadonlyMap<K, V>` for collections
- Update via spread operator (new object), never mutate

**Type Safety**: Make illegal states unrepresentable
- Branded types for domain concepts (IDs, paths, versions)
- Discriminated unions for state machines and error types
- Exhaustive pattern matching via `assertNever`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/faber.plan command output)
├── research.md          # Phase 0 output (/faber.plan command)
├── data-model.md        # Phase 1 output (/faber.plan command)
├── quickstart.md        # Phase 1 output (/faber.plan command)
├── contracts/           # Phase 1 output (/faber.plan command)
└── tasks.md             # Phase 2 output (/faber.tasks command - NOT created by /faber.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Domain Categories & Functors *(include if project has 5+ entities)*

<!--
  Group entities by domain category and identify functors (transformations between categories).
  This prevents a flat entity list from becoming unmanageable.
-->

| Category | Entities | Functor (transforms to) |
|----------|----------|------------------------|
| [e.g., Identity] | User, Session, Role | Auth → Permission |
| [e.g., Commerce] | Order, Payment, Cart | Cart → Order → Receipt |
| [e.g., Content] | Post, Comment, Media | Draft → Published |

## Data Flow Map *(mandatory)*

<!--
  Trace data transformations through the system.
  Show WHERE each component sits and what errors are possible at each step.
-->

```
[Input Source] → [Validation] → [Transform] → [Business Logic] → [Persistence] → [Response]
                    ↓ (fail)                      ↓ (fail)           ↓ (fail)
                ValidationError              BusinessError        StorageError
```

## Complexity Budget *(mandatory)*

<!--
  Contract on algorithmic complexity for critical operations.
  AI agent uses these constraints when choosing algorithms and data structures.
-->

| Operation | Max Complexity | Data Scale | Rationale |
|-----------|---------------|------------|-----------|
| [e.g., Search users] | O(n log n) | [e.g., 100K] | [e.g., Must respond < 200ms] |
| [e.g., List items] | O(n) | [e.g., 10K per user] | [e.g., Pagination required] |
| [e.g., Export report] | O(n) | [e.g., 1M records] | [e.g., Stream, don't load all] |

## Make Illegal States Unrepresentable *(mandatory)*

<!--
  Type design principle: invalid states should be impossible by construction.
  Use discriminated unions, not boolean flags + nullable fields.
-->

**Pattern**:

```
WRONG: Entity { status: string, data: T | null, error: string | null }
  → status="success" but data=null — illegal state possible

RIGHT: Entity = Pending {} | Success { data: T } | Failed { error: string }
  → illegal state impossible by construction
```

**Apply to key entities**:

| Entity | Wrong (allows illegal states) | Right (illegal states impossible) |
|--------|------------------------------|-----------------------------------|
| [Entity 1] | [boolean flags + nullables] | [discriminated union design] |
| [Entity 2] | [boolean flags + nullables] | [discriminated union design] |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
