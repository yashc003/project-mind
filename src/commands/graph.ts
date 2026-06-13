// ============================================================================
// Command: graph
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const graphCommand = new Command('graph')
  .description('Manage and inspect the Knowledge Graph')
  .action((_, command) => {
    command.help();
  });

graphCommand
  .command('stats')
  .description('Output statistics about the current Knowledge Graph')
  .action(async () => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory || !memory.knowledgeGraph) {
      logger.error('Project-Mind graph is not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const { nodes, edges } = memory.knowledgeGraph;

    const counts = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(chalk.bold('Graph Statistics\n'));
    console.log(`Nodes: ${chalk.cyan(nodes.length)}`);
    console.log(`Edges: ${chalk.cyan(edges.length)}\n`);

    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      const label = type.charAt(0).toUpperCase() + type.slice(1) + 's';
      console.log(`${label}: ${chalk.yellow(count)}`);
    });
  });

graphCommand
  .command('show')
  .description('Generate and print the Mermaid graph markdown')
  .option('--focus <target>', 'Target component, feature, or node ID to focus the graph on')
  .action(async (options) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory || !memory.knowledgeGraph) {
      logger.error('Project-Mind graph is not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const { generateMermaidGraph } = await import('../engines/graph/index.js');
    const markdown = generateMermaidGraph(memory.knowledgeGraph, options.focus);
    
    console.log(markdown);
  });
