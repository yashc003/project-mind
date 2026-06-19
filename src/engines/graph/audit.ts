import * as fs from 'fs/promises';
import * as path from 'path';
import type { KnowledgeGraph, GraphNode } from '../../types/index.js';

export async function generateAuditReport(graph: KnowledgeGraph, projectPath: string): Promise<string> {
  const degreeMap = new Map<string, number>();
  
  graph.edges.forEach(edge => {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
  });

  const nodeMap = new Map<string, GraphNode>();
  graph.nodes.forEach(n => nodeMap.set(n.id, n));

  const sortedNodes = Array.from(degreeMap.entries())
    .map(([id, degree]) => ({ node: nodeMap.get(id), degree }))
    .filter(item => item.node !== undefined)
    .sort((a, b) => b.degree - a.degree);

  const godNodes = sortedNodes.slice(0, 5);

  const typeCounts = graph.nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let report = `# Project-Mind Knowledge Graph Audit\n\n`;
  report += `This report provides an AI-readable summary of the codebase's semantic structure.\n\n`;
  
  report += `## Graph Topology\n`;
  report += `- **Nodes:** ${graph.nodes.length}\n`;
  report += `- **Edges:** ${graph.edges.length}\n\n`;
  
  report += `### Node Types\n`;
  for (const [type, count] of Object.entries(typeCounts)) {
    report += `- **${type}:** ${count}\n`;
  }
  
  report += `\n## God Nodes (Architectural Bottlenecks)\n`;
  report += `These nodes have the highest degree centrality (most connections) in the graph. They represent core dependencies or massive architectural hubs.\n\n`;
  
  godNodes.forEach((item, index) => {
    report += `${index + 1}. **${item.node?.label || item.node?.id}** (${item.node?.type}) - ${item.degree} connections\n`;
  });

  const reportPath = path.join(projectPath, '.project-mind', 'derived', 'GRAPH_REPORT.md');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');

  return reportPath;
}
