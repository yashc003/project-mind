# 🧠 Project-Mind (v1.0.0)

**The Hippocampus for External AI Reasoning Agents.**

Project-Mind is an intelligent state-management and orchestration tool designed specifically for AI-driven development. It acts as the long-term memory for AI agents (like Claude, GPT-4, and local LLMs), tracking architecture, project state, timelines, technical debt, and workflows so your AI doesn't have to guess.

By maintaining an up-to-date `.project-mind/MEMORY.json` as the single source of truth, Project-Mind bridges the context gap between sessions, providing a continuous, living blueprint of your codebase.

---

## 🌟 Key Features

* **🧠 Long-Term Memory:** Seamlessly preserves context across agent sessions via `MEMORY.json`.
* **🏗️ Architecture Detection:** Automatically infers layers, patterns, and component structures.
* **⚖️ Governance & Linter:** Enforces architectural policies, manages tech debt, and computes an Architecture Score.
* **🤖 AI Handoffs:** Generates `AI_START_HERE.md` and `HANDOFF.md` to instantly onboard new AI sessions.
* **🧩 Plugin System:** Extensible via `.ts`/`.js` plugins for custom metrics, policies, and integrations.
* **🛡️ E2E Validated:** Rigorously tested against Node, Spring Boot, React, and FastAPI project structures.

---

## 🚀 Quick Start

Initialize Project-Mind in your workspace:

```bash
npx project-mind init --deep-scan --governance
```

This commands scaffolds the `.project-mind/` directory, extracts intelligence from your project, and sets up default governance policies.

### Core Commands

| Command | Description |
|---------|-------------|
| `init` | Scaffold the `.project-mind/` directory and memory schema. |
| `update` | Update memory by rescanning the codebase. |
| `note <text>` | Record a milestone, decision, or current task focus. |
| `pack [target]` | Package context into a clipboard-ready payload for LLMs. |
| `explain <topic>` | Query the memory graph for architecture or workflows. |
| `lint` | Run the governance engine against architectural policies. |
| `governance report`| Generate a human-readable `GOVERNANCE.md` report. |
| `repair` | Validate memory schema, migrate older versions, and fix missing artifacts. |

---

## 📚 Compatibility Matrix

Project-Mind v1.0.0 guarantees backwards compatibility for its internal schema according to the following matrix:

| Project-Mind CLI | Memory Schema Version |
|------------------|-----------------------|
| 1.0.x            | 1.0                   |
| 1.1.x            | 1.0                   |
| 1.2.x            | 1.1                   |

*Note: Use `project-mind repair` to automatically migrate older schemas to the latest version.*

---

## ⚡ Performance Budget

Project-Mind is built to be fast, ensuring minimal friction during active AI coding sessions. Our target performance budgets are:

| Repository Size | Deep Scan / Update Target |
|-----------------|---------------------------|
| < 100 files     | < 2 seconds               |
| < 1,000 files   | < 10 seconds              |
| < 10,000 files  | < 60 seconds              |

---

## 📖 Documentation

For an in-depth dive into how Project-Mind works under the hood, check out the [Architecture Documentation](docs/ARCHITECTURE.md) (coming soon).

---

## 🤝 Contributing

We welcome contributions! Please open an issue or submit a pull request. Make sure to run `npm run test:e2e` to validate that all feature assertions pass.

## 📄 License

MIT License.
