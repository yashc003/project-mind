// ============================================================================
// Context Pack Generator Engine
// ============================================================================
// Generates highly concentrated markdown files specifically optimized
// for pasting into LLM context windows.
// ============================================================================

import type { ProjectMemory } from '../../types/index.js';
import { queryGraph } from '../graph/query.js';
import { pluginRegistry } from '../plugin/registry.js';
import type { PackContext } from '../../types/plugin.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export interface PackOptions {
  topic: string;
  isCurrent: boolean;
  level: 'compact' | 'full';
}

export async function generateContextPack(projectPath: string, memory: ProjectMemory, options: PackOptions): Promise<string> {
  if (!memory.knowledgeGraph) {
    throw new Error('Knowledge Graph is required to generate Context Packs. Run `project-mind update` first.');
  }

  // Ensure plugins are loaded
  await pluginRegistry.loadPlugins(projectPath);
  const plugins = pluginRegistry.getPlugins();

  const { topic, isCurrent, level } = options;

  let actualTopic = topic;
  if (isCurrent) {
    if (memory.focusHistory.active) {
      actualTopic = memory.focusHistory.active.feature;
    } else {
      actualTopic = 'Project Overview';
    }
  }

  let queryTerm = actualTopic;
  if (actualTopic.startsWith('component:')) {
    queryTerm = actualTopic.split(':')[1];
    actualTopic = `Component: ${queryTerm}`;
  } else if (actualTopic.startsWith('feature:')) {
    queryTerm = actualTopic.split(':')[1];
    actualTopic = `Feature: ${queryTerm}`;
  }

  // Generate Metadata Header
  let pack = '---\n';
  pack += `generatedAt: ${new Date().toISOString()}\n`;
  pack += `feature: ${actualTopic}\n`;
  pack += `knowledgeVersion: ${memory.version}\n`;
  pack += `focus: ${memory.focusHistory.active?.task || 'None'}\n`;
  pack += '---\n\n';

  pack += `# Context Pack: ${actualTopic}\n\n`;

  // Fetch contextual subgraph
  const queryResult = queryGraph(memory.knowledgeGraph, queryTerm, level === 'full' ? 3 : 1);

  // Focus Section
  if (isCurrent && memory.focusHistory.active) {
    pack += `## Current Active Task\n`;
    pack += `**Task:** ${memory.focusHistory.active.task}\n`;
    pack += `**Status:** ${memory.focusHistory.active.status}\n\n`;
  }

  // Feature Summary
  const featureMatches = queryResult.matchedNodes.filter(n => n.type === 'feature');
  if (featureMatches.length > 0) {
    pack += `## Feature Summary\n`;
    featureMatches.forEach(f => {
      pack += `- **${f.label}**\n`;
    });
    pack += '\n';
  }

  // If level is FULL, dump everything related. If COMPACT, be selective.
  const allNodes = [...queryResult.matchedNodes, ...queryResult.relatedNodes];

  // Decisions
  const decisions = allNodes.filter(n => n.type === 'decision');
  if (decisions.length > 0) {
    pack += `## Related Decisions\n`;
    decisions.forEach(d => {
      pack += `- **${d.label}**`;
      if (level === 'full' && d.properties?.reason) {
        pack += `\n  - Reason: ${d.properties.reason}`;
      }
      pack += '\n';
    });
    pack += '\n';
  }

  // Workflows
  const workflows = allNodes.filter(n => n.type === 'workflow');
  if (workflows.length > 0) {
    pack += `## Active Workflows\n`;
    workflows.forEach(w => {
      pack += `- **${w.label}**\n`;
    });
    pack += '\n';
  }

  // Components & Files
  const components = allNodes.filter(n => n.type === 'component');
  if (components.length > 0) {
    pack += `## Affected Components\n`;
    components.forEach(c => {
      pack += `- ${c.label}\n`;
    });
    pack += '\n';
  }

  if (level === 'full') {
    const files = allNodes.filter(n => n.type === 'file');
    if (files.length > 0) {
      pack += `## Impacted Source Code\n`;
      for (const f of files) {
        pack += `### \`${f.label}\`\n`;
        try {
          const content = await fs.readFile(path.join(projectPath, f.label), 'utf-8');
          // Basic syntax highlighting inference
          const ext = path.extname(f.label).slice(1) || 'text';
          pack += `\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
        } catch (err: any) {
          pack += `*Could not read file: ${err.message}*\n\n`;
        }
      }
      pack += '\n';
    }
  }

  // Recent Changes (Agents)
  const agents = allNodes.filter(n => n.type === 'agent');
  if (agents.length > 0) {
    pack += `## Recent Agent Activity\n`;
    agents.forEach(a => {
      pack += `- Touched by ${a.label}\n`;
    });
    pack += '\n';
  }

  // --- Plugin Extensions ---
  const packContext: PackContext = {
    topic: actualTopic,
    isCurrent,
    level,
    memory,
  };

  for (const plugin of plugins) {
    if (plugin.onPackGeneration && plugin.capabilities.includes('pack')) {
      try {
        const sections = await plugin.onPackGeneration(packContext);
        if (sections && sections.length > 0) {
          sections.forEach(sec => {
            pack += `## ${sec.title}\n`;
            pack += `${sec.content}\n\n`;
          });
        }
      } catch (err: any) {
        // Log but don't fail the whole pack
        console.error(`Plugin ${plugin.name} failed during onPackGeneration: ${err.message}`);
      }
    }
  }

  return pack.trim();
}
