import * as fs from 'fs/promises';
import { getMemoryFilePaths, loadMemory } from '../memory/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateAuditReport } from '../graph/audit.js';

export function registerResources(server: McpServer, projectPath: string): void {
  const paths = getMemoryFilePaths(projectPath);

  server.resource(
    'summary',
    'project-mind://summary',
    { mimeType: 'application/json' },
    async (uri) => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      const data = {
        projectName: memory.projectName,
        scenario: memory.scenario,
        confidence: memory.confidence,
        frameworks: memory.evidence.buildFiles.frameworks,
        languages: memory.evidence.sourceCode.languages,
      };

      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.resource(
    'architecture',
    'project-mind://architecture',
    { mimeType: 'application/json' },
    async (uri) => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(memory.architecture, null, 2) }],
      };
    }
  );

  server.resource(
    'focus',
    'project-mind://focus',
    { mimeType: 'application/json' },
    async (uri) => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(memory.focusHistory, null, 2) }],
      };
    }
  );

  server.resource(
    'decisions',
    'project-mind://decisions',
    { mimeType: 'application/json' },
    async (uri) => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(memory.decisions, null, 2) }],
      };
    }
  );

  server.resource(
    'graph-summary',
    'project-mind://graph-summary',
    { mimeType: 'application/json' },
    async (uri) => {
      const memory = await loadMemory(projectPath);
      if (!memory || !memory.knowledgeGraph) throw new Error('Memory or graph not initialized');

      const { nodes, edges } = memory.knowledgeGraph;
      
      const degreeMap = new Map<string, number>();
      edges.forEach(edge => {
        degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
        degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
      });

      const nodeMap = new Map<string, any>();
      nodes.forEach(n => nodeMap.set(n.id, n));

      const sortedNodes = Array.from(degreeMap.entries())
        .map(([id, degree]) => ({ node: nodeMap.get(id), degree }))
        .filter(item => item.node !== undefined)
        .sort((a, b) => b.degree - a.degree);

      const godNodes = sortedNodes.slice(0, 10).map(item => ({
        id: item.node.id,
        label: item.node.label,
        type: item.node.type,
        degree: item.degree
      }));

      const typeCounts = nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const nodeNames = nodes.map(n => n.label);

      const summary = {
        stats: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          typeCounts
        },
        godNodes,
        availableNodes: nodeNames
      };

      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.resource(
    'component',
    'project-mind://component/{name}',
    { mimeType: 'application/json', description: 'Detail view of a specific architectural component' },
    async (uri, { name }) => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      if (typeof name !== 'string') {
        throw new Error('Component name is required');
      }

      const component = memory.architecture?.components?.find(
        c => c.name.toLowerCase() === name.toLowerCase()
      );

      if (!component) {
        throw new Error(`Component ${name} not found`);
      }

      // Find any related focus, feature or decision that touches this component
      const decisions = memory.decisions.filter(d => 
        d.impactedComponents?.some(c => c.toLowerCase() === name.toLowerCase())
      );

      const features = memory.features?.filter(f => 
        f.components?.some(c => c.toLowerCase() === name.toLowerCase())
      ) || [];

      const result = {
        ...component,
        relatedDecisions: decisions.map(d => d.title),
        relatedFeatures: features.map(f => f.name)
      };

      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
