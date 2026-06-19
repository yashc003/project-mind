# 🏗️ Project-Mind Architecture

Project-Mind is an intelligent architectural memory engine for AI coding assistants. It operates locally by performing deep semantic analysis of repositories and constructing a persistent Knowledge Graph that AIs can query via the Model Context Protocol (MCP) or the CLI.

---

## 🛠️ How It Is Built (Tech Stack)

- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js (v18+)
- **Parser:** `web-tree-sitter` – a WebAssembly‑based AST parser supporting many languages (TypeScript, JavaScript, Python, Java, PHP, etc.)
- **Bundler:** `tsup` – fast ESM/CJS bundling for the CLI and server
- **Transport:** STDIO for the MCP server (JSON‑RPC)
- **Storage:** Local JSON files under `.project-mind/derived/` (primarily `MEMORY.json`)
- **Template Engine:** Handlebars for generating human‑readable handoff documents (`AI_START_HERE.md`, `WORKFLOWS.md`, etc.)

---

## 🧩 Core Modules & Engines

### 1. Discovery Engine (`src/engines/discovery/`)
- **AST Parsing:** Uses Tree‑sitter to parse source files into abstract syntax trees, extracting semantic entities (classes, functions, hooks, interfaces, enums).
- **Evidence Collection:** Scans Git history, build files, documentation, and language‑specific metadata.
- **Confidence Scoring:** Assigns confidence values to each extracted entity based on evidence quality.

### 2. Graph Engine (`src/engines/graph/`)
- **Knowledge Graph:** Transforms extracted semantics into a directed graph of nodes (files, components, workflows) and edges (`depends_on`, `implements`, `part_of`).
- **Viewer:** Generates an interactive HTML visualizer (`GRAPH_VIEWER.html`) for quick manual inspection.

### 3. Memory Engine (`src/engines/memory/`)
- **Persistent Store:** Writes the consolidated state to `.project-mind/derived/MEMORY.json`.
- **Delta‑Diffing:** On subsequent runs, only updates changed files using Git diffs, making `project-mind update` fast.
- **Focus Tracking:** Holds the `CurrentFocus` object (active feature, status, blockers, modules, sub‑tasks, linked commits).

### 4. Plugin Engine (`src/engines/plugin/`)
- **Framework‑Specific Rules:** Dynamically loads plugins for frameworks (React, SvelteKit, NestJS, Express, FastAPI, Django, Laravel, Spring Boot).
- **Merging Contributions:** Each plugin contributes additional components, endpoints, and workflow definitions that are merged into the global architecture model.

### 5. MCP Server (`src/engines/mcp/`)
- **Model Context Protocol:** Exposes Project‑Mind’s memory as a set of JSON‑RPC tools (`search`, `query`, `decisions`, `focus`, etc.).
- **Tools:** `project-mind-search` (semantic lookup) and `project-mind-query` (graph traversal) allow AI agents to explore the codebase without flooding the context window.

### 6. IDE Engine (`src/engines/ide/`)
- **IDE Integration:** Detects installed IDEs (Cursor, Windsurf, Copilot, etc.) and injects rule files (`.cursorrules`, `.windsurfrules`, etc.) that tell the AI to always consult Project‑Mind before generating code.

### 7. Governance & Decision Engine (`src/engines/governance/`)
- **Decision Ledger:** Stores immutable decisions (`DECISIONS.md`) with rationale, tags, and impacted components.
- **Linting:** The `lint` command compares current code against the decision ledger to surface architectural violations.

### 8. Handoff Engine (`src/engines/handoff/`)
- **Handlebars Templates:** Renders `AI_START_HERE.md`, `PROJECT_CONTEXT.md`, `HANDOFF.md`, and the newly added `WORKFLOWS.md` from the memory model.
- **Purpose:** Provides a concise “system prompt” for any AI assistant entering the project.

---

## 🔄 Data Lifecycle
1. **Initialization (`project-mind init`):**
   - Runs the Discovery Engine to scan the repo.
   - Builds the Knowledge Graph.
   - Persists the result to `MEMORY.json`.
   - Generates handoff markdown files.
2. **Continuous Updates (`project-mind update`):**
   - Calculates a delta diff against the last commit.
   - Updates only the changed parts of the graph and memory.
3. **Interaction (`project-mind start-feature`, `project-mind note`, etc.):**
   - Mutates the `CurrentFocus` and `Decision` objects.
   - Immediately persists changes to `MEMORY.json`.
4. **MCP Queries:**
   - AI agents call tools like `search` or `query` to retrieve relevant nodes, workflows, or decisions.
5. **Handoff Regeneration:**
   - `project-mind handoff` re‑renders all markdown artifacts, keeping AI context up‑to‑date.

---

## 📦 Modules Overview (Directory Structure)
```
src/
├─ commands/          # CLI entry points (init, update, handoff, etc.)
├─ engines/
│  ├─ discovery/      # AST extraction and evidence collection
│  ├─ graph/          # Knowledge‑graph construction & viewer
│  ├─ memory/         # Persistence, delta‑diffing, focus tracking
│  ├─ plugin/         # Framework‑specific plugins
│  ├─ mcp/            # Model Context Protocol server & tools
│  ├─ ide/            # IDE rule injection
│  ├─ governance/     # Decision ledger & linting
│  └─ handoff/        # Handlebars templates for AI handoffs
├─ utils/             # Helper functions (logging, FS helpers, etc.)
└─ types/             # Shared TypeScript interfaces (ProjectMemory, Decision, etc.)
```

---

## 📚 Further Reading
- **SCHEMA Documentation:** See `docs/SCHEMA.md` for a full TypeScript‑style definition of all JSON structures stored in `MEMORY.json`.
- **Architecture Deep‑Dive:** The above sections provide a high‑level map; for implementation‑level details, explore each engine’s source files.

---

*Generated by Project‑Mind v1.1.0 on {{datetime updatedAt}}*
