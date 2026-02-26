# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Test Strategy *(mandatory)*

<!--
  Map acceptance scenarios to concrete test types.
  Every scenario above must appear in at least one row.
-->

| Scenario | Test Type | Given / When / Then |
|----------|-----------|---------------------|
| [US1-S1] | Unit | Given [state], When [action], Then [assertion] |
| [US1-S2] | Integration | Given [state], When [action], Then [assertion] |

## Failure Modes *(mandatory)*

<!--
  For each component that can fail, describe the failure, its impact,
  and the mitigation. Each row becomes a [TEST] task.
-->

| Component | Failure | Impact | Mitigation |
|-----------|---------|--------|------------|
| [Component 1] | [How it fails] | [User-visible impact] | [How system recovers] |
| [Component 2] | [How it fails] | [User-visible impact] | [How system recovers] |

## Invariants *(mandatory)*

<!--
  Business rules that must ALWAYS hold, regardless of input.
  Each invariant becomes a property-based test on random data.
-->

- **INV-1**: [Rule that must always be true, e.g., "User.balance >= 0"]
- **INV-2**: [Rule that must always be true, e.g., "Order.items.length > 0 when status != draft"]
- **INV-3**: [Conservation law, e.g., "sum of all account balances = constant"]

## State Machines *(include if feature has entities with lifecycle)*

<!--
  Explicit states, transitions, and FORBIDDEN transitions.
  Each forbidden transition becomes a [TEST] task.
-->

```
[initial] → [state-A] → [state-B] → [final]
                ↓
           [cancelled]

Forbidden transitions:
- cancelled → state-B (NEVER)
- final → initial (NEVER)
- initial → final (MUST go through state-A)
```

## Pre/Post Conditions *(include if feature has critical operations)*

<!--
  Design by Contract: what must be true BEFORE and AFTER each critical operation.
  Each condition becomes a [TEST] task.
-->

### Contract: [operationName](params)

- **Pre**: [condition that must hold before, e.g., "amount > 0"]
- **Pre**: [condition that must hold before, e.g., "from != to"]
- **Post**: [condition that must hold after, e.g., "from.balance == old(from.balance) - amount"]
- **Post**: [conservation law, e.g., "from.balance + to.balance == old(from.balance) + old(to.balance)"]

## Idempotency Requirements *(include if feature has retriable operations)*

<!--
  Any operation that may be called more than once (network, queues, retries).
  Each idempotent operation becomes a [TEST] task: call twice → same result, no side effects.
-->

| Operation | Idempotent? | Key | Behavior on retry |
|-----------|-------------|-----|-------------------|
| [Operation 1] | Yes | [unique key] | Return existing result |
| [Operation 2] | No | — | [Dedup strategy required] |

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
