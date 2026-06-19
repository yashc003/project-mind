// ============================================================================
// Plugin SDK Types (v0.6)
// ============================================================================

import type {
  Component,
  Workflow,
  Feature,
  Decision,
  GraphNode,
  GraphEdge,
  ProjectMemory,
  EvidenceSources,
  KnowledgeGraph,
} from './index.js';

export interface PluginContribution {
  /** The origin plugin name (e.g., 'plugin-spring-boot') */
  source: string;
  components?: Component[];
  workflows?: Workflow[];
  features?: Feature[];
  decisions?: Decision[];
  graphNodes?: GraphNode[];
  graphEdges?: GraphEdge[];
}

export interface PackContext {
  topic: string;
  isCurrent: boolean;
  level: 'compact' | 'full';
  memory: ProjectMemory;
}

export interface ExplainContext {
  topic: string;
  node: GraphNode;
  memory: ProjectMemory;
}

export interface PluginContext {
  projectPath: string;
  evidence: EvidenceSources;
  ast?: typeof import('../engines/discovery/ast/AstService.js').AstService;
}

export interface PackSection {
  title: string;
  content: string;
}

export interface ExplainSection {
  title: string;
  content: string;
}

export interface SnapshotSection {
  title: string;
  content: string;
}

export type PluginCapability = 'architecture' | 'workflow' | 'feature' | 'pack' | 'explain' | 'graph' | 'snapshot';

export interface ProjectMindPlugin {
  /** Name of the plugin (e.g., @project-mind/plugin-spring-boot) */
  name: string;
  /** Version of the plugin */
  version: string;
  /** Compatible project-mind engine version */
  projectMindVersion: string;
  /** The target framework this plugin analyzes */
  targetFramework: string;
  /** Execution priority (lower is earlier, default 100) */
  priority?: number;
  /** Declared capabilities */
  capabilities: PluginCapability[];

  /** Called during discovery to contribute knowledge */
  analyze?(context: PluginContext): Promise<PluginContribution> | PluginContribution;
  
  /** Called when generating a Context Pack */
  onPackGeneration?(context: PackContext): Promise<PackSection[]> | PackSection[];
  
  /** Called when explaining a node */
  onExplain?(context: ExplainContext): Promise<ExplainSection[]> | ExplainSection[];

  /** Called when the knowledge graph is generated */
  onGraphGenerated?(graph: KnowledgeGraph): Promise<void> | void;

  /** Called when a snapshot is requested */
  onSnapshot?(memory: ProjectMemory): Promise<SnapshotSection[]> | SnapshotSection[];
}
