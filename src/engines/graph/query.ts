// ============================================================================
// Graph Query Engine (Forward Traversal)
// ============================================================================

import type { KnowledgeGraph, GraphNode, GraphEdge } from '../../types/index.js';

export interface GraphNodeWithDepth {
  node: GraphNode;
  depth: number;
}

export interface QueryResult {
  topic: string;
  matchedNodes: GraphNode[];
  relatedNodes: GraphNode[];
  edges: GraphEdge[];
  nodesWithDepth: GraphNodeWithDepth[];
}

export function queryGraph(graph: KnowledgeGraph, topic: string, depth: number = 2): QueryResult {
  const lowerTopic = topic.toLowerCase();
  
  // Find initial matches with relevance scoring
  const scoredNodes: { node: GraphNode; score: number }[] = [];

  for (const n of graph.nodes) {
    const labelLower = n.label.toLowerCase();
    const typeLower = n.type.toLowerCase();
    const idLower = n.id.toLowerCase();
    let score = 0;

    if (labelLower === lowerTopic) {
      score = 100;
    } else if (labelLower.startsWith(lowerTopic)) {
      score = 80;
    } else if (new RegExp(`\\b${lowerTopic}\\b`, 'i').test(n.label)) {
      score = 60;
    } else if (labelLower.includes(lowerTopic)) {
      score = 50;
    } else if (typeLower === lowerTopic) {
      score = 45;
    } else if (idLower.includes(lowerTopic)) {
      score = 40;
    } else if (n.properties && JSON.stringify(n.properties).toLowerCase().includes(lowerTopic)) {
      score = 20;
    }

    if (score > 0) {
      scoredNodes.push({ node: n, score });
    }
  }

  scoredNodes.sort((a, b) => b.score - a.score);
  const matchedNodes = scoredNodes.map(sn => sn.node);

  if (matchedNodes.length === 0) {
    return { topic, matchedNodes: [], relatedNodes: [], edges: [], nodesWithDepth: [] };
  }

  const visitedNodes = new Set<string>(matchedNodes.map(n => n.id));
  const resultEdges = new Set<GraphEdge>();
  
  const nodesWithDepth: GraphNodeWithDepth[] = matchedNodes.map(node => ({ node, depth: 0 }));

  let currentFrontier = [...matchedNodes];

  for (let i = 0; i < depth; i++) {
    const nextFrontier: GraphNode[] = [];
    const currentDepth = i + 1;

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
            nodesWithDepth.push({ node: neighborNode, depth: currentDepth });
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
    edges: Array.from(resultEdges),
    nodesWithDepth
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
    if (n.properties) {
      if (n.properties.type) output += `  - Type: ${n.properties.type}\n`;
      if (n.properties.language) output += `  - Language: ${n.properties.language}\n`;
      if (n.properties.confidence) output += `  - Confidence: ${n.properties.confidence}%\n`;
    }
    
    // Find related files for components/features
    const relatedFiles = result.edges
      .filter(e => e.source === n.id && e.relation === 'CONTAINS' && e.target.startsWith('file_'))
      .map(e => e.target.replace('file_', ''));
      
    if (relatedFiles.length > 0) {
      output += `  - Files: ${relatedFiles.join(', ')}\n`;
    }
  });

  output += `\n### Related Context\n`;
  
  const grouped = result.relatedNodes.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {} as Record<string, GraphNode[]>);

  for (const [type, nodes] of Object.entries(grouped)) {
    output += `\n#### ${type.toUpperCase()}s\n`;
    nodes.forEach(n => {
      // Find how it's connected to the direct matches
      const connections = result.edges.filter(e => 
        (e.source === n.id && result.matchedNodes.some(m => m.id === e.target)) ||
        (e.target === n.id && result.matchedNodes.some(m => m.id === e.source))
      );
      
      const connStrings = connections.map(c => {
        const otherId = c.source === n.id ? c.target : c.source;
        const otherNode = result.matchedNodes.find(m => m.id === otherId);
        const otherLabel = otherNode ? otherNode.label : otherId;
        return c.source === n.id ? `-[${c.relation}]-> ${otherLabel}` : `<-[${c.relation}]- ${otherLabel}`;
      });

      const connText = connStrings.length > 0 ? ` (${connStrings.join(', ')})` : '';
      output += `- ${n.label}${connText}\n`;
    });
  }

  return output;
}
