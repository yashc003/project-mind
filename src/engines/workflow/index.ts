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
    const queue: { file: string; depth: number }[] = [{ file: ep.filePath, depth: 0 }];

    while (queue.length > 0) {
      const { file: current, depth } = queue.shift()!;
      if (visitedFiles.has(current)) continue;
      visitedFiles.add(current);

      const comp = fileToComponent.get(current);
      if (comp && !componentChain.includes(comp)) {
        componentChain.push(comp);
      }

      if (depth < 4) { // Hard cap traversal at depth 4
        const neighbors = adjList.get(current) || [];
        for (const n of neighbors) {
          if (!visitedFiles.has(n)) {
            queue.push({ file: n, depth: depth + 1 });
          }
        }
      }
    }

    if (componentChain.length > 0 || visitedFiles.size > 0) {
      workflows.push({
        id: crypto.randomBytes(4).toString('hex'),
        name: ep.name,
        description: `Triggered via ${path.basename(ep.filePath)}`,
        entryPoint: ep.filePath,
        dependencyScope: 'file',
        sourceFile: path.basename(ep.filePath),
        components: componentChain,
        files: Array.from(visitedFiles),
        confidence: ep.confidence,
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
  confidence: number;
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
      confidence: 80,
    });
  }

  // 2. Search for controllers / routes / handlers
  const candidateDirs = ['routes', 'controllers', 'handlers', 'api', 'pages', 'app'];
  
  for (const file of evidence.sourceCode.fileCategories.source) {
    const dirName = path.basename(path.dirname(file));
    const isCandidateDir = candidateDirs.some(d => dirName.toLowerCase().includes(d));
    const isCandidateName = ['controller', 'route', 'handler', 'page'].some(n => file.toLowerCase().includes(n));

    if (isCandidateDir || isCandidateName) {
      // Check content for specific patterns
      const content = await readText(path.join(projectPath, file));
      if (!content) continue;

      let foundSpecific = false;

      // Extract Express/Generic API Routes
      // e.g. router.get('/users', ...) or app.post('/login', ...)
      const expressRegex = /(?:router|app)\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/gi;
      let match;
      while ((match = expressRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        eps.push({ filePath: file, name: `${method} ${routePath}`, type: 'api-request', confidence: 90 });
        foundSpecific = true;
      }

      // Next.js App Router (route.ts / page.tsx)
      const normalizedPath = file.replace(/\\/g, '/');
      if (normalizedPath.includes('/app/') || normalizedPath.startsWith('app/')) {
         if (normalizedPath.endsWith('route.ts') || normalizedPath.endsWith('route.js')) {
            const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
            for (const m of methods) {
               if (content.includes(`export async function ${m}`) || content.includes(`export function ${m}`)) {
                  // Reconstruct path from file path
                  let routePath = normalizedPath.substring(normalizedPath.indexOf('app/') + 4).replace('/route.ts', '').replace('/route.js', '');
                  routePath = routePath ? `/${routePath}` : '/';
                  eps.push({ filePath: file, name: `${m} ${routePath}`, type: 'api-request', confidence: 90 });
                  foundSpecific = true;
               }
            }
         } else if (normalizedPath.endsWith('page.tsx') || normalizedPath.endsWith('page.jsx')) {
            let routePath = normalizedPath.substring(normalizedPath.indexOf('app/') + 4).replace('/page.tsx', '').replace('/page.jsx', '');
            routePath = routePath ? `/${routePath}` : '/';
            eps.push({ filePath: file, name: `Page View ${routePath}`, type: 'ui-flow', confidence: 85 });
            foundSpecific = true;
         }
      }

      if (!foundSpecific) {
        // Fallback heuristics
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
        if (!eps.some(e => e.filePath === file && e.name === name)) {
          eps.push({ filePath: file, name, type, confidence: 60 });
        }
      }
    }
  }

  return eps;
}
