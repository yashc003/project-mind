// ============================================================================
// Workflow Engine — Logical Flow Detection
// ============================================================================
// Detects logical workflows by tracing the import graph from entry points
// and mapping the traversal path through architectural components.
// ============================================================================

import path from 'node:path';
import crypto from 'node:crypto';
import type {
  EvidenceSources,
  ArchitectureModel,
  Workflow,
  WorkflowType,
  ImportNode,
  ImportEdge,
  Component,
} from '../../types/index.js';
import { readText } from '../../utils/fs.js';

export async function detectWorkflows(
  projectPath: string,
  evidence: EvidenceSources,
  architecture: ArchitectureModel
): Promise<Workflow[]> {
  const workflows: Workflow[] = [];
  const graph = evidence.sourceCode.importGraph;

  if (!graph || graph.nodes.length === 0) {
    return workflows;
  }

  // 1. Identify entry points (explicit and inferred via heuristics)
  const entryPoints = await identifyWorkflowEntryPoints(projectPath, evidence);

  // Map files to components for fast lookup
  const fileToComponent = new Map<string, string>();
  for (const comp of architecture.components) {
    for (const file of comp.files) {
      fileToComponent.set(file, comp.name);
    }
  }

  // Build adjacency list for fast graph traversal
  const adjList = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.isRelative) {
      if (!adjList.has(edge.from)) adjList.set(edge.from, []);
      adjList.get(edge.from)!.push(edge.to);
    }
  }

  // 2. Trace workflows from each entry point
  for (const ep of entryPoints) {
    const visitedFiles = new Set<string>();
    const componentChain: string[] = [];
    const queue: string[] = [ep.filePath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visitedFiles.has(current)) continue;
      visitedFiles.add(current);

      const comp = fileToComponent.get(current);
      if (comp && !componentChain.includes(comp)) {
        componentChain.push(comp);
      }

      const neighbors = adjList.get(current) || [];
      for (const n of neighbors) {
        if (!visitedFiles.has(n)) {
          queue.push(n);
        }
      }
    }

    if (componentChain.length > 0 || visitedFiles.size > 0) {
      // Calculate confidence based on depth and component cross-overs
      let confidence = 50;
      if (componentChain.length >= 3) confidence += 30; // Passes through multiple layers
      else if (componentChain.length === 2) confidence += 15;
      if (visitedFiles.size > 5) confidence += 10;

      workflows.push({
        id: crypto.randomBytes(4).toString('hex'),
        name: ep.name,
        description: `Triggered via ${path.basename(ep.filePath)}`,
        entryPoint: ep.filePath,
        components: componentChain,
        files: Array.from(visitedFiles),
        confidence: Math.min(confidence, 95),
        type: ep.type,
      });
    }
  }

  return workflows;
}

// ---------------------------------------------------------------------------
// Entry Point Identification
// ---------------------------------------------------------------------------

interface IdentifiedEntryPoint {
  filePath: string;
  name: string;
  type: WorkflowType;
}

async function identifyWorkflowEntryPoints(
  projectPath: string,
  evidence: EvidenceSources
): Promise<IdentifiedEntryPoint[]> {
  const eps: IdentifiedEntryPoint[] = [];

  // 1. Add explicit entry points from source evidence
  for (const file of evidence.sourceCode.entryPoints) {
    const name = path.basename(file, path.extname(file));
    eps.push({
      filePath: file,
      name: `${name} (Main App Entry)`,
      type: name === 'cli' ? 'cli-command' : 'generic',
    });
  }

  // 2. Search for controllers / routes / handlers
  const candidateDirs = ['routes', 'controllers', 'handlers', 'api', 'pages'];
  
  for (const file of evidence.sourceCode.fileCategories.source) {
    const dirName = path.basename(path.dirname(file));
    const isCandidateDir = candidateDirs.some(d => dirName.toLowerCase().includes(d));
    const isCandidateName = ['controller', 'route', 'handler', 'page'].some(n => file.toLowerCase().includes(n));

    if (isCandidateDir || isCandidateName) {
      // Check content for specific patterns
      const content = await readText(path.join(projectPath, file));
      if (!content) continue;

      let type: WorkflowType = 'generic';
      let name = path.basename(file, path.extname(file));

      if (/(?:router|app)\.(?:get|post|put|delete|patch)\(/i.test(content) || /@(?:Get|Post|Put|Delete|Patch)\(/i.test(content)) {
        type = 'api-request';
        name = `${name} API Route`;
      } else if (/(?:on|handle)(?:[A-Z][a-zA-Z0-9]*Event|Click|Submit)/i.test(content) || /addEventListener/i.test(content)) {
        type = 'event-handler';
        name = `${name} Event Handler`;
      }

      // Avoid duplicates
      if (!eps.some(e => e.filePath === file)) {
        eps.push({ filePath: file, name, type });
      }
    }
  }

  return eps;
}
