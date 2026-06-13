// ============================================================================
// Command: why
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { queryGraph } from '../engines/graph/query.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const whyCommand = new Command('why')
  .description('Discover the root cause and rationale behind a decision')
  .argument('<topic>', 'The technology or decision to query (e.g., "postgres", "redis")')
  .action(async (topic) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory || !memory.knowledgeGraph) {
      logger.error('Project memory not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    // Query graph for the topic
    const queryResult = queryGraph(memory.knowledgeGraph, topic, 2);
    const allNodes = [...queryResult.matchedNodes, ...queryResult.relatedNodes];

    // Filter down strictly to decisions
    const decisions = allNodes.filter(n => n.type === 'decision');

    if (decisions.length === 0) {
      logger.error(`Could not find any decisions relating to "${topic}".`);
      process.exit(1);
    }

    console.log(chalk.bold.magenta(`\n🤔 Rationale for: ${topic}\n`));

    decisions.forEach(d => {
      console.log(chalk.bold.cyan(`Decision: ${d.label}`));
      
      if (d.properties?.reason) {
        console.log(chalk.white(`Reason: ${d.properties.reason}`));
      }
      
      // Find what this decision impacts
      const impactEdges = queryResult.edges.filter(e => e.source === d.id && e.relation === 'IMPACTS');
      const impactedNodes = impactEdges.map(e => memory.knowledgeGraph!.nodes.find(n => n.id === e.target)).filter(Boolean);

      const features = impactedNodes.filter(n => n?.type === 'feature');
      if (features.length > 0) {
        console.log(chalk.gray(`\nImpacted Features:`));
        features.forEach(f => console.log(chalk.gray(`  • ${f!.label}`)));
      }

      console.log('\n----------------------------------------\n');
    });
  });
