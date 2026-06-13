// ============================================================================
// Memory Engine — Persistence Layer
// ============================================================================
// Manages the .project-mind/ directory structure, reading and writing all
// memory files. Writes are atomic to prevent corruption.
// ============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import type {
  ProjectMemory,
  ProjectMindConfig,
  DiscoveryResult,
  EvidenceSources,
  ArchitectureModel,
  ConfidenceScores,
  Decision,
  DeveloperNote,
  SessionReference,
  CurrentFocus,
  Workflow,
} from '../../types/index.js';
import { computeConfidence } from '../../utils/confidence.js';
import { loadStaticConfig } from '../../utils/config-loader.js';
import { migrateMemory } from './migration.js';
import { buildKnowledgeGraph, generateMermaidGraph } from '../graph/index.js';
import {
  createEmptyMemory,
  getMemoryFilePaths,
  DEFAULT_CONFIG,
  SCHEMA_VERSION,
} from './schema.js';
import {
  ensureDir,
  readJson,
  writeJson,
  writeText,
  fileExists,
} from '../../utils/fs.js';

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initializes the .project-mind/ directory structure.
 * Returns the initial memory object.
 */
export async function initMemory(
  projectPath: string,
  projectName?: string,
): Promise<ProjectMemory> {
  const paths = getMemoryFilePaths(projectPath);
  const name = projectName || path.basename(projectPath);

  // Create directory structure
  await ensureDir(paths.root);
  await ensureDir(paths.sessions);

  // Create initial memory
  const memory = createEmptyMemory(name);

  // Write initial files
  await writeJson(paths.memory, memory);
  await writeJson(paths.config, DEFAULT_CONFIG);
  await writeJson(paths.architecture, memory.architecture);
  await writeJson(paths.workflows, memory.workflows);
  await writeJson(paths.timeline, memory.timeline);
  await writeJson(paths.features, memory.features);
  await writeJson(paths.currentFocus, memory.focusHistory);
  await writeJson(paths.agentHistory, []);

  // Create placeholder markdown files
  await writeText(paths.decisions, '# Decisions\n\nNo decisions recorded yet.\n');
  await writeText(paths.workflows.replace('.json', '.md'), renderWorkflowsMarkdown([]));
  await writeText(paths.aiProtocol, generateAiProtocol(name));

  return memory;
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

/**
 * Loads existing project memory. Returns null if not initialized.
 */
export async function loadMemory(projectPath: string): Promise<ProjectMemory | null> {
  const paths = getMemoryFilePaths(projectPath);

  if (!(await fileExists(paths.memory))) {
    return null;
  }

  const memoryStr = await fs.readFile(paths.memory, 'utf-8');
  let memory = JSON.parse(memoryStr) as ProjectMemory;
  if (memory) {
    memory = migrateMemory(memory);
    // Set the concurrency token to the hash of the file read
    memory.lastHash = crypto.createHash('md5').update(memoryStr).digest('hex');
  }
  return memory;
}

/**
 * Loads the project configuration. Returns defaults if not found.
 */
export async function loadConfig(projectPath: string): Promise<ProjectMindConfig> {
  const paths = getMemoryFilePaths(projectPath);
  const baseConfig = await readJson<ProjectMindConfig>(paths.config) || { ...DEFAULT_CONFIG };
  return loadStaticConfig(projectPath, baseConfig);
}

/**
 * Saves the full memory state to disk.
 * Also updates ARCHITECTURE.json and DECISIONS.md as separate files.
 */
export async function saveMemory(
  projectPath: string,
  memory: ProjectMemory,
): Promise<void> {
  const paths = getMemoryFilePaths(projectPath);

  // Optimistic Concurrency Check
  if (await fileExists(paths.memory)) {
    const existingMemoryStr = await fs.readFile(paths.memory, 'utf-8');
    const existingHash = crypto.createHash('md5').update(existingMemoryStr).digest('hex');
    
    // If the file on disk has changed since we loaded it, throw an error
    if (memory.lastHash && existingHash !== memory.lastHash) {
      throw new Error('Memory Consistency Error: MEMORY.json was modified by another process. Please reload and try again.');
    }

    // Backup to MEMORY_PREV.json for diffing
    await fs.copyFile(paths.memory, paths.memoryPrev);
  }

  // Update timestamp
  memory.updatedAt = new Date().toISOString();

  // Load agent history for the graph
  const agentHistoryStr = await fileExists(paths.agentHistory) ? await fs.readFile(paths.agentHistory, 'utf-8') : '[]';
  const agentHistory = JSON.parse(agentHistoryStr);

  // Build Knowledge Graph
  const { graph, markdown } = await buildKnowledgeGraph(memory, agentHistory, projectPath);
  memory.knowledgeGraph = graph;

  // Generate Mermaid file
  await writeText(path.join(paths.root, 'KNOWLEDGE_GRAPH.md'), markdown);

  // Remove lastHash before saving to calculate new one accurately on next load
  const memoryToSave = { ...memory };
  delete memoryToSave.lastHash;

  // Write all files
  await Promise.all([
    writeJson(paths.memory, memoryToSave),
    writeJson(paths.architecture, memory.architecture),
    writeJson(paths.workflows, memory.workflows),
    writeJson(paths.timeline, memory.timeline),
    writeJson(paths.features, memory.features),
    writeJson(paths.currentFocus, memory.focusHistory),
    writeText(paths.decisions, renderDecisionsMarkdown(memory.decisions)),
    writeText(paths.workflows.replace('.json', '.md'), renderWorkflowsMarkdown(memory.workflows || [])),
    writeText(paths.aiProtocol, generateAiProtocol(memory.projectName)),
    writeJson(paths.knowledgeGraphJson, memory.knowledgeGraph),
    writeText(paths.knowledgeGraphMd, generateMermaidGraph(memory.knowledgeGraph)),
  ]);
}

// ---------------------------------------------------------------------------
// Memory mutation helpers
// ---------------------------------------------------------------------------

/**
 * Updates memory with new discovery evidence.
 */
export function updateEvidence(
  memory: ProjectMemory,
  result: DiscoveryResult,
): void {
  memory.evidence = result.evidence;
  memory.architecture = result.architecture;
  memory.confidence = result.confidence;
  memory.scenario = result.scenario;
  memory.workflows = result.workflows;
  memory.timeline = result.timeline;
  memory.features = result.features;

  // Sync v0.2 engines (they update the root memory object in the orchestrator)
  // This ensures they are persisted on save.
  
  // Infer description from README if not set
  if (!memory.description && result.evidence.documentation.readmeSummary) {
    memory.description = result.evidence.documentation.readmeSummary;
  }
}

/**
 * Adds a decision to memory.
 */
export function addDecision(memory: ProjectMemory, decision: Decision): void {
  memory.decisions.push(decision);
}

/**
 * Adds a developer note to memory.
 */
export function addNote(memory: ProjectMemory, note: DeveloperNote): void {
  memory.notes.push(note);
}

/**
 * Adds a session reference to memory.
 */
export function addSessionRef(memory: ProjectMemory, ref: SessionReference): void {
  memory.sessions.push(ref);
}

/**
 * Sets the current focus.
 */
export function setCurrentFocus(memory: ProjectMemory, focus: CurrentFocus | null): void {
  memory.focusHistory.active = focus;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Checks if .project-mind/ is already initialized.
 */
export async function isInitialized(projectPath: string): Promise<boolean> {
  const paths = getMemoryFilePaths(projectPath);
  return fileExists(paths.root);
}

/**
 * Gets the next session ID by counting existing sessions.
 */
export function getNextSessionId(memory: ProjectMemory): number {
  if (memory.sessions.length === 0) return 0;
  return Math.max(...memory.sessions.map(s => s.id)) + 1;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderDecisionsMarkdown(decisions: Decision[]): string {
  if (decisions.length === 0) {
    return '# Decisions\n\nNo decisions recorded yet.\n';
  }

  let md = '# Decisions\n\n';
  md += `> ${decisions.length} decision(s) recorded.\n\n`;
  md += '---\n\n';

  for (const decision of decisions) {
    md += `## ${decision.title}\n\n`;
    md += `**Date:** ${new Date(decision.timestamp).toLocaleDateString()}\n`;
    md += `**Source:** ${decision.source}\n\n`;
    md += `${decision.description}\n\n`;

    if (decision.rejected.length > 0) {
      md += `**Rejected alternatives:** ${decision.rejected.join(', ')}\n\n`;
    }
    if (decision.reason) {
      md += `**Reason:** ${decision.reason}\n\n`;
    }
    if (decision.tags.length > 0) {
      md += `**Tags:** ${decision.tags.map(t => `\`${t}\``).join(' ')}\n\n`;
    }
    md += '---\n\n';
  }

  return md;
}

function renderWorkflowsMarkdown(workflows: Workflow[]): string {
  if (workflows.length === 0) {
    return '# Workflows\n\nNo workflows detected yet.\n';
  }

  let md = '# Detected Workflows\n\n';
  md += `> ${workflows.length} workflow(s) detected from import graph analysis.\n\n`;
  md += '---\n\n';

  for (const wf of workflows) {
    md += `## ${wf.name}\n\n`;
    md += `**Type:** \`${wf.type}\`\n`;
    md += `**Confidence:** ${wf.confidence}%\n\n`;
    md += `${wf.description}\n\n`;

    md += `### Component Path\n`;
    if (wf.components.length > 0) {
      md += `\`${wf.components.join(' → ')}\`\n\n`;
    } else {
      md += `*No clear architectural path detected.*\n\n`;
    }

    md += `### Files Involved\n`;
    for (const file of wf.files) {
      md += `- \`${file}\`\n`;
    }
    md += '\n---\n\n';
  }

  return md;
}

function generateAiProtocol(projectName: string): string {
  return `# AI Protocol — ${projectName}

> This document defines the strict operational contract for any AI agent working on this project.
> All agents (Codex, Claude, Cursor, Copilot, etc.) MUST abide by these rules.

## 📥 Before Coding (Context Retrieval)
1. Read \`AI_START_HERE.md\` to understand the project architecture and features.
2. Read \`CURRENT_FOCUS.json\` to understand the active task, status, and expected modules.
3. Read \`DECISIONS.md\` to avoid repeating past mistakes or violating project boundaries.

## 📤 Before Ending Session (State Persistence)
1. **Record Decisions:** If you made an architectural choice, rejected an alternative, or set a pattern, run \`project-mind note --decision "..."\`.
2. **Update Focus:** If the active feature was completed, run \`project-mind complete-feature\`.
3. **Run Update:** Always run \`project-mind update\` to sync structural changes back to memory.
4. **Handoff:** Remind the user to run \`project-mind handoff\` if major documents changed.
`;
}
