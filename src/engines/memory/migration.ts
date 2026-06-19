// ============================================================================
// Memory Engine: Schema Migration
// ============================================================================

import { SCHEMA_VERSION, GRAPH_VERSION } from './schema.js';
import type { ProjectMemory, FocusHistory, CurrentFocus } from '../../types/index.js';
import logger from '../../utils/logger.js';
import { randomUUID } from 'node:crypto';

/**
 * Validates and migrates an older schema version of ProjectMemory to the current version.
 * Modifies the object in place and returns the migrated object.
 */
export function migrateMemory(rawMemory: any): ProjectMemory {
  if (!rawMemory) throw new Error('Memory is undefined or null.');

  let hasMigrated = false;

  // ---------------------------------------------------------------------------
  // v0.1 / v0.2 to v0.3+ (currentTask -> focusHistory)
  // ---------------------------------------------------------------------------
  if (rawMemory.currentTask !== undefined) {
    if (rawMemory.currentTask !== null) {
      // It has data, we must migrate it into focusHistory
      const legacyTask = rawMemory.currentTask;
      
      const newFocus: CurrentFocus = {
        id: randomUUID().slice(0, 8),
        feature: legacyTask.module || 'Unknown',
        task: legacyTask.description || 'Legacy Task',
        status: legacyTask.status === 'in-progress' ? 'in-progress' : 'completed',
        blockers: legacyTask.blockers || [],
        expectedModules: legacyTask.expectedModules || [],
        actualModules: [],
        subTasks: [],
        linkedCommits: [],
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      if (!rawMemory.focusHistory) {
        rawMemory.focusHistory = {
          active: newFocus.status === 'in-progress' ? newFocus : null,
          history: newFocus.status === 'completed' ? [newFocus] : [],
        } as FocusHistory;
      }
    } else if (!rawMemory.focusHistory) {
      // It was null, just init focusHistory
      rawMemory.focusHistory = { active: null, history: [] };
    }

    // Clean up deprecated property
    delete rawMemory.currentTask;
    hasMigrated = true;
  }

  // ---------------------------------------------------------------------------
  // Ensure basic arrays are present (v0.2+ features)
  // ---------------------------------------------------------------------------
  if (!rawMemory.workflows) {
    rawMemory.workflows = [];
    hasMigrated = true;
  }
  if (!rawMemory.timeline) {
    rawMemory.timeline = [];
    hasMigrated = true;
  }
  if (!rawMemory.features) {
    rawMemory.features = [];
    hasMigrated = true;
  } else {
    // Migrate legacy features
    for (const feat of rawMemory.features) {
      if (feat.title && !feat.name) {
        feat.name = feat.title;
        delete feat.title;
        hasMigrated = true;
      }
      if (!feat.components) { feat.components = []; hasMigrated = true; }
      if (!feat.files) { feat.files = []; hasMigrated = true; }
      if (!feat.dependencies) { feat.dependencies = []; hasMigrated = true; }
      if (!feat.status) { feat.status = 'unknown'; hasMigrated = true; }
      if (feat.confidence === undefined) { feat.confidence = 0; hasMigrated = true; }
    }
  }
  if (!rawMemory.sessions) {
    rawMemory.sessions = [];
    hasMigrated = true;
  }
  if (!rawMemory.decisions) {
    rawMemory.decisions = [];
    hasMigrated = true;
  }
  if (!rawMemory.notes) {
    rawMemory.notes = [];
    hasMigrated = true;
  }
  if (!rawMemory.confidence) {
    // Basic init since we don't have createEmptyConfidence here
    rawMemory.confidence = { overall: 0, architecture: 0, evidence: 0, workflows: 0, decisions: 0, evidenceSources: 0, maxEvidenceSources: 4 };
    hasMigrated = true;
  }
  if (!rawMemory.architecture) {
    rawMemory.architecture = { pattern: null, layers: [], components: [], componentDependencies: [], confidence: 0 };
    hasMigrated = true;
  }
  if (!rawMemory.evidence) {
    rawMemory.evidence = { git: null, sourceCode: { totalFiles: 0, totalLines: 0, languages: [], directoryStructure: [], entryPoints: [], fileCategories: { source: [], test: [], config: [], docs: [], assets: [], other: [] }, importGraph: { nodes: [], edges: [], circularDeps: [] } }, buildFiles: { buildSystems: [], dependencies: [], frameworks: [], scripts: [], packageManager: null }, documentation: { hasReadme: false, readmeSummary: null, hasChangelog: false, hasContributing: false, hasApiDocs: false, licenseType: null, documentationFiles: [] } };
    hasMigrated = true;
  }
  if (!rawMemory.focusHistory) {
    rawMemory.focusHistory = { active: null, history: [] };
    hasMigrated = true;
  } else {
    // Migrate existing FocusHistory items to have new fields
    const items = [...(rawMemory.focusHistory.history || [])];
    if (rawMemory.focusHistory.active) items.push(rawMemory.focusHistory.active);
    
    for (const item of items) {
      if (item.actualModules === undefined) { item.actualModules = []; hasMigrated = true; }
      if (item.subTasks === undefined) { item.subTasks = []; hasMigrated = true; }
      if (item.linkedCommits === undefined) { item.linkedCommits = []; hasMigrated = true; }
      if (item.startedAt === undefined) { item.startedAt = item.lastUpdated || new Date().toISOString(); hasMigrated = true; }
    }
  }

  // ---------------------------------------------------------------------------
  // v1.0.0 to v1.1.0 (Graph Version 2.0)
  // ---------------------------------------------------------------------------
  if (!rawMemory.knowledgeGraph) {
    rawMemory.knowledgeGraph = { version: GRAPH_VERSION, nodes: [], edges: [] };
    hasMigrated = true;
  } else if (rawMemory.knowledgeGraph.version !== GRAPH_VERSION) {
    rawMemory.knowledgeGraph.version = GRAPH_VERSION;
    hasMigrated = true;
  }

  // ---------------------------------------------------------------------------
  // Version Bump
  // ---------------------------------------------------------------------------
  if (rawMemory.version !== SCHEMA_VERSION) {
    rawMemory.version = SCHEMA_VERSION;
    hasMigrated = true;
  }

  if (hasMigrated) {
    logger.info(`Migrated memory schema to v${SCHEMA_VERSION}`);
  }

  return rawMemory as ProjectMemory;
}
