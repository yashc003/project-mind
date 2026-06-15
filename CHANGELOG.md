# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-14

### Added
- **Git-Native Persistence Split**: Memory is now split into `.project-mind/authored` (tracked by Git) and `.project-mind/derived` (ephemeral data).
- **Readiness Doctor Validation**: Run `project-mind doctor` to validate intelligence health, budget constraints, schema validity, and integrations.
- **Context Relevance Engine**: Progressive detail reduction and Scope Pruning when using `project-mind pack <target> --budget <tokens>`. Automatically degrades Graph distances into Summaries and References to fit within the LLM context limits while protecting the minimum critical context.
- **IDE Interoperability Registry**: Added `project-mind install-ide` to inject Project-Mind directly into `.cursorrules`, `.windsurfrules`, `.clinerules`, and 8 other AI coding assistants.
- **Git Hooks Automation**: Added `project-mind install-hooks` for asynchronous background updates after every `git commit` and `git checkout` via lock-protected hooks. Husky (`.husky/`) natively supported.
- **Plugin System**: Fully typed SDK (`ProjectMindPlugin`) for building framework-specific insight plugins. Includes zero-config official plugins for **React, FastAPI, Spring Boot, NestJS, Express, Django, Laravel, and SvelteKit**.
- **E2E Smoke Tests**: Robust lifecycle test matrix (`tests/e2e/runner.test.ts`) covering Node, React, Spring Boot, FastAPI, Express, Django, Laravel, and SvelteKit fixtures.
- **Migration Engine**: Automatic schema migration for backwards compatibility (`project-mind repair`).
- **Compatibility Matrix & Performance Budgets**: Added strict Service Level Objectives and versioning to the documentation.
- **Handlebars Templates**: Fully decoupled `AI_START_HERE.md` template compilation for predictable context handoff.
- **Type-Safe Governance**: Evaluator strictly enforcing architecture dependencies, feature tagging, and orphan checks.

### Changed
- Migrated schema from `currentTask` to `focusHistory` for richer lifecycle tracking.
- `AI_START_HERE.md` now enforces the presence of `Current Focus` and `Features` sections unconditionally.
- Removed embedded templates directory reference from `package.json` to prevent packaging errors.

### Fixed
- Fixed all silent TypeScript compilation errors that previously shipped.
- Corrected Commander program CLI output mismatch (now reports `1.0.0`).
- Fixed optimistic concurrency handling for manual edits to `MEMORY.json`.
- Fixed E2E runner bugs related to unhandled timeouts and filesystem race conditions on Windows.
