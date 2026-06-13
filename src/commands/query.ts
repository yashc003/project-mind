// ============================================================================
// Command: query
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { queryGraph, formatQueryResult } from '../engines/graph/query.js';
import logger from '../utils/logger.js';

export const queryCommand = new Command('query')
  .description('Query the Knowledge Graph for a specific topic to fetch targeted context')
  .argument('<topic>', 'The topic to query (e.g., "authentication", "AuthService")')
  .option('-d, --depth <number>', 'Traversal depth', '2')
  .action(async (topic, options) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory || !memory.knowledgeGraph) {
      logger.error('Project-Mind graph is not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const depth = parseInt(options.depth, 10) || 2;
    const result = queryGraph(memory.knowledgeGraph, topic, depth);

    console.log(formatQueryResult(result));
  });
