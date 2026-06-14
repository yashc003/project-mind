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

## 🔌 The Plugin System

Project-Mind supports a powerful Plugin System that allows it to go beyond heuristic analysis and perform deep AST-based code understanding for specific frameworks. Plugins can extract API endpoints (`GET /users`), identify specific UI workflows, and inject custom dependency maps.

### What Plugins Do
- **Framework Depth:** Plugins for frameworks like **FastAPI**, **NestJS**, **Spring Boot**, and **React** can parse files (via regex or AST) to find precisely defined routes, modules, guards, or contexts.
- **Explain Context:** Plugins can supply deep technical rationale for architecture components when exploring the node graph.
- **Workflow Generation:** Plugins can automatically map UI user flows to backend API calls.

### How to Use Plugins

Project-Mind features a **Frictionless Plugin System**. You do not need to configure anything to use the official plugins!

1. During `project-mind update`, the Discovery Engine scans your project for framework footprints (e.g., `pom.xml` for Spring Boot, `package.json` for React/NestJS, `requirements.txt` for FastAPI).
2. If it detects a supported framework, it automatically loads and executes the corresponding official plugin in the background.
3. The plugin analyzes your code, extracts endpoints, and injects them directly into your `.project-mind/AI_START_HERE.md` Component Inventory.

### Manual Plugin Configuration (Advanced)

If you want to use custom local plugins, or explicitly disable/enable specific plugins, you can create or edit `.project-mind/authored/plugins.json` in your project root:
   ```json
   {
     "installed": [
       {
         "name": "@project-mind/plugin-fastapi",
         "version": "0.6.0",
         "enabled": true,
         "path": "plugins/fastapi/index.js"
       }
     ]
   }
   ```

### Security and Trust Model

Because plugins execute JavaScript code locally on your machine, Project-Mind strictly enforces a **Zero-Trust Security Policy** for any local or third-party plugins. Only official internal plugins (`plugins/*`) run automatically. 

If you attempt to load a third-party or local plugin, it will be **Blocked** with an `⚠ Untrusted Plugin Blocked` warning.

You must explicitly audit and trust a plugin before it can run:

```bash
# 1. Inspect the plugin to see what files it touches and what it's named
project-mind plugin inspect ./path/to/my-custom-plugin.js

# 2. Trust the plugin to allow it to execute code during the next update
project-mind plugin trust ./path/to/my-custom-plugin.js

# 3. If you no longer trust it, untrust it
project-mind plugin untrust ./path/to/my-custom-plugin.js
```

Once a plugin is trusted, Project-Mind records its `SHA-256` hash. If the plugin file is modified maliciously later, it will be automatically blocked again until you re-trust the new hash.

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

### Other Autonomous Capabilities

The principles of autonomous logging apply to everything:

1. **Context Fetching on the Fly**: If the AI needs more context mid-conversation, it can run `project-mind pack "target" --budget 10000`, read the file, and continue without asking you for help.
2. **Task Lifecycle Tracking**: The AI can execute `project-mind start-feature "Bug Fix"` and `project-mind complete-feature "Bug Fix"` as it works, syncing its progress into the persistent memory graph.
3. **Self-Linting**: Before handing code back to you, the AI can run `project-mind lint` to double-check that its own code doesn't violate your architectural rules.

---

## 🕵️ Advanced CLI Tools

Project-Mind includes advanced tools for monitoring project health, evaluating architecture, and measuring the impact of changes.

### 1. The `snapshot` Command
Think of this as `git status` but for project context. Run:
```bash
project-mind snapshot
```
This prints a clean dashboard directly in your terminal detailing:
- The **Current Focus** (active tasks and blockers)
- **Features** (active vs stale)
- **Recent Decisions**
- The project's overall **Knowledge Score** (a confidence interval of how well the AI understands the system)

### 2. The `impact` Command (Blast Radius Analysis)
Before you refactor or modify a core file, you can ask Project-Mind to do a backward traversal of the knowledge graph to show you everything that relies on it.
```bash
project-mind impact "src/utils/logger.ts"
```
This lists every Service, Controller, and Feature that explicitly imports or depends on the target file, helping AI agents (and humans) avoid unintended side effects.

### 3. The `governance` Engine
Project-Mind can automatically audit your architecture against strict codebase rules. To check your project for architectural drift or tech debt:
```bash
project-mind lint
project-mind governance report
```
This generates a `GOVERNANCE.md` report containing:
- An **Architecture Score** out of 100
- Warnings for **Orphaned Files** (files not mapped to any component)
- **Policy Violations** (e.g., if a Presentation Component attempts to import a Database Repository directly)
- Recorded **Technical Debt** exceptions

---

## 📊 Visualizing the Architecture Graph

Project-Mind can generate visual node-based dependency graphs using Mermaid Markdown.

```bash
project-mind graph show
```

*(You can also use `--focus <component-name>` to generate a smaller, more specific graph instead of the entire project).*

### Viewing the Output

1. **The Mermaid Live Editor (Fastest in Browser)**
   - Copy the terminal output and paste it into [mermaid.live](https://mermaid.live/).
2. **VS Code / IDE Preview (Fastest Local)**
   - Save the output to an `architecture.md` file.
   - Use an extension like "Markdown Preview Mermaid Support" to view it instantly in your IDE.
3. **GitHub / GitLab**
   - Both platforms natively support Mermaid. Just paste the output into any Markdown file and push it.

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
