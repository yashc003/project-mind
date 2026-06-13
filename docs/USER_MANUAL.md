# 🧠 Project-Mind: Comprehensive User Manual

Welcome to the definitive guide for **Project-Mind (v1.0.0)**. 

Project-Mind is an intelligent orchestration tool designed to act as the "Hippocampus" (long-term memory) for AI coding assistants like Claude, GPT-4, Cursor, and Copilot. By using Project-Mind, you drastically reduce token consumption, eliminate AI hallucinations, and provide your LLMs with surgical, perfectly scoped context.

---

## 📑 Table of Contents
1. [Installation & Setup](#1-installation--setup)
2. [The Zero-Config Initialization](#2-the-zero-config-initialization)
3. [Day-to-Day Operations](#3-day-to-day-operations)
4. [Supercharging Your AI (Context Management)](#4-supercharging-your-ai-context-management)
5. [Architecture Governance & Tech Debt](#5-architecture-governance--tech-debt)
6. [Advanced Troubleshooting](#6-advanced-troubleshooting)

---

## 1. Installation & Setup

You can run Project-Mind without installation using `npx`, or you can install it globally on your machine for faster access.

**Global Installation (Recommended):**
```bash
npm install -g project-mind
```

**Running via NPX:**
```bash
npx project-mind <command>
```

---

## 2. The Zero-Config Initialization

To start using Project-Mind in any repository, simply run:

```bash
project-mind init
```

### What happens under the hood?
1. **Intelligent Deep Scan**: Project-Mind parses your `.gitignore` and scans your entire codebase, automatically inferring your programming languages, frameworks (React, Spring Boot, FastAPI, NestJS), and entry points.
2. **Directory Scaffolding**: It creates a `.project-mind/` directory to store its `MEMORY.json`, knowledge graph, and AI context files.
3. **Governance Setup**: It generates a `.project-mind.json` configuration file with default architectural policies.
4. **Git Hook Installation**: It automatically installs a `post-commit` Git hook. Every time you commit code, Project-Mind will incrementally update its memory in the background.

---

## 3. Day-to-Day Operations

Once initialized, Project-Mind sits quietly in the background tracking your project's evolution. However, you can actively interact with it to leave breadcrumbs for future AI sessions.

### Keeping Memory Up-To-Date
```bash
project-mind update
```
If you manually change code without committing (and bypassing the Git hook), use `update`. 
*Note: This command is blazingly fast (<50ms) because it incrementally checks `git status` and your `.gitignore` to see if a rescan is actually necessary.*

### Recording Decisions and Notes
AI agents often forget why a specific design choice was made, leading to arguments or circular refactoring. 
```bash
project-mind note "We are using Postgres instead of MongoDB for ACID compliance" --decision
```
This adds a strict constraint to the memory graph. Future AI sessions will see this in their `DECISIONS.md` file and won't try to switch you back to MongoDB.

### Managing Features
Track what you are currently building so AI agents instantly know the context when you open a new chat:
```bash
project-mind start-feature "User Authentication"
# ... code code code ...
project-mind complete-feature
```

---

## 4. Supercharging Your AI (Context Management)

This is the core value proposition of Project-Mind. Stop blindly dumping your entire repository into Claude or ChatGPT and wasting 100,000 tokens.

### The AI Handoff
Whenever you start a new chat with an AI, run:
```bash
project-mind handoff
```
This generates `.project-mind/AI_START_HERE.md`. 
**How to use it:** Drag and drop this file into your LLM. It contains a highly compressed, token-optimized summary of your entire architecture, current task, and recent structural diffs (rendered beautifully in Markdown). 

### Surgical Context Packing
If you ask an AI to fix a bug in the "Auth" module, you need to provide the source code.
```bash
project-mind pack "Auth" --type feature -f
```
**How to use it:** This generates a `packs/current.md` file containing *only* the specific files related to the "Auth" feature, complete with syntax highlighting. Copy/paste this into your LLM. You just saved 50,000 tokens of irrelevant context.

### Targeted Mermaid Graphs
LLMs love Mermaid.js graphs, but an entire system architecture graph will crash their context window.
```bash
project-mind graph show --focus "UserService"
```
**How to use it:** This outputs a localized Mermaid graph showing *only* the `UserService` and its immediate neighbors (dependencies and dependents).

---

## 5. Architecture Governance & Tech Debt

Project-Mind actively monitors if your project is drifting away from its intended architecture.

### Configuring Rules
Open `.project-mind.json` and configure `customArchitectureRules`:
```json
"customArchitectureRules": [
  { "name": "No Circular Dependencies", "enforcementLevel": "error" },
  { "name": "Controllers must not import Repositories directly", "enforcementLevel": "warn" }
]
```

### Linting the Architecture
```bash
project-mind lint
```
This runs the internal heuristic engine against your codebase and throws an exit code if any strict architectural rules are violated. Perfect for CI/CD pipelines!

### The Governance Report
```bash
project-mind governance report
```
Generates a highly detailed `GOVERNANCE.md` report showing your overall Architecture Score, identified technical debt, and policy violations.

---

## 6. Advanced Troubleshooting

Sometimes things go wrong. We have built-in utilities to rescue your project state.

### State Snapshots
Before doing a massive refactor, save your project's architectural memory:
```bash
project-mind snapshot create "Before Auth Overhaul"
```
If the refactor fails and you revert your code, revert your memory too:
```bash
project-mind snapshot restore <id>
```

### Schema Repairs
If you upgrade to a newer version of the `project-mind` CLI and the memory schema has changed, or if your `.project-mind/` directory gets corrupted:
```bash
project-mind repair
```
This automatically runs database migrations and fixes any missing JSON keys.

### The Doctor
If the internal intelligence engines are reporting low confidence scores, ask the Doctor for advice:
```bash
project-mind doctor
```
This will output specific recommendations on how to structure your files so Project-Mind (and by extension, your AI) can better understand them.
