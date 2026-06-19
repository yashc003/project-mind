import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { generateAuditReport } from '../../../src/engines/graph/audit.js';
import type { KnowledgeGraph } from '../../../src/types/index.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn()
}));

describe('Audit Engine', () => {
  const projectPath = '/mock/project/path';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates report for an empty graph', async () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [] };
    const reportPath = await generateAuditReport(graph, projectPath);

    expect(reportPath).toBe(path.join(projectPath, '.project-mind', 'derived', 'GRAPH_REPORT.md'));
    expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(reportPath), { recursive: true });
    
    // Check that writeFile was called with expected content
    expect(fs.writeFile).toHaveBeenCalled();
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(content).toContain('**Nodes:** 0');
    expect(content).toContain('**Edges:** 0');
  });

  it('handles a graph with nodes but no edges (disconnected graph)', async () => {
    const graph: KnowledgeGraph = {
      nodes: [
        { id: 'node_1', label: 'Node 1', type: 'file', properties: {} },
        { id: 'node_2', label: 'Node 2', type: 'function', properties: {} }
      ],
      edges: []
    };
    
    await generateAuditReport(graph, projectPath);
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    
    expect(content).toContain('**Nodes:** 2');
    expect(content).toContain('**Edges:** 0');
    expect(content).toContain('**file:** 1');
    expect(content).toContain('**function:** 1');
    
    // There should be no god nodes because no degree > 0
    // Actually, degree logic in audit.ts: map only contains nodes that have edges.
    // If no edges, degreeMap is empty, so godNodes is empty.
    expect(content).not.toContain('1. **Node 1**');
  });

  it('correctly identifies and limits God Nodes to top 5', async () => {
    // We create a central node (node_0) connected to 10 others
    const graph: KnowledgeGraph = {
      nodes: Array.from({ length: 11 }).map((_, i) => ({
        id: `node_${i}`,
        label: `Node ${i}`,
        type: 'file',
        properties: {}
      })),
      edges: Array.from({ length: 10 }).map((_, i) => ({
        source: 'node_0',
        target: `node_${i + 1}`,
        relation: 'DEPENDS_ON',
        provenance: 'TEST',
        confidence: 1.0
      }))
    };
    
    // Add one extra edge to node_1 so it becomes 2nd place
    graph.edges.push({
      source: 'node_1',
      target: 'node_2',
      relation: 'DEPENDS_ON',
      provenance: 'TEST',
      confidence: 1.0
    });

    await generateAuditReport(graph, projectPath);
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    
    // node_0 should have 10 connections
    expect(content).toContain('1. **Node 0** (file) - 10 connections');
    // node_1 should have 2 connections (1 from node_0, 1 to node_2)
    expect(content).toContain('2. **Node 1** (file) - 2 connections');
    
    // Only up to 5 elements should be listed
    expect(content).toContain('5. **Node');
    expect(content).not.toContain('6. **Node');
  });

  it('handles edges pointing to missing nodes gracefully', async () => {
    const graph: KnowledgeGraph = {
      nodes: [
        { id: 'node_1', label: 'Node 1', type: 'file', properties: {} }
      ],
      edges: [
        { source: 'node_1', target: 'missing_node', relation: 'DEPENDS_ON', provenance: 'TEST', confidence: 1.0 }
      ]
    };
    
    await generateAuditReport(graph, projectPath);
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    
    // missing_node has degree 1, node_1 has degree 1. 
    // But missing_node is NOT in nodeMap, so it should be filtered out by `item.node !== undefined`
    expect(content).toContain('**Node 1**');
    expect(content).not.toContain('missing_node');
  });
});
