// ============================================================================
// Project-Mind v0.1 — Core Type Definitions
// ============================================================================
// These types define the complete data model for the project intelligence
// platform. Every engine reads and writes data conforming to these interfaces.
// ============================================================================

// ---------------------------------------------------------------------------
// Top-Level Memory
// ---------------------------------------------------------------------------

/**
 * The root data structure persisted as MEMORY.json.
 * This is the single source of truth for all project understanding.
 */
export interface ProjectMemory {
  /** Schema version for migration support */
  version: string;
  /** Human-readable project name */
  projectName: string;
  /** Optional project description */
  description: string;
  /** ISO 8601 timestamp of initial creation */
  createdAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** Detected project scenario */
  scenario: ProjectScenario;
  /** Evidence collected from all sources */
  evidence: EvidenceSources;
  /** Structural model of the project */
  architecture: ArchitectureModel;
  /** Developer decisions and rationale */
  decisions: Decision[];
  /** Developer notes (non-decision) */
  notes: DeveloperNote[];
  /** References to session files */
  sessions: SessionReference[];
  /** Aggregate confidence scores */
  confidence: ConfidenceScores;
  /** Active intent and historical task focus (v0.3) */
  focusHistory: FocusHistory;
  /** File dependency graph (v0.2) */
  importGraph?: ImportGraph;
  /** Detected workflows (v0.2) */
  workflows?: Workflow[];
  /** Reconstructed project evolution (v0.2) */
  timeline?: TimelineEvent[];
  /** Identified features (v0.2) */
  features?: Feature[];
  /** Knowledge Graph (v0.4) */
  knowledgeGraph?: KnowledgeGraph;
  /** Concurrency hash (v0.4) */
  lastHash?: string;
}

// ---------------------------------------------------------------------------
// Project Scenarios (from the vision document)
// ---------------------------------------------------------------------------

export type ProjectScenario =
  | 'brand-new'     // A: No code, no Git
  | 'existing'      // B: Code exists, no Git
  | 'mature'        // C: Code + Git
  | 'fully-tracked' // D: Code + Git + Conversations + Project-Mind
  ;

// ---------------------------------------------------------------------------
// Evidence Sources
// ---------------------------------------------------------------------------

export interface EvidenceSources {
  git: GitEvidence | null;
  sourceCode: SourceEvidence;
  buildFiles: BuildEvidence;
  documentation: DocEvidence;
}

/** Evidence extracted from Git history */
export interface GitEvidence {
  /** Whether a Git repo was detected */
  isGitRepo: boolean;
  /** Total commit count */
  totalCommits: number;
  /** Unique authors */
  authors: AuthorInfo[];
  /** Branch names */
  branches: string[];
  /** Tag names */
  tags: string[];
  /** Default/current branch */
  currentBranch: string;
  /** Remote URL if available */
  remoteUrl: string | null;
  /** Most recent commits (up to 20) */
  recentCommits: CommitInfo[];
  /** Files ordered by change frequency */
  hotspots: FileHotspot[];
  /** First commit date */
  firstCommitDate: string | null;
  /** Latest commit date */
  latestCommitDate: string | null;
}

export interface AuthorInfo {
  name: string;
  email: string;
  commitCount: number;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  filesChanged: number;
}

export interface FileHotspot {
  filePath: string;
  changeCount: number;
}

/** Evidence extracted from source code scanning */
export interface SourceEvidence {
  /** Total number of source files */
  totalFiles: number;
  /** Total lines of code (approximate) */
  totalLines: number;
  /** Detected programming languages */
  languages: LanguageInfo[];
  /** Top-level directory structure */
  directoryStructure: DirectoryNode[];
  /** Detected entry points */
  entryPoints: string[];
  /** File categorization */
  fileCategories: FileCategories;
  /** Import graph between source files (v0.2) */
  importGraph?: ImportGraph;
}

export interface LanguageInfo {
  name: string;
  extensions: string[];
  fileCount: number;
  lineCount: number;
  percentage: number;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: DirectoryNode[];
  /** Only for files */
  language?: string;
  lineCount?: number;
}

export interface FileCategories {
  source: string[];
  test: string[];
  config: string[];
  docs: string[];
  assets: string[];
  other: string[];
}

/** Evidence extracted from build/config files */
export interface BuildEvidence {
  /** Detected build systems */
  buildSystems: BuildSystem[];
  /** All detected dependencies */
  dependencies: DependencyInfo[];
  /** Detected frameworks */
  frameworks: FrameworkInfo[];
  /** Build/run scripts */
  scripts: ScriptInfo[];
  /** Package manager detected */
  packageManager: string | null;
}

export interface BuildSystem {
  name: string;
  configFile: string;
  language: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer' | 'optional';
  source: string; // Which build file it came from
}

export interface FrameworkInfo {
  name: string;
  version: string;
  category: 'web' | 'api' | 'testing' | 'build' | 'database' | 'utility' | 'other';
  confidence: number;
}

export interface ScriptInfo {
  name: string;
  command: string;
  source: string;
}

/** Evidence extracted from documentation */
export interface DocEvidence {
  /** Whether a README exists */
  hasReadme: boolean;
  /** README content summary (first ~500 chars) */
  readmeSummary: string | null;
  /** Whether a CHANGELOG exists */
  hasChangelog: boolean;
  /** Whether a CONTRIBUTING guide exists */
  hasContributing: boolean;
  /** Whether API documentation exists */
  hasApiDocs: boolean;
  /** License type detected */
  licenseType: string | null;
  /** Documentation files found */
  documentationFiles: string[];
}

// ---------------------------------------------------------------------------
// Architecture Model
// ---------------------------------------------------------------------------

export interface ArchitectureModel {
  /** Detected architectural pattern */
  pattern: ArchitecturePattern | null;
  /** Detected layers/tiers */
  layers: ArchitectureLayer[];
  /** Identified logical components */
  components: Component[];
  /** Inter-component dependencies (basic) */
  componentDependencies: ComponentDependency[];
  /** Overall architecture confidence */
  confidence: number;
}

export type ArchitecturePattern =
  | 'mvc'
  | 'layered'
  | 'microservices'
  | 'monolith'
  | 'modular'
  | 'component-based'
  | 'unknown'
  ;

export interface ArchitectureLayer {
  name: string;
  type: LayerType;
  directories: string[];
  fileCount: number;
}

export type LayerType =
  | 'presentation'
  | 'api'
  | 'business-logic'
  | 'data-access'
  | 'infrastructure'
  | 'utility'
  | 'test'
  | 'config'
  | 'unknown'
  ;

export interface Component {
  name: string;
  type: ComponentType;
  directory: string;
  files: string[];
  endpoints?: string[];
  confidence: number;
}

export type ComponentType =
  | 'controller'
  | 'service'
  | 'repository'
  | 'model'
  | 'entity'
  | 'dto'
  | 'middleware'
  | 'component'  // UI component
  | 'page'
  | 'view'
  | 'utility'
  | 'config'
  | 'test'
  | 'migration'
  | 'other'
  ;

export interface ComponentDependency {
  from: string; // component name
  to: string;   // component name
  type: 'imports' | 'uses' | 'depends-on';
  confidence: number;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export interface PolicyException {
  policyId: string;
  targetId: string;
  createdAt: string;
  expires: string;
  reason: string;
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  rejected: string[];
  reason: string;
  timestamp: string;
  source: DecisionSource;
  tags: string[];
  confidence: number;             // Extraction confidence (v0.3)
  impactedFeatures: string[];     // Links to Features (v0.3)
  impactedComponents: string[];   // Links to Architecture Components (v0.3)
}

export type DecisionSource = 'manual' | 'git' | 'conversation' | 'inferred';

// ---------------------------------------------------------------------------
// Developer Notes
// ---------------------------------------------------------------------------

export interface DeveloperNote {
  id: string;
  content: string;
  timestamp: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Knowledge Graph (v0.4)
// ---------------------------------------------------------------------------

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  type: 'component' | 'feature' | 'workflow' | 'decision' | 'focus' | 'agent' | 'file';
  label: string;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  source: string; // Node ID
  target: string; // Node ID
  relation: 'BELONGS_TO' | 'IMPACTS' | 'IMPLEMENTS' | 'TRIGGERS' | 'CREATED' | 'UPDATED' | 'MODIFIED' | 'CONTAINS' | 'DEPENDS_ON';
  properties?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface Session {
  id: number;
  timestamp: string;
  type: SessionType;
  summary: string;
  changes: SessionChange[];
  evidenceUpdated: string[];
  notes: string | null;
  duration: number | null; // milliseconds
}

export type SessionType = 'init' | 'deep-scan' | 'update' | 'note' | 'handoff';

export interface SessionChange {
  file: string;
  action: 'created' | 'modified' | 'deleted';
}

export interface SessionReference {
  id: number;
  timestamp: string;
  type: SessionType;
  summary: string;
}

// ---------------------------------------------------------------------------
// Current Focus (v0.3)
// ---------------------------------------------------------------------------

export interface FocusHistory {
  active: CurrentFocus | null;
  history: CurrentFocus[];
}

export interface CurrentFocus {
  id: string;
  feature: string;
  task: string;
  status: 'planning' | 'in-progress' | 'blocked' | 'review' | 'completed';
  blockers: string[];
  expectedModules: string[];
  actualModules: string[];
  subTasks: SubTask[];
  linkedCommits: string[];
  startedAt: string;
  lastUpdated: string;
  completedAt?: string;
}

export interface SubTask {
  id: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  createdAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Agent History (v0.3)
// ---------------------------------------------------------------------------

export interface AgentInteraction {
  agent: string;
  action: string;
  timestamp: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Confidence Scores
// ---------------------------------------------------------------------------

export interface ConfidenceScores {
  /** Overall project understanding confidence (0–100) */
  overall: number;
  /** Confidence in architecture detection */
  architecture: number;
  /** Confidence in evidence completeness */
  evidence: number;
  /** Confidence in workflow detection */
  workflows: number;
  /** Confidence in decision tracking */
  decisions: number;
  /** Number of evidence sources available */
  evidenceSources: number;
  /** Maximum possible evidence sources */
  maxEvidenceSources: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ProjectMindConfig {
  /** Schema version */
  version: string;
  /** Directories to ignore during scanning */
  ignoreDirs: string[];
  /** File patterns to ignore */
  ignoreFiles: string[];
  /** Maximum file size to scan (bytes) */
  maxFileSizeBytes: number;
  /** Maximum directory depth for scanning */
  maxDepth: number;
  /** Whether to auto-update on git hooks */
  autoUpdate: boolean;
  /** Number of recent commits to include in handoff */
  recentCommitCount: number;
  /** Number of recent sessions to include in handoff */
  recentSessionCount: number;
  /** Custom architecture rules (v0.3) */
  customArchitectureRules?: any[];
  /** Registered plugins (v0.6) */
  plugins?: string[];
  /** Governance Policies (v0.7) */
  policies?: GovernancePolicy[];
  /** Governance Policy Exceptions (v0.7) */
  exceptions?: PolicyException[];
  /** Safe Mode: Disables all plugin execution (Security) */
  safeMode?: boolean;
}

// ---------------------------------------------------------------------------
// Discovery Engine Types
// ---------------------------------------------------------------------------

export interface DiscoveryResult {
  scenario: ProjectScenario;
  evidence: EvidenceSources;
  architecture: ArchitectureModel;
  confidence: ConfidenceScores;
  workflows: Workflow[];
  timeline: TimelineEvent[];
  features: Feature[];
  duration: number; // milliseconds
}

// ---------------------------------------------------------------------------
// Handoff Types
// ---------------------------------------------------------------------------

export interface HandoffData {
  projectName: string;
  description: string;
  scenario: ProjectScenario;
  languages: LanguageInfo[];
  frameworks: FrameworkInfo[];
  architecture: ArchitectureModel;
  workflows: Workflow[];
  features: Feature[];
  timeline: TimelineEvent[];
  recentCommits: CommitInfo[];
  recentSessions: SessionReference[];
  decisions: Decision[];
  focusHistory: FocusHistory;
  confidence: ConfidenceScores;
  keyFiles: string[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Import Graph (v0.2)
// ---------------------------------------------------------------------------

export interface ImportGraph {
  nodes: ImportNode[];
  edges: ImportEdge[];
  circularDeps: string[][];
}

export interface ImportNode {
  filePath: string;
  language: string;
  importCount: number;
  importedByCount: number;
}

export interface ImportEdge {
  from: string;
  to: string;
  importedSymbols: string[];
  isRelative: boolean;
}

// ---------------------------------------------------------------------------
// Workflows (v0.2)
// ---------------------------------------------------------------------------

export interface Workflow {
  id: string;
  name: string;
  description: string;
  entryPoint: string;
  dependencyScope?: string; // e.g., 'file'
  sourceFile?: string;      // e.g., 'UserController.ts'
  components: string[];
  files: string[];
  confidence: number;
  type: WorkflowType;
}

export type WorkflowType =
  | 'api-request'
  | 'event-handler'
  | 'data-pipeline'
  | 'ui-flow'
  | 'cli-command'
  | 'generic';

// ---------------------------------------------------------------------------
// Timeline (v0.2)
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  date: string;
  type: TimelineEventType;
  title: string;
  description: string;
  files: string[];
  confidence: number;
}

export type TimelineEventType =
  | 'feature'
  | 'refactor'
  | 'bugfix'
  | 'release'
  | 'milestone';

// ---------------------------------------------------------------------------
// Features (v0.2)
// ---------------------------------------------------------------------------

export interface Feature {
  id: string;
  name: string;
  files: string[];
  components: string[];
  dependencies: string[];
  status: 'active' | 'stale' | 'unknown';
  confidence: number;
}

// ---------------------------------------------------------------------------
// Governance (v0.7)
// ---------------------------------------------------------------------------

export type PolicyCategory = 
  | 'dependency' 
  | 'feature' 
  | 'workflow' 
  | 'decision' 
  | 'metadata' 
  | 'orphan'
  | 'architecture';

export interface GovernancePolicy {
  id: string;
  name: string;
  severity: 'error' | 'warn';
  enforcement: 'blocking' | 'advisory';
  category: PolicyCategory;
  condition: any; 
  message: string;
}

// PolicyException is defined above at line 313

export interface PolicyResult {
  policyId: string;
  status: 'passed' | 'warning' | 'failed';
  affectedNodes: string[];
  message: string;
}

export interface GovernanceMetrics {
  architectureScore: number;
  totalPolicies: number;
  passedPolicies: number;
  warningCount: number;
  errorCount: number;
  debtCount: number;
}

export interface GovernanceReport {
  generatedAt: string;
  metrics: GovernanceMetrics;
  results: PolicyResult[];
  exceptions: PolicyException[];
}

// ---------------------------------------------------------------------------
// Re-exports from plugin types
// ---------------------------------------------------------------------------

// ============================================================================
// Diff Engine / Graph Deltas
// ============================================================================

export interface DiffDelta {
  components: {
    added: Component[];
    removed: Component[];
    modified: Component[]; // Same name, different type, deps, or files
  };
  dependencies: {
    added: ComponentDependency[];
    removed: ComponentDependency[];
  };
  features: {
    started: Feature[];
    completed: Feature[];
  };
  decisions: {
    added: Decision[];
  };
  hasChanges: boolean;
}

export type { ProjectMindPlugin, PluginContext, PluginContribution, ExplainContext, ExplainSection, PackContext, PackSection } from './plugin.js';
export * from './pack.js';
