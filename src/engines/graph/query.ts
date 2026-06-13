// ============================================================================
// Graph Query Engine (Forward Traversal)
// ============================================================================

import type { KnowledgeGraph, GraphNode, GraphEdge } from '../../types/index.js';

export interface QueryResult {
  topic: string;
  matchedNodes: GraphNode[];
  relatedNodes: GraphNode[];
  edges: GraphEdge[];
}

export function queryGraph(graph: KnowledgeGraph, topic: string, depth: number = 2): QueryResult {
  const lowerTopic = topic.toLowerCase();
  
  // Find initial matches
  const matchedNodes = graph.nodes.filter(n => 
    n.label.toLowerCase().includes(lowerTopic) ||
    n.type.toLowerCase().includes(lowerTopic) ||
    n.id.toLowerCase().includes(lowerTopic)
  );

  if (matchedNodes.length === 0) {
    return { topic, matchedNodes: [], relatedNodes: [], edges: [] };
  }

  const visitedNodes = new Set<string>(matchedNodes.map(n => n.id));
  const resultEdges = new Set<GraphEdge>();
  
  let currentFrontier = [...matchedNodes];

  for (let i = 0; i < depth; i++) {
    const nextFrontier: GraphNode[] = [];

    for (const node of currentFrontier) {
      // Find all edges where this node is source or target
      const connectedEdges = graph.edges.filter(e => e.source === node.id || e.target === node.id);
      
      for (const edge of connectedEdges) {
        resultEdges.add(edge);
        
        const neighborId = edge.source === node.id ? edge.target : edge.source;
        if (!visitedNodes.has(neighborId)) {
          visitedNodes.add(neighborId);
          const neighborNode = graph.nodes.find(n => n.id === neighborId);
          if (neighborNode) {
            nextFrontier.push(neighborNode);
          }
        }
      }
    }
    
    currentFrontier = nextFrontier;
  }

  const relatedNodes = Array.from(visitedNodes)
    .filter(id => !matchedNodes.some(m => m.id === id))
    .map(id => graph.nodes.find(n => n.id === id)!)
    .filter(Boolean);

  return {
    topic,
    matchedNodes,
    relatedNodes,
    edges: Array.from(resultEdges)
  };
}

export function formatQueryResult(result: QueryResult): string {
  if (result.matchedNodes.length === 0) {
    return `No nodes matched the topic "${result.topic}".`;
  }

  let output = `## Query Context: ${result.topic}\n\n`;
  
  output += `### Direct Matches (${result.matchedNodes.length})\n`;
  result.matchedNodes.forEach(n => {
    output += `- **[${n.type.toUpperCase()}]** ${n.label}\n`;
  });

  output += `\n### Related Context (Depth 2)\n`;
  
  const grouped = result.relatedNodes.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {} as Record<string, GraphNode[]>);

  for (const [type, nodes] of Object.entries(grouped)) {
    output += `\n#### ${type.toUpperCase()}s\n`;
    nodes.forEach(n => {
      output += `- ${n.label}\n`;
    });
  }

  return output;
}
