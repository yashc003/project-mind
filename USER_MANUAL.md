# 🧠 Project-Mind: The Ultimate User Manual

Welcome to **Project-Mind**, an advanced contextual intelligence engine designed to instantly decode, document, and map any software project. Whether you are onboarding onto a legacy monolith, exploring a massive monorepo, or preparing a codebase for AI-assisted development, Project-Mind builds a comprehensive "brain" of your project in seconds.

---

## 🚀 Quick Start

### 1. Initializing a Project
Navigate to your project directory and run the engine:
```bash
cd your-project
npx project-mind init
```

This command will:
- 📂 Scan your directory structure
- 🧬 Analyze your tech stack (package.json, pom.xml, go.mod)
- 🧩 Map your architecture and dependency graph
- ⚡ Extract API endpoints, controllers, and models
- 📝 Generate an `AI_START_HERE.md` document

### 2. Exploring the Output
Once initialized, Project-Mind creates a `.project-mind/` directory containing the localized intelligence:

- **`AI_START_HERE.md`**: The primary handoff document. This is your master overview containing the Architecture, Tech Stack exact versions, API endpoints, and Component Inventories.
- **`memory.json`**: The raw, serialized JSON data of your project's intelligence graph. This is meant to be consumed by other AI tools, plugins, and custom scripts.

---

## 🛠️ Core Capabilities & Engines

Project-Mind isn't just a simple file scanner. It uses a suite of heuristic engines to build a deep understanding of your code.

### 1. Discovery Engine
The Discovery Engine gathers evidence from multiple sources:
- **Build Files**: Scans `package.json`, `pom.xml`, `build.gradle`, `go.mod`, etc. It supports **Monorepos** (recursively finding all nested packages) and differentiates between core dependencies and `devDependencies`.
- **Git History**: Analyzes commit frequency, branching strategies, and identifies "Hotspots" (files that change the most often).
- **Source Code**: Categorizes every file by language and purpose (e.g., config, source, test).

### 2. Architecture Engine
Without running AST parsers, Project-Mind heuristically infers your architecture:
- Detects patterns like **MVC**, **Layered**, **Component-Based**, or **Monolith**.
- Prioritizes Backend frameworks over Frontend dev-dependencies to accurately classify full-stack apps.
- Groups files into logical layers (`Presentation`, `Business Logic`, `Data Access`, `Infrastructure`).

### 3. Import Analyzer
Maps the internal dependency graph of your project:
- Understands relative imports (`./`, `../`) and **Path Aliases** (`@/`, `~/`) out of the box.
- Detects **Circular Dependencies** that might be causing hard-to-track bugs.
- Determines which modules are tightly coupled vs. loosely isolated.

### 4. The Agentic IDE Registry
Project-Mind natively injects explicit operational rules into popular AI Agent IDEs (Cursor, Windsurf, Claude Code, Antigravity, Roo Code, etc.).
- When you run `project-mind install-ide`, it scans for your IDE's system prompts (e.g. `.cursorrules`) and embeds a strict `START HERE` pointer ensuring the AI *always* reads the Project-Mind memory before doing anything else.

---

## ⚙️ Advanced Configuration

Project-Mind works out of the box, but you can configure its behavior via `.project-mind/authored/config.json`.

```json
{
  "maxDepth": 5,
  "ignoreDirs": ["node_modules", ".git", "dist", "build", "vendor"],
  "recentCommitCount": 100
}
```

### Edge Cases Handled Automatically
- **Complex Encodings**: If your files are piped using Windows PowerShell (which defaults to UTF-16LE), Project-Mind safely detects the BOM and parses it correctly.
- **Monorepos**: `maxDepth` scanning ensures that deeply nested TurboRepo or Nx workspaces are fully mapped.
- **Path Aliases**: Modern TypeScript `@/` path aliases are resolved to their physical files.

---

## 🤖 AI Integration (The "Handoff")

The primary goal of Project-Mind is to bridge the gap between human context and LLMs (like GitHub Copilot, ChatGPT, or Gemini).

When you start a new conversation with an AI coding assistant, simply feed it the `.project-mind/AI_START_HERE.md` file. 

**Why does this matter?**
Instead of the AI asking you *"What version of React are you on?"* or *"Where are your database models located?"*, it instantly knows:
1. The exact dependencies you are using (e.g., Spring Boot 3.1.2).
2. That you are using a Layered Architecture.
3. Every API endpoint available in the system.
4. The exact file paths for your Controllers, Services, and Models.

You spend zero time explaining your project. You just start coding.

### Autonomously Logging Decisions

Project-Mind relies on explicit CLI invocation to log decisions, ensuring you maintain full control over your project's memory. Depending on your Agentic IDE, the AI itself can handle this for you:

#### 1. Fully Autonomous Agents (Antigravity, Claude Code, Roo Code, Devin)
These AI agents have direct permission to run terminal commands on your behalf. Because the `.cursorrules`/`.clinerules` (injected via `install-ide`) tells the AI to use the `project-mind` CLI, **the AI itself will execute the command** to log the decision after you agree on it in chat.

* **You:** "Let's pivot to using Redux for state management instead of Context API."
* **AI:** "Good idea." *(AI autonomously runs in terminal: `project-mind note "Migrated state management to Redux for better scalability" --decision`)*.

#### 2. Semi-Autonomous Agents (Cursor, Windsurf)
Cursor and Windsurf do not currently execute background terminal commands automatically without your explicit click. 
* In this case, the AI will output a code block at the end of the chat saying:
  ```bash
  project-mind note "Migrated to Redux" --decision
  ```
* You simply click the "Run in Terminal" button provided by your IDE.

---

## 🧹 Housekeeping & Troubleshooting

### Readiness Doctor
Run `project-mind doctor` to validate your project's intelligence health. It runs 11 separate sanity checks across schema validation, IDE integration, Git hook status, Context Budget usage, and Architecture enforcement.

### Schema Repairs
If you upgrade to a newer version of the CLI and the memory schema has changed:
```bash
project-mind repair
```
This automatically runs database migrations and fixes any missing JSON keys.

### Git Hooks Uninstallation
If you wish to stop background background updates on `git commit`, run:
```bash
project-mind install-hooks --uninstall
```
