# [PROJECT_NAME] Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### [PRINCIPLE_1_NAME]
<!-- Example: I. Library-First -->
[PRINCIPLE_1_DESCRIPTION]
<!-- Example: Every feature starts as a standalone library; Libraries must be self-contained, independently testable, documented; Clear purpose required - no organizational-only libraries -->

### [PRINCIPLE_2_NAME]
<!-- Example: II. CLI Interface -->
[PRINCIPLE_2_DESCRIPTION]
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### III. Test-First Imperative (NON-NEGOTIABLE)

TDD is mandatory for all implementation work. The Red-Green-Refactor cycle is strictly enforced:

1. **RED**: Write failing tests FIRST — tests define the contract before code exists
2. **GREEN**: Write minimal code to make tests pass — no more, no less
3. **REFACTOR**: Improve code while keeping tests green — clean without breaking

**TDD Gate**: No `[IMPL]` task may begin until ALL `[TEST]` tasks in the same user story are completed and tests FAIL. This gate is checked by the `/faber.implement` command and cannot be bypassed.

**Test Coverage Requirements**:
- Every acceptance criterion → at least one test
- Every Failure Mode row → at least one test
- Every Pre/Post Condition → at least one property-based test
- Every forbidden state transition → at least one test

### IV. Functional-First Architecture (RECOMMENDED)

Pure functions for business logic, side effects isolated at boundaries:

1. **Result\<T, E\> over try/catch** — all fallible operations return Result, chained via `.andThen()`, `.map()`, `.match()`. try/catch only in I/O adapters
2. **Immutability** — `readonly` on interfaces, `ReadonlyArray<T>`, update via spread. No mutations
3. **Pipe/Compose** — data flows through function pipelines: `pipe(validate, transform, persist)`
4. **Pure Core + Impure Shell** — business logic is pure (same input → same output), I/O is isolated in adapters that wrap results

**Architecture Layers**: CLI (impure) → Commands (thin glue) → Core (pure) → Effects (impure adapters)

### V. Compositional Architecture (RECOMMENDED — for projects with 5+ entities)

When the project has 5+ domain entities, apply compositional patterns to prevent complexity explosion:

1. **Domain Categories** — group related entities (Identity, Commerce, Content) rather than flat lists
2. **Functors** — explicit transformations between categories (Cart → Order, Draft → Published)
3. **Complexity Budget** — each critical operation has a max algorithmic complexity contract
4. **Make Illegal States Unrepresentable** — use discriminated unions, not boolean flags + nullable fields

## [SECTION_2_NAME]
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

[SECTION_2_CONTENT]
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## [SECTION_3_NAME]
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

[SECTION_3_CONTENT]
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]
<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->
