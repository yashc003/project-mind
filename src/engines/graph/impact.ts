// ============================================================================
// Graph Impact Engine (Backward Traversal)
// ============================================================================

import type { KnowledgeGraph, GraphNode } from '../../types/index.js';

export interface ImpactResult {
  target: string;
  features: string[];
  workflows: string[];
  decisions: string[];
  components: string[];
  files: string[];
}

export function analyzeImpact(graph: KnowledgeGraph, targetLabel: string): ImpactResult {
  const lowerTarget = targetLabel.toLowerCase();
  
  // Find the exact node or closest match
  const startNode = graph.nodes.find(n => n.label.toLowerCase() === lowerTarget || n.id.toLowerCase().includes(lowerTarget));

  if (!startNode) {
    return { target: targetLabel, features: [], workflows: [], decisions: [], components: [], files: [] };
  }

  // Backward traversal (Find things that depend on or impact this node)
  // For impact, we look at incoming edges. e.g. Workflow IMPLEMENTS Component, Component CONTAINS File.
  // If we modify File, we traverse backwards: File <-[CONTAINS]- Component <-[IMPLEMENTS]- Workflow.

  const impactedNodeIds = new Set<string>();
  let currentFrontier = [startNode.id];

  // We'll traverse all the way up (unbounded depth) to find all top-level impacts
  while (currentFrontier.length > 0) {
    const nextFrontier: string[] = [];

    for (const nodeId of currentFrontier) {
      // Find edges where this node is the TARGET (meaning something points to it and depends on it)
      // e.g. "Workflow IMPLEMENTS Component" -> edge.source = Workflow, edge.target = Component
      // If we change Component, Workflow is impacted.
      const incomingEdges = graph.edges.filter(e => e.target === nodeId);
      
      for (const edge of incomingEdges) {
        if (!impactedNodeIds.has(edge.source)) {
          impactedNodeIds.add(edge.source);
          nextFrontier.push(edge.source);
        }
      }
      
      // Also consider IMPACTS edges where the modified node is the TARGET. Wait, "Decision IMPACTS Feature". If we change Feature, Decision might need revisit? Actually Decision is context. We'll trace both directions for safety in Impact Analysis.
      const outgoingEdges = graph.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
         // Things this node impacts directly
         if (edge.relation === 'IMPACTS' || edge.relation === 'IMPLEMENTS') {
           if (!impactedNodeIds.has(edge.target)) {
             impactedNodeIds.add(edge.target);
             nextFrontier.push(edge.target);
           }
         }
      }
    }
    
    currentFrontier = nextFrontier;
  }

  const result: ImpactResult = {
    target: startNode.label,
    features: [],
    workflows: [],
    decisions: [],
    components: [],
    files: []
  };

  impactedNodeIds.forEach(id => {
    const node = graph.nodes.find(n => n.id === id);
    if (!node) return;

    if (node.type === 'feature') result.features.push(node.label);
    if (node.type === 'workflow') result.workflows.push(node.label);
    if (node.type === 'decision') result.decisions.push(node.label);
    if (node.type === 'component') result.components.push(node.label);
    if (node.type === 'file') result.files.push(node.label);
  });

  return result;
}

export function formatImpactResult(result: ImpactResult): string {
  if (result.features.length === 0 && result.components.length === 0 && result.files.length === 0) {
    return `Could not determine impact for "${result.target}".`;
  }

  let output = `${result.target} impacts:\n\n`;

  if (result.features.length > 0) {
    output += `Features:\n${result.features.map(f => `- ${f}`).join('\n')}\n\n`;
  }
  
  if (result.workflows.length > 0) {
    output += `Workflows:\n${result.workflows.map(w => `- ${w}`).join('\n')}\n\n`;
  }
  
  if (result.decisions.length > 0) {
    output += `Decisions:\n${result.decisions.map(d => `- ${d}`).join('\n')}\n\n`;
  }

  if (result.components.length > 0) {
    output += `Components:\n${result.components.map(c => `- ${c}`).join('\n')}\n\n`;
  }
  
  if (result.files.length > 0) {
    output += `Files:\n${result.files.map(f => `- ${f}`).join('\n')}\n`;
  }

  return output;
}
