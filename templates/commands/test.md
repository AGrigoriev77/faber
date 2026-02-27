---
description: Generate test scaffolding from spec acceptance criteria, invariants, failure modes, and contracts.
handoffs:
  - label: Implement Code
    agent: faber.implement
    prompt: All tests are written. Start implementation to make them pass.
    send: true
scripts:
  sh: bun scripts/ts/check-prerequisites.ts --json --require-spec
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

This command generates test scaffolding **before any implementation code exists**. Tests are written first (TDD red phase). The generated tests should fail until implementation is complete.

1. **Setup**: Run `{SCRIPT}` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute.

2. **Load design artifacts** from FEATURE_DIR:
   - **REQUIRED**: spec.md — acceptance criteria (Given/When/Then), failure modes, invariants, state machines, pre/post conditions, idempotency requirements
   - **REQUIRED**: plan.md — tech stack, testing framework, file structure
   - **IF EXISTS**: tasks.md — [TEST] tasks with specific test descriptions
   - **IF EXISTS**: data-model.md — entities and relationships to test
   - **IF EXISTS**: contracts/ — API contracts with request/response schemas

3. **Extract testable requirements** from spec.md:

   **A. Acceptance Criteria → Unit/Integration tests**
   Each Given/When/Then block becomes one or more test cases:
   ```
   Given: test setup/preconditions
   When: action under test
   Then: assertion(s)
   ```

   **B. Failure Modes → Error path tests**
   Each row in the Failure Modes table becomes a test:
   ```
   | Component | Failure | Impact | Mitigation |
   ```
   → Test that the mitigation actually works when the failure occurs.

   **C. Invariants → Property-based tests**
   Each invariant becomes a property-based test using the project's property testing library (e.g., fast-check, hypothesis, quickcheck):
   ```
   INV-1: User.balance >= 0 (ALWAYS)
   ```
   → `test.prop([...])('balance never goes negative', ...)`

   **D. State Machines → Transition tests**
   - Test each valid transition
   - Test each **forbidden** transition (must be rejected)
   - Test initial state

   **E. Pre/Post Conditions → Contract tests**
   Each pre/post condition becomes a test:
   - Pre-condition violated → operation rejected
   - Post-condition holds after successful operation
   - Conservation laws (e.g., sum remains constant)

   **F. Idempotency → Retry tests**
   Each idempotent operation gets:
   - Call once → verify result
   - Call twice with same key → same result, no side effects
   - Call with different key → different result

4. **Determine test structure** from plan.md:
   - Testing framework (vitest, jest, pytest, go test, etc.)
   - Test file location conventions (co-located, `tests/`, `__tests__/`)
   - Test naming conventions
   - Available test utilities and mocks

5. **Generate test files**:
   - Create test files following project conventions
   - Each test should have a descriptive name matching the requirement it tests
   - Group tests by source: acceptance criteria, failure modes, invariants, state machines, contracts
   - Include `// TODO: implement` or equivalent placeholder for test bodies that need implementation details
   - For property-based tests, include the property definition and arbitrary generators

6. **Test file structure** (per feature module):
   ```
   tests/
   ├── <module>.test.ts          # Acceptance criteria tests
   ├── <module>.errors.test.ts   # Failure mode tests
   ├── <module>.props.test.ts    # Property-based / invariant tests
   └── <module>.states.test.ts   # State machine transition tests (if applicable)
   ```

   Adapt file structure to project conventions from plan.md.

7. **Generate test summary**:
   - Total test count by category (acceptance, failure, property, state, contract, idempotency)
   - Coverage map: which spec requirements have tests, which don't
   - List any requirements that couldn't be converted to tests (explain why)

8. **If tasks.md exists**, cross-reference:
   - Mark [TEST] tasks as covered by generated tests
   - Flag any [TEST] tasks without corresponding generated tests
   - Flag any spec requirements without [TEST] tasks

## Rules

- **Tests MUST fail** — do not write implementation code. Tests define expected behavior before code exists.
- **One requirement = one test minimum** — every testable requirement from the spec must have at least one corresponding test.
- **Property-based tests for invariants** — do not use example-based tests for invariants. Use property-based testing to generate random inputs.
- **Forbidden transitions are tests** — every "NEVER" in a state machine is a test that asserts rejection.
- **No mocking internals** — mock at boundaries (I/O, network, time), not internal functions.
- **Test names describe behavior** — `it('rejects negative transfer amount')` not `it('test case 7')`.

## Output

After generating tests, display:

```
Test Scaffolding Summary
========================
Acceptance criteria:  N tests
Failure modes:        N tests
Invariants:           N tests (property-based)
State machines:       N tests (M forbidden transitions)
Pre/post conditions:  N tests
Idempotency:          N tests
─────────────────────────────
Total:                N tests

Files created:
  - tests/feature/module.test.ts
  - tests/feature/module.errors.test.ts
  - tests/feature/module.props.test.ts

Next: Run /faber.implement to write code that makes these tests pass.
```

## Error Handling

- If spec.md is missing, instruct user to run `/faber.specify` first.
- If spec.md has no testable sections (no acceptance criteria, no failure modes, no invariants), warn and suggest running `/faber.clarify` to improve the spec.
- If plan.md is missing tech stack info, ask user for testing framework before generating.
