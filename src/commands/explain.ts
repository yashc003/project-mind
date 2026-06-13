// ============================================================================
// Command: explain
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { queryGraph } from '../engines/graph/query.js';
import { pluginRegistry } from '../engines/plugin/registry.js';
import type { ExplainContext } from '../types/plugin.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const explainCommand = new Command('explain')
  .description('Explain a feature, workflow, or component and its current context')
  .argument('<topic>', 'The topic to explain (e.g., "authentication")')
  .action(async (topic) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory || !memory.knowledgeGraph) {
      logger.error('Project memory not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const queryResult = queryGraph(memory.knowledgeGraph, topic, 2);

    if (queryResult.matchedNodes.length === 0) {
      logger.error(`Could not find any knowledge regarding "${topic}".`);
      process.exit(1);
    }

    const allNodes = [...queryResult.matchedNodes, ...queryResult.relatedNodes];
    
    const primaryNode = queryResult.matchedNodes[0];
    console.log(chalk.bold.magenta(`\n🧠 Explanation: ${primaryNode.label} (${primaryNode.type})\n`));

    // Decisions
    const decisions = allNodes.filter(n => n.type === 'decision');
    if (decisions.length > 0) {
      console.log(chalk.bold.cyan('Related Decisions:'));
      decisions.forEach(d => {
        console.log(`  • ${d.label}`);
        if (d.properties?.reason) console.log(chalk.gray(`    Reason: ${d.properties.reason}`));
      });
      console.log();
    }

    // Workflows
    const workflows = allNodes.filter(n => n.type === 'workflow' && n.id !== primaryNode.id);
    if (workflows.length > 0) {
      console.log(chalk.bold.cyan('Related Workflows:'));
      workflows.forEach(w => console.log(`  • ${w.label}`));
      console.log();
    }

    // Components
    const components = allNodes.filter(n => n.type === 'component' && n.id !== primaryNode.id);
    if (components.length > 0) {
      console.log(chalk.bold.cyan('Affected Components:'));
      components.forEach(c => console.log(`  • ${c.label}`));
      console.log();
    }

    // Agents
    const agents = allNodes.filter(n => n.type === 'agent');
    if (agents.length > 0) {
      console.log(chalk.bold.cyan('Recent Activity:'));
      agents.forEach(a => console.log(`  • Touched by ${a.label}`));
      console.log();
    }

    // --- Plugin Extensions ---
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
            console.log(chalk.bold.blue(`${plugin.name} Highlights:`));
            sections.forEach(sec => {
              console.log(chalk.bold(`  ${sec.title}`));
              const lines = sec.content.split('\n');
              lines.forEach(l => console.log(`    ${l}`));
            });
            console.log();
          }
        } catch (err: any) {
          logger.error(`Plugin ${plugin.name} failed during onExplain: ${err.message}`);
        }
      }
    }
  });
