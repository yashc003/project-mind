// ============================================================================
// Knowledge Graph Engine (v0.4)
// ============================================================================

import type { ProjectMemory, KnowledgeGraph, GraphNode, GraphEdge, AgentInteraction } from '../../types/index.js';
import { pluginRegistry } from '../plugin/registry.js';
import logger from '../../utils/logger.js';

export async function buildKnowledgeGraph(memory: ProjectMemory, agentHistory: AgentInteraction[], projectPath: string): Promise<{ graph: KnowledgeGraph, markdown: string }> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const addNode = (node: GraphNode) => {
    if (!nodes.some(n => n.id === node.id)) {
      nodes.push(node);
    }
  };

  const addEdge = (edge: GraphEdge) => {
    if (!edges.some(e => e.source === edge.source && e.target === edge.target && e.relation === edge.relation)) {
      edges.push(edge);
    }
  };

  // 1. Components & Files
  memory.architecture.components.forEach(comp => {
    const compId = `comp_${comp.name}`;
    addNode({ id: compId, type: 'component', label: comp.name, properties: { type: comp.type } });

    comp.files.forEach(file => {
      const fileId = `file_${file}`;
      addNode({ id: fileId, type: 'file', label: file });
      addEdge({ source: compId, target: fileId, relation: 'CONTAINS' });
    });
  });

  // 2. Features
  memory.features?.forEach(feat => {
    const featId = `feat_${feat.name}`;
    addNode({ id: featId, type: 'feature', label: feat.name });

    feat.components.forEach(compName => {
      addEdge({ source: `comp_${compName}`, target: featId, relation: 'BELONGS_TO' });
    });

    feat.files?.forEach(file => {
      const fileId = `file_${file}`;
      addNode({ id: fileId, type: 'file', label: file });
      addEdge({ source: fileId, target: featId, relation: 'BELONGS_TO' });
    });
  });

  // 3. Workflows
  memory.workflows?.forEach(wf => {
    const wfId = `wf_${wf.name}`;
    addNode({ id: wfId, type: 'workflow', label: wf.name, properties: { type: wf.type } });

    wf.components.forEach(compName => {
      addEdge({ source: wfId, target: `comp_${compName}`, relation: 'IMPLEMENTS' });
    });

    wf.files?.forEach(file => {
      const fileId = `file_${file}`;
      addNode({ id: fileId, type: 'file', label: file });
      addEdge({ source: wfId, target: fileId, relation: 'IMPLEMENTS' });
    });
  });

  // 4. Decisions
  memory.decisions.forEach(dec => {
    const decId = `dec_${dec.id}`;
    addNode({ id: decId, type: 'decision', label: dec.title, properties: { reason: dec.reason, confidence: dec.confidence } });

    dec.impactedFeatures?.forEach(featName => {
      addEdge({ source: decId, target: `feat_${featName}`, relation: 'IMPACTS' });
    });
    
    dec.impactedComponents?.forEach(compName => {
      addEdge({ source: decId, target: `comp_${compName}`, relation: 'IMPACTS' });
    });
  });

  // 5. Focus History
  [...memory.focusHistory.history, memory.focusHistory.active].forEach(focus => {
    if (!focus) return;
    const focusId = `focus_${focus.id}`;
    addNode({ id: focusId, type: 'focus', label: focus.task, properties: { status: focus.status } });

    addEdge({ source: focusId, target: `feat_${focus.feature}`, relation: 'IMPACTS' });
  });

  // 6. Agent History
  agentHistory.forEach(interaction => {
    const agentId = `agent_${interaction.agent}`;
    addNode({ id: agentId, type: 'agent', label: interaction.agent });

    // Try to link interaction to an entity
    let relation: GraphEdge['relation'] = 'UPDATED';
    if (interaction.action.includes('start')) relation = 'CREATED';
    if (interaction.action.includes('complete')) relation = 'MODIFIED';

    if (interaction.details) {
      const detailsLower = interaction.details.toLowerCase();
      // Heuristic linking
      const possibleTargets = [...nodes].filter(n => 
        n.type !== 'agent' && n.type !== 'file' && detailsLower.includes(n.label.toLowerCase())
      );

      possibleTargets.forEach(target => {
        addEdge({ source: agentId, target: target.id, relation });
      });
    }
  });

  const graph: KnowledgeGraph = {
    nodes,
    edges,
  };

  // --- Plugin Extensions ---
  await pluginRegistry.loadPlugins(projectPath);
  const plugins = pluginRegistry.getPlugins();

  for (const plugin of plugins) {
    if (plugin.onGraphGenerated && plugin.capabilities.includes('graph')) {
      try {
        await plugin.onGraphGenerated(graph);
      } catch (err: any) {
        logger.error(`Plugin ${plugin.name} failed during onGraphGenerated: ${err.message}`);
      }
    }
  }

  // Generate Mermaid markdown
  const markdown = generateMermaidGraph(graph);
  
  return {
    graph,
    markdown,
  };
}

export function generateMermaidGraph(graph: KnowledgeGraph, focusTarget?: string): string {
  let nodesToRender = graph.nodes;
  let edgesToRender = graph.edges;

  if (focusTarget) {
    // Find the focus node
    const targetNode = graph.nodes.find(n => n.label.toLowerCase() === focusTarget.toLowerCase() || n.id.toLowerCase() === focusTarget.toLowerCase());
    if (targetNode) {
      // Find all connected edges
      edgesToRender = graph.edges.filter(e => e.source === targetNode.id || e.target === targetNode.id);
      
      // Find all connected nodes
      const connectedNodeIds = new Set<string>([targetNode.id]);
      edgesToRender.forEach(e => {
        connectedNodeIds.add(e.source);
        connectedNodeIds.add(e.target);
      });
      nodesToRender = graph.nodes.filter(n => connectedNodeIds.has(n.id));
    } else {
      logger.warn(`Focus target '${focusTarget}' not found in the graph. Rendering full graph.`);
    }
  }

  let mermaid = '```mermaid\ngraph LR;\n';

  // Styles
  mermaid += '  classDef component fill:#f9f,stroke:#333,stroke-width:2px;\n';
  mermaid += '  classDef feature fill:#bbf,stroke:#333,stroke-width:2px;\n';
  mermaid += '  classDef workflow fill:#bfb,stroke:#333,stroke-width:2px;\n';
  mermaid += '  classDef decision fill:#fbf,stroke:#333,stroke-width:2px;\n';
  mermaid += '  classDef agent fill:#ff9,stroke:#333,stroke-width:2px;\n\n';

  nodesToRender.forEach(node => {
    const safeLabel = node.label.replace(/["']/g, '');
    let shape = `["${safeLabel}"]`;
    if (node.type === 'decision') shape = `{"${safeLabel}"}`;
    if (node.type === 'agent') shape = `(("${safeLabel}"))`;

    mermaid += `  ${node.id}${shape}:::${node.type};\n`;
  });

  mermaid += '\n';

  edgesToRender.forEach(edge => {
    if (edge.relation === 'CONTAINS') return; // Skip files in mermaid to reduce clutter
    mermaid += `  ${edge.source} -->|${edge.relation}| ${edge.target};\n`;
  });

  mermaid += '```\n';
  return mermaid;
}
