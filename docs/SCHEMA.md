# Project-Mind Database Schema

Project-Mind acts as a localized long-term memory store for AI agents. It does not use a traditional relational database; instead, it uses a centralized JSON file located at `.project-mind/derived/MEMORY.json`.

This document outlines the core entities and relationships within this memory store. By understanding this schema, AI agents can directly traverse and manipulate Project-Mind's memory via the MCP server or the CLI.

## `ProjectMemory` (Root)

The root object of the entire database.

```typescript
export interface ProjectMemory {
  /** Schema version (e.g. "0.3") */
  version: string;
  /** Global understanding scores */
  confidence: ConfidenceScores;
  /** Architecture & component layers */
  architecture: ArchitectureModel | null;
  /** Raw evidence extracted during initialization */
  evidence: EvidenceStore;
  /** The Knowledge Graph linking all files, components, and concepts */
  graph: KnowledgeGraph;
  /** Extracted features spanning multiple files */
  features: FeatureNode[];
  /** Historical architectural decisions */
  decisions: Decision[];
  /** High-level operational workflows */
  workflows: WorkflowNode[];
  /** Currently active task tracking */
  focusHistory: FocusHistory;
  /** Historical sessions recorded by the agent */
  sessions: SessionReference[];
}
```

## Core Entities

### 1. `KnowledgeGraph`

The graph is the core engine of Project-Mind. It represents the relationships between source code files, classes, components, features, and workflows.

```typescript
export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;          // Globally unique ID (e.g., 'file_src/index.ts', 'class_UserService')
  type: NodeType;      // 'file', 'component', 'feature', 'workflow', 'class', etc.
  name: string;
  description?: string;
  filePath?: string;
  confidence: number;  // 0-100
}

export interface GraphEdge {
  source: string;      // Node ID
  target: string;      // Node ID
  type: EdgeType;      // 'depends_on', 'part_of', 'implements', 'affects'
  weight: number;      // 0-1
}
```

### 2. `ArchitectureModel`

Represents the physical and logical structure of the repository.

```typescript
export interface ArchitectureModel {
  pattern: 'layered' | 'hexagonal' | 'monolithic' | 'microservices' | 'unknown';
  components: ArchitectureComponent[];
  principles: string[];
}

export interface ArchitectureComponent {
  name: string;
  type: string;        // e.g. 'controller', 'service', 'repository'
  directory: string;
  description: string;
  files: string[];
  dependencies: string[]; // Directories this component depends on
}
```

### 3. `Decision`

The immutable ledger of architectural decisions and constraints. Agents should check these constraints before planning changes.

```typescript
export interface Decision {
  id: string;                 // UUID
  timestamp: string;          // ISO Date
  title: string;              // High level title
  description: string;        // In-depth description
  reason: string;             // Why this decision was made
  rejected: string[];         // Alternative approaches that were rejected
  source: 'ast' | 'manual' | 'agent';
  tags: string[];             // e.g. ["database", "auth"]
  impactedComponents: string[];
  impactedFeatures: string[];
}
```

### 4. `CurrentFocus`

Tracks what the developer (or the agent) is actively building.

```typescript
export interface CurrentFocus {
  id: string;
  feature: string;           // e.g. "Add User Authentication"
  task: string;              // In-depth description of the goal
  status: 'planning' | 'in-progress' | 'blocked' | 'review' | 'completed';
  blockers: string[];        // Array of string descriptions of blockers
  expectedModules: string[]; // Files we expect to touch
  actualModules: string[];   // Files we actually touched
  subTasks: SubTask[];       // Granular checklist items
  linkedCommits: string[];   // Commit SHAs solving this task
}

export interface SubTask {
  id: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
}
```

## Traversing the Schema via MCP

When connected via the Model Context Protocol (MCP), you can access these tables using the following tools:

- `project-mind-search`: Semantic search against nodes and components.
- `project-mind-query`: SQL-like queries against the graph (e.g., `MATCH (n:component)-[:depends_on]->(target)`).
- `project-mind-decisions`: Retrieves the `Decision` table constraints.
- `project-mind-focus`: Retrieves or mutates the `CurrentFocus` state.
