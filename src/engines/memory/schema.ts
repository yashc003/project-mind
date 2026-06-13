// ============================================================================
// Schema Factories & Validation
// ============================================================================
// Provides factory functions that create default/empty instances of all major
// data structures. This ensures consistent initialization throughout the app.
// ============================================================================

import type {
  ProjectMemory,
  ProjectMindConfig,
  EvidenceSources,
  ArchitectureModel,
  ConfidenceScores,
  SourceEvidence,
  BuildEvidence,
  DocEvidence,
  Session,
  SessionType,
  SessionChange,
  ImportGraph,
  FocusHistory,
  KnowledgeGraph,
} from '../../types/index.js';

/** Current schema version */
export const SCHEMA_VERSION = '1.0.0';

/** Default configuration values */
export const DEFAULT_CONFIG: ProjectMindConfig = {
  version: SCHEMA_VERSION,
  ignoreDirs: [
    'node_modules',
    '.git',
    '.project-mind',
    'dist',
    'build',
    'out',
    'target',
    '.next',
    '.nuxt',
    '__pycache__',
    '.pytest_cache',
    'venv',
    '.venv',
    'vendor',
    'coverage',
    '.idea',
    '.vscode',
    '.DS_Store',
  ],
  ignoreFiles: [
    '*.lock',
    '*.min.js',
    '*.min.css',
    '*.map',
    '*.ico',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.svg',
    '*.woff',
    '*.woff2',
    '*.ttf',
    '*.eot',
    '*.mp4',
    '*.mp3',
    '*.pdf',
    '*.zip',
    '*.tar',
    '*.gz',
  ],
  maxFileSizeBytes: 1024 * 1024, // 1MB
  maxDepth: 10,
  autoUpdate: true,
  recentCommitCount: 10,
  recentSessionCount: 5,
};

/** Creates an empty ProjectMemory with default values */
export function createEmptyMemory(projectName: string): ProjectMemory {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    projectName,
    description: '',
    createdAt: now,
    updatedAt: now,
    scenario: 'brand-new',
    evidence: createEmptyEvidence(),
    architecture: createEmptyArchitecture(),
    decisions: [],
    notes: [],
    sessions: [],
    confidence: createEmptyConfidence(),
    focusHistory: { active: null, history: [] },
    workflows: [],
    timeline: [],
    features: [],
    knowledgeGraph: { nodes: [], edges: [] },
  };
}

/** Creates empty evidence sources */
export function createEmptyEvidence(): EvidenceSources {
  return {
    git: null,
    sourceCode: createEmptySourceEvidence(),
    buildFiles: createEmptyBuildEvidence(),
    documentation: createEmptyDocEvidence(),
  };
}

export function createEmptySourceEvidence(): SourceEvidence {
  return {
    totalFiles: 0,
    totalLines: 0,
    languages: [],
    directoryStructure: [],
    entryPoints: [],
    fileCategories: {
      source: [],
      test: [],
      config: [],
      docs: [],
      assets: [],
      other: [],
    },
    importGraph: createEmptyImportGraph(),
  };
}

export function createEmptyBuildEvidence(): BuildEvidence {
  return {
    buildSystems: [],
    dependencies: [],
    frameworks: [],
    scripts: [],
    packageManager: null,
  };
}

export function createEmptyDocEvidence(): DocEvidence {
  return {
    hasReadme: false,
    readmeSummary: null,
    hasChangelog: false,
    hasContributing: false,
    hasApiDocs: false,
    licenseType: null,
    documentationFiles: [],
  };
}

export function createEmptyArchitecture(): ArchitectureModel {
  return {
    pattern: null,
    layers: [],
    components: [],
    componentDependencies: [],
    confidence: 0,
  };
}

export function createEmptyImportGraph(): ImportGraph {
  return {
    nodes: [],
    edges: [],
    circularDeps: [],
  };
}

export function createEmptyConfidence(): ConfidenceScores {
  return {
    overall: 0,
    architecture: 0,
    evidence: 0,
    workflows: 0,
    decisions: 0,
    evidenceSources: 0,
    maxEvidenceSources: 4, // git, source, build, docs
  };
}

/** Creates a new session record */
export function createSession(
  id: number,
  type: SessionType,
  summary: string,
  changes: SessionChange[] = [],
  notes: string | null = null,
  duration: number | null = null,
): Session {
  return {
    id,
    timestamp: new Date().toISOString(),
    type,
    summary,
    changes,
    evidenceUpdated: [],
    notes,
    duration,
  };
}

/** Validates that memory conforms to the expected schema version */
export function validateMemoryVersion(memory: ProjectMemory): boolean {
  return memory.version === SCHEMA_VERSION;
}

/** Returns the standardized absolute paths for all memory files */
export function getMemoryFilePaths(projectPath: string): Record<string, string> {
  const base = `${projectPath}/.project-mind`;
  return {
    root: base,
    memory: `${base}/MEMORY.json`,
    memoryPrev: `${base}/MEMORY_PREV.json`,
    architecture: `${base}/ARCHITECTURE.json`,
    features: `${base}/FEATURES.json`,
    timeline: `${base}/TIMELINE.json`,
    currentFocus: `${base}/CURRENT_FOCUS.json`,
    agentHistory: `${base}/AGENT_HISTORY.json`,
    config: `${base}/config.json`,
    aiStartHere: `${base}/AI_START_HERE.md`,
    aiProtocol: `${base}/AI_PROTOCOL.md`,
    projectContext: `${base}/PROJECT_CONTEXT.md`,
    handoff: `${base}/HANDOFF.md`,
    decisions: `${base}/DECISIONS.md`,
    workflows: `${base}/WORKFLOWS.json`,
    sessions: `${base}/sessions`,
    knowledgeGraphJson: `${base}/KNOWLEDGE_GRAPH.json`,
    knowledgeGraphMd: `${base}/KNOWLEDGE_GRAPH.md`,
  };
}
