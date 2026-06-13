# Project-Mind Architecture

Project-Mind operates as the continuous intelligence layer for external AI agents, designed with modularity, persistence, and extensibility in mind.

## Core Design Principles

1. **Local-First State:** The `.project-mind/` directory acts as the single source of truth for the project context.
2. **Deterministic Schemas:** The JSON models (e.g., `MEMORY.json`) are strictly versioned (`v1.0.0`) to avoid parsing errors by AI models.
3. **Pluggability:** The engine supports dynamically loaded plugins to evaluate metrics, enforce policies, or connect to third-party tools.

---

## 📂 The `.project-mind/` Directory

When initialized via `project-mind init`, the CLI scaffolds the following layout in your project root:

```text
.project-mind/
├── MEMORY.json          # Source of truth: architecture, workflows, timelines, and config.
├── config.json          # Governance policies, tech debt exceptions, and project settings.
├── plugins.json         # Array of absolute paths pointing to active plugins.
├── plugins/             # Optional directory for locally defined scripts/plugins.
├── AI_START_HERE.md     # Auto-generated context dump for AI initialization.
├── HANDOFF.md           # Condensed markdown designed for context windows.
├── PROJECT_CONTEXT.md   # Broad structural overview.
├── GOVERNANCE.json      # Evaluation metrics from the latest `lint` command.
└── GOVERNANCE.md        # Human-readable version of the governance report.
```

### `MEMORY.json`

The central artifact of Project-Mind. It contains the complete schema defined in `src/engines/memory/schema.ts`.

**Schema Versioning:** The `schemaVersion` field (currently `1.0.0`) ensures robust schema migration. The `project-mind repair` command utilizes `migration.ts` to upgrade older schemas seamlessly.

---

## ⚙️ Execution Flow

Project-Mind's CLI triggers the orchestration engine, which passes context to sub-engines. 

1. **CLI (`src/cli.ts`)**: Parses arguments via Commander.js and delegates to specific command handlers (`src/commands/`).
2. **Discovery Engine (`src/engines/discovery/`)**: Scans git history, files, dependencies, and heuristics to build an internal representation.
3. **Memory Engine (`src/engines/memory/`)**: Merges the discovery output with historical knowledge, handling persistence and atomic IO updates.
4. **Governance Engine (`src/engines/governance/`)**: Evaluates policies defined in `config.json` against the current memory state, producing a pass/fail/warn report.
5. **Handoff Engine (`src/engines/handoff/`)**: Compiles `MEMORY.json` into markdown documents using Handlebars templates.

---

## 🧩 Plugin System

Plugins allow you to extend the Discovery and Governance capabilities of Project-Mind.

**Loading Logic:**
The plugin registry (`src/engines/plugin/registry.ts`) reads `.project-mind/plugins.json` and uses dynamic imports to load default exports. 

*Note: For Node environments, plugin paths pointing to `.ts` files currently require a bundler or `tsx` loader. It is recommended to compile custom plugins to `.js` before linking.*

### Example Plugin

```typescript
export default {
  name: 'custom-scanner',
  version: '1.0.0',
  description: 'A custom logic scanner',
  async execute(memory, ctx) {
    // Modify memory or return context
    return {
      confidence: 100,
      evidence: ['Found a custom config file!']
    };
  }
};
```
