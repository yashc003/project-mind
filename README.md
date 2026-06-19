# 🧠 Project-Mind (v1.1.1)

**The Long-Term Memory (Hippocampus) for AI Coding Agents.**

Project-Mind automatically builds an intelligent, living blueprint of your codebase. It acts as the long-term memory for your AI agents (like Claude Desktop, Cursor, or Windsurf), ensuring they instantly understand your architecture, active tasks, and historical decisions without having to re-read thousands of files.

---

## 🚀 Quick Start

Initialize Project-Mind in your project with zero configuration:

```bash
npx project-mind init
```

This single command automatically scans your repository, detects your framework (React, Node, Spring Boot, FastAPI, etc.), and generates a `.project-mind/` directory containing your project's architectural memory graph.
## 📚 Project Overview

Project-Mind is a **local, AI‑friendly architectural memory engine** that continuously analyzes your codebase, builds a knowledge graph, and stores it in `.project-mind/derived/MEMORY.json`. It enables AI assistants to instantly understand the project's structure, decisions, and active tasks without re‑reading the entire source tree.

### Core Modules

- **Discovery Engine** – Tree‑sitter based AST extraction and evidence collection.
- **Graph Engine** – Builds the `KnowledgeGraph` and provides an interactive visualizer.
- **Memory Engine** – Persists the graph, handles delta‑diff updates, and tracks focus.
- **Plugin Engine** – Framework‑specific adapters (React, NestJS, Spring Boot, etc.).
- **MCP Server** – Exposes the memory to AI tools via the Model Context Protocol.
- **IDE Engine** – Injects rules into agentic IDEs (Cursor, Windsurf).
- **Governance Engine** – Decision ledger and architectural linting.
- **Handoff Engine** – Generates markdown handoff files (`AI_START_HERE.md`, `WORKFLOWS.md`, …).

---

---

## 📖 Documentation Links

- [Internal Database Schema (SCHEMA.md)](docs/SCHEMA.md) - For AIs looking to query or traverse the `MEMORY.json` database directly.
- [Architecture Documentation (ARCHITECTURE.md)](docs/ARCHITECTURE.md) - Deep dive into the internal engines, data lifecycle, and module structure.

---

## 🤖 Connecting to Your AI (Two Ways)

Project-Mind is designed to integrate seamlessly into your AI workflow. You can connect it in two ways:

### 1. The MCP Server (Recommended)
If your AI assistant supports the **Model Context Protocol (MCP)** (e.g., Claude Desktop or Cursor), it can dynamically query Project-Mind to explore your codebase safely without blowing out its context window.

Add this to your MCP configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "project-mind": {
      "command": "npx",
      "args": ["project-mind", "mcp", "--project-path", "your/project/path"]
    }
  }
}
```

### 2. The Native IDE Integration (For Cursor / Windsurf)
If you are using an Agentic IDE, you can inject Project-Mind directly into your IDE's instructions:

```bash
npx project-mind install-ide
```
This adds specific AI rules to your `.cursorrules` (or equivalent) telling your AI to automatically run Project-Mind commands to track features and log decisions as you work together.

When starting a new chat, simply attach the `.project-mind/AI_START_HERE.md` file to give your AI instant context on the entire project!

---

## 🛠️ Everyday Commands

Project-Mind provides a suite of tools for you (and your AI) to manage the project state.

**Update the Memory Graph** (Ultra-fast, uses Git diffs):
```bash
npx project-mind update
```

**Track Tasks & Features**:
```bash
npx project-mind start-feature "Authentication"
npx project-mind complete-feature "Authentication"
```

**Log Architectural Decisions**:
```bash
npx project-mind note "Migrated state management to Redux" --decision
```

**Explore the Architecture**:
```bash
npx project-mind why "Redux"                # Find out why a decision was made
npx project-mind explain "AuthService"      # Deep-dive into a component
npx project-mind impact "src/utils/db.ts"   # See what breaks if this file changes
npx project-mind lint                       # Check for architectural violations
```
## 📜 Full CLI Reference

| Command | Description |
|---------|-------------|
| `project-mind init` | Initialise `.project-mind` by scanning the repo |
| `project-mind update` | Fast incremental update of memory (Git‑aware) |
| `project-mind handoff` | Regenerate all handoff markdown files |
| `project-mind start-feature "<name>"` | Begin tracking a new feature/task |
| `project-mind complete-feature "<name>"` | Mark a feature as completed |
| `project-mind note "<text>" --decision` | Record an architectural decision |
| `project-mind why "<query>"` | Explain why a decision/component exists |
| `project-mind explain "<entity>"` | Deep‑dive into a component, file, or workflow |
| `project-mind impact "<file>"` | Show what would break if the file changes |
| `project-mind lint` | Run architectural linting against decisions |
| `project-mind install-ide` | Install AI rules into supported IDEs |
| `project-mind mcp` | Start the MCP server for AI tool integration |
| `project-mind pack` | Bundle the memory for sharing or backup |

---

## 🔌 Framework Support

Project-Mind supports any language, but ships with **zero-config deep integrations** for:
- Node.js & Express
- React & SvelteKit
- Spring Boot
- FastAPI & Django
- Laravel & NestJS

*(Plugins are automatically detected and loaded during `init` and `update`)*

---

## 📖 Learn More

For an in-depth dive into how Project-Mind works under the hood (WASM Tree-sitter AST parsing, Context Budgeting, and the Governance Engine), check out our [Architecture Documentation](docs/ARCHITECTURE.md).

---

## 📄 License

Apache 2.0 License. See [LICENSE](LICENSE) for more details.
