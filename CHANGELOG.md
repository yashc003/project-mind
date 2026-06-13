# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-13

### Added
- **Plugin System**: Fully typed SDK (`ProjectMindPlugin`) for building framework-specific insight plugins.
- **E2E Smoke Tests**: Robust lifecycle test matrix (`tests/e2e/runner.test.ts`) covering Node, React, Spring Boot, and FastAPI fixtures.
- **Migration Engine**: Automatic schema migration for backwards compatibility (`project-mind repair`).
- **Compatibility Matrix & Performance Budgets**: Added strict Service Level Objectives and versioning to the documentation.
- **Handlebars Templates**: Fully decoupled `AI_START_HERE.md` template compilation for predictable context handoff.
- **Type-Safe Governance**: Evaluator strictly enforcing architecture dependencies, feature tagging, and orphan checks.

### Changed
- Migrated schema from `currentTask` to `focusHistory` for richer lifecycle tracking.
- `AI_START_HERE.md` now enforces the presence of `Current Focus` and `Features` sections unconditionally.
- Removed embedded templates directory reference from `package.json` to prevent packaging errors.

### Fixed
- Fixed all 14 silent TypeScript compilation errors that previously shipped.
- Corrected Commander program CLI output mismatch (now reports `1.0.0`).
- Fixed optimistic concurrency handling for manual edits to `MEMORY.json`.
- Fixed E2E runner bugs related to unhandled timeouts and filesystem race conditions on Windows.
