// ============================================================================
// Knowledge Graph Engine (v0.4)
// ============================================================================

import type { ProjectMemory, KnowledgeGraph, GraphNode, GraphEdge, AgentInteraction, SemanticEntity } from '../../types/index.js';
import { pluginRegistry } from '../plugin/registry.js';
import logger from '../../utils/logger.js';
import { extractRationale } from './rationale.js';

export async function buildKnowledgeGraph(memory: ProjectMemory, agentHistory: AgentInteraction[], projectPath: string, semantics?: SemanticEntity[], rationale?: { nodes: GraphNode[], edges: GraphEdge[] }): Promise<{ graph: KnowledgeGraph, markdown: string }> {
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

  // 7. Semantic Entities (AST Phase 4)
  if (semantics) {
    semantics.forEach(entity => {
      addNode({
        id: entity.id,
        type: entity.type,
        label: entity.name,
        properties: {
          language: entity.language,
          confidence: entity.confidence,
          source: entity.source || 'ast',
          isExported: entity.isExported,
          signatures: entity.signatures,
          ...entity.metadata,
        }
      });
      
      const fileId = `file_${entity.file}`;
      addNode({ id: fileId, type: 'file', label: entity.file });
      addEdge({ source: fileId, target: entity.id, relation: 'CONTAINS' });

      // If uses are added later, connect them
      entity.uses?.forEach(usedId => {
        addEdge({ source: entity.id, target: usedId, relation: 'USES' });
      });
      entity.extends?.forEach(extendedId => {
        addEdge({ source: entity.id, target: extendedId, relation: 'EXTENDS' });
      });
      entity.implements?.forEach(implementedId => {
        addEdge({ source: entity.id, target: implementedId, relation: 'IMPLEMENTS' });
      });
      entity.decorates?.forEach(decoratedId => {
        addEdge({ source: entity.id, target: decoratedId, relation: 'DECORATES' });
      });
      entity.imports?.forEach(importId => {
        addEdge({ source: entity.id, target: importId, relation: 'IMPORTS' });
      });
    });
  }

  // 8. Rationale Nodes (Phase 5)
  // Collect all unique source files from evidence
  const allFiles = memory.evidence?.sourceCode?.fileCategories?.source || [];
  
  const rationaleData = rationale || await extractRationale(projectPath, allFiles);
  rationaleData.nodes.forEach(addNode);
  rationaleData.edges.forEach(addEdge);

  const graph: KnowledgeGraph = {
    version: memory.knowledgeGraph?.version || '2.0',
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

  // Auto-focus if graph is too large and no focus is provided
  if (!focusTarget && nodesToRender.length > 50) {
    const degreeMap = new Map<string, number>();
    edgesToRender.forEach(e => {
      degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
    });
    
    let maxDegree = 0;
    let mostConnectedNodeId = nodesToRender[0]?.id;
    for (const [nodeId, degree] of degreeMap.entries()) {
      if (degree > maxDegree) {
        maxDegree = degree;
        mostConnectedNodeId = nodeId;
      }
    }
    
    if (mostConnectedNodeId) {
      logger.warn(`Graph has >50 nodes. Auto-focusing on most connected node: ${mostConnectedNodeId}`);
      const targetNode = graph.nodes.find(n => n.id === mostConnectedNodeId);
      if (targetNode) {
        focusTarget = targetNode.label;
      }
    }
  }

  if (focusTarget) {
    // Find the focus node
    const targetNode = graph.nodes.find(n => n.label.toLowerCase() === focusTarget!.toLowerCase() || n.id.toLowerCase() === focusTarget!.toLowerCase());
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
  mermaid += '  classDef agent fill:#ff9,stroke:#333,stroke-width:2px;\n';
  mermaid += '  classDef file fill:#eee,stroke:#999,stroke-width:1px;\n\n';

  // Group nodes into subgraphs
  const groups: Record<string, typeof nodesToRender> = {
    Components: [],
    Features: [],
    Workflows: [],
    Decisions: [],
    Agents: [],
    Files: [],
    Semantic: [],
    Other: []
  };

  nodesToRender.forEach(node => {
    if (node.type === 'component') groups.Components.push(node);
    else if (node.type === 'feature') groups.Features.push(node);
    else if (node.type === 'workflow') groups.Workflows.push(node);
    else if (node.type === 'decision') groups.Decisions.push(node);
    else if (node.type === 'agent') groups.Agents.push(node);
    else if (node.type === 'file') groups.Files.push(node);
    else if (['class', 'interface', 'function', 'hook', 'controller', 'service', 'repository', 'model', 'enum', 'type_alias', 'generic'].includes(node.type)) {
      groups.Semantic.push(node);
    } else {
      groups.Other.push(node);
    }
  });

  for (const [groupName, nodes] of Object.entries(groups)) {
    if (nodes.length > 0) {
      mermaid += `  subgraph ${groupName}\n`;
      nodes.forEach(node => {
        const safeLabel = node.label.replace(/["']/g, '');
        let shape = `["${safeLabel}"]`; // default box
        
        if (node.type === 'decision') shape = `{"${safeLabel}"}`;
        else if (node.type === 'feature') shape = `(["${safeLabel}"])`;
        else if (node.type === 'workflow') shape = `[["${safeLabel}"]]`;
        else if (node.type === 'agent') shape = `(("${safeLabel}"))`;
        else if (node.type === 'file') shape = `[/"${safeLabel}"/]`;

        mermaid += `    ${node.id}${shape}:::${node.type};\n`;
      });
      mermaid += `  end\n\n`;
    }
  }

  // Filter and format edges
  edgesToRender.forEach(edge => {
    // Only skip CONTAINS edges if both source and target are files (which is rare/impossible, but follows the logic)
    if (edge.relation === 'CONTAINS') {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);
      if (sourceNode?.type === 'file' && targetNode?.type === 'file') {
        return;
      }
    }

    let arrow = '-->';
    if (edge.relation === 'EXTENDS') arrow = '-.->';
    else if (edge.relation === 'IMPLEMENTS') arrow = '==>';
    else if (edge.relation === 'IMPORTS' || edge.relation === 'USES') arrow = '-->';

    mermaid += `  ${edge.source} ${arrow}|${edge.relation}| ${edge.target};\n`;
  });

  // Add Legend
  mermaid += '\n  %% Legend\n';
  mermaid += '  subgraph Legend\n';
  mermaid += '    leg_component["Component"]:::component\n';
  mermaid += '    leg_feature(["Feature"]):::feature\n';
  mermaid += '    leg_workflow[["Workflow"]]:::workflow\n';
  mermaid += '    leg_decision{"Decision"}:::decision\n';
  mermaid += '    leg_agent(("Agent")):::agent\n';
  mermaid += '  end\n';

  mermaid += '```\n';
  return mermaid;
}

export function generateAsciiGraph(graph: KnowledgeGraph, focusTarget?: string): string {
  let nodesToRender = graph.nodes;
  let edgesToRender = graph.edges;

  if (focusTarget) {
    const targetNode = graph.nodes.find(n => n.label.toLowerCase() === focusTarget.toLowerCase() || n.id.toLowerCase() === focusTarget.toLowerCase());
    if (targetNode) {
      edgesToRender = graph.edges.filter(e => e.source === targetNode.id || e.target === targetNode.id);
      const connectedNodeIds = new Set<string>([targetNode.id]);
      edgesToRender.forEach(e => {
        connectedNodeIds.add(e.source);
        connectedNodeIds.add(e.target);
      });
      nodesToRender = graph.nodes.filter(n => connectedNodeIds.has(n.id));
    }
  }

  let ascii = 'Knowledge Graph\n================\n\n';

  const groups = nodesToRender.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {} as Record<string, typeof nodesToRender>);

  for (const [type, nodes] of Object.entries(groups)) {
    ascii += `[${type.toUpperCase()}]\n`;
    nodes.forEach(node => {
      ascii += `  * ${node.label} (${node.id})\n`;
      const connectedEdges = edgesToRender.filter(e => e.source === node.id);
      connectedEdges.forEach(edge => {
        const target = graph.nodes.find(n => n.id === edge.target);
        if (target) {
          ascii += `      --[${edge.relation}]-> ${target.label}\n`;
        }
      });
    });
    ascii += '\n';
  }

  return ascii;
}
