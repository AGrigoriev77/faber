---
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs:
  - label: Generate Test Scaffolding
    agent: faber.test
    prompt: Generate test scaffolding from spec acceptance criteria
    send: true
  - label: Analyze For Consistency
    agent: faber.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: faber.implement
    prompt: Start the implementation in phases
    send: true
scripts:
  sh: bun scripts/check-prerequisites.ts --json
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `{SCRIPT}` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (interface contracts), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map interface contracts to user stories
   - If research.md exists: Extract decisions for setup tasks
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)

4. **Generate tasks.md**: Use `templates/tasks-template.md` as structure, fill with:
   - Correct feature name from plan.md
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
   - Each phase includes: story goal, independent test criteria, tests (if requested), implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Dependencies section showing story completion order
   - Parallel execution examples per story
   - Implementation strategy section (MVP first, incremental delivery)

5. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - Task count per user story
   - Parallel opportunities identified
   - Independent test criteria for each story
   - Suggested MVP scope (typically just User Story 1)
   - Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, labels, file paths)

Context for task generation: {ARGS}

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**Tests are MANDATORY**: Every user story MUST have `[TEST]` tasks generated from acceptance criteria. Tests are written FIRST and must FAIL before implementation begins (TDD Gate). This is NON-NEGOTIABLE.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] marker**: Include ONLY if task is parallelizable (different files, no dependencies on incomplete tasks)
4. **[Story] label**: REQUIRED for user story phase tasks only
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label  
   - User Story phases: MUST have story label
   - Polish phase: NO story label
5. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
- ✅ CORRECT: `- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- ✅ CORRECT: `- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ❌ WRONG: `- [ ] Create User model` (missing ID and Story label)
- ❌ WRONG: `T001 [US1] Create model` (missing checkbox)
- ❌ WRONG: `- [ ] [US1] Create User model` (missing Task ID)
- ❌ WRONG: `- [ ] T001 [US1] Create model` (missing file path)

### Task Organization

1. **From User Stories (spec.md)** - PRIMARY ORGANIZATION:
   - Each user story (P1, P2, P3...) gets its own phase
   - Map all related components to their story:
     - Models needed for that story
     - Services needed for that story
     - Interfaces/UI needed for that story
     - If tests requested: Tests specific to that story
   - Mark story dependencies (most stories should be independent)

2. **From Contracts**:
   - Map each interface contract → to the user story it serves
   - If tests requested: Each interface contract → contract test task [P] before implementation in that story's phase

3. **From Data Model**:
   - Map each entity to the user story(ies) that need it
   - If entity serves multiple stories: Put in earliest story or Setup phase
   - Relationships → service layer tasks in appropriate story phase

4. **From Setup/Infrastructure**:
   - Shared infrastructure → Setup phase (Phase 1)
   - Foundational/blocking tasks → Foundational phase (Phase 2)
   - Story-specific setup → within that story's phase

### Phase Structure

- **Phase 1**: Setup (project initialization)
- **Phase 2**: Foundational (blocking prerequisites - MUST complete before user stories)
- **Phase 3+**: User Stories in priority order (P1, P2, P3...)
  - Within each story: Tests (if requested) → Models → Services → Endpoints → Integration
  - Each phase should be a complete, independently testable increment
- **Final Phase**: Polish & Cross-Cutting Concerns

### TDD Task Generation (MANDATORY)

For EVERY user story acceptance criterion in spec.md:

1. **Extract testable criteria** — each "Given/When/Then" or acceptance criterion → one `[TEST]` task
2. **Generate test task** — format: `- [ ] TXXX [P] [USN] [TEST] Write test: {criterion description} in tests/{path}`
3. **Place before implementation** — all `[TEST]` tasks appear BEFORE `[IMPL]` tasks within each user story phase
4. **TDD Gate** — implementation tasks CANNOT begin until ALL `[TEST]` tasks in that phase are marked `[X]` and tests FAIL (red phase)

Example mapping:
```
spec.md: "User can reset password via email"
→ - [ ] T010 [P] [US1] [TEST] Write test: password reset sends email in tests/unit/test_password_reset.py
→ - [ ] T011 [P] [US1] [TEST] Write integration test: full password reset flow in tests/integration/test_reset_flow.py
```

### Failure Mode Test Generation

For EVERY row in the spec.md Failure Modes table:

1. **Map failure → test** — each failure mode row → one `[TEST]` task
2. **Format**: `- [ ] TXXX [P] [USN] [TEST] Write test: {component} {failure} → {mitigation} in tests/{path}`
3. **Include in the phase** of the user story that owns the component

Example mapping:
```
Failure Modes table: | Payment API | 500 error | Order stuck | Retry queue |
→ - [ ] T015 [P] [US2] [TEST] Write test: Payment API returns 500 → order retries via queue in tests/integration/test_payment_retry.py
```

### Category-Aware Task Generation

When plan.md contains a "Domain Categories & Functors" table:

1. **Group tasks by domain category** — within each user story, organize tasks by the domain category they belong to
2. **Respect functor boundaries** — transformations between categories (functors) get their own tasks
3. **Order by dependency** — categories that are functor inputs come before categories that are functor outputs
4. **Cross-category integration** — add explicit integration tasks where functors connect categories

Example:
```
Category: Identity (User, Session) → Category: Commerce (Order, Cart)
Functor: Auth → Permission

→ Phase 3 tasks ordered: Identity models → Auth functor → Commerce models → Integration
```
