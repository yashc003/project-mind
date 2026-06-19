import { queryGraph } from './query.js';
import { pluginRegistry } from '../plugin/registry.js';
import type { ProjectMemory, GraphNode } from '../../types/index.js';
import type { ExplainContext } from '../../types/plugin.js';
import logger from '../../utils/logger.js';

export interface ExplainResult {
  node: GraphNode;
  signatures: Array<{
    kind: string;
    name: string;
    parameters?: string[];
    returnType?: string;
    modifiers?: string[];
    raw?: string;
  }>;
  decisions: Array<{ label: string; reason?: string }>;
  workflows: string[];
  components: string[];
  agents: string[];
  pluginSections: Array<{ pluginName: string; title: string; content: string }>;
}

export async function explainNode(
  memory: ProjectMemory,
  projectPath: string,
  topic: string
): Promise<ExplainResult | null> {
  if (!memory.knowledgeGraph) {
    return null;
  }

  const queryResult = queryGraph(memory.knowledgeGraph, topic, 2);

  if (queryResult.matchedNodes.length === 0) {
    return null;
  }

  const allNodes = [...queryResult.matchedNodes, ...queryResult.relatedNodes];
  const primaryNode = queryResult.matchedNodes[0];

  const result: ExplainResult = {
    node: primaryNode,
    signatures: [],
    decisions: [],
    workflows: [],
    components: [],
    agents: [],
    pluginSections: [],
  };

  if (primaryNode.properties?.signatures && Array.isArray(primaryNode.properties.signatures)) {
    result.signatures = primaryNode.properties.signatures;
  }

  const decisions = allNodes.filter(n => n.type === 'decision');
  result.decisions = decisions.map(d => ({
    label: d.label,
    reason: d.properties?.reason,
  }));

  const workflows = allNodes.filter(n => n.type === 'workflow' && n.id !== primaryNode.id);
  result.workflows = workflows.map(w => w.label);

  const components = allNodes.filter(n => n.type === 'component' && n.id !== primaryNode.id);
  result.components = components.map(c => c.label);

  const agents = allNodes.filter(n => n.type === 'agent');
  result.agents = agents.map(a => a.label);

  // Plugins
  await pluginRegistry.loadPlugins(projectPath);
  const plugins = pluginRegistry.getPlugins();

  const explainContext: ExplainContext = {
    topic,
    node: primaryNode,
    memory,
  };

  for (const plugin of plugins) {
    if (plugin.onExplain && plugin.capabilities.includes('explain')) {
      try {
        const sections = await plugin.onExplain(explainContext);
        if (sections && sections.length > 0) {
          sections.forEach(sec => {
            result.pluginSections.push({
              pluginName: plugin.name,
              title: sec.title,
              content: sec.content,
            });
          });
        }
      } catch (err: any) {
        logger.error(`Plugin ${plugin.name} failed during onExplain: ${err.message}`);
      }
    }
  }

  return result;
}
