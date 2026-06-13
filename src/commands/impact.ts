// ============================================================================
// Command: impact
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { analyzeImpact, formatImpactResult } from '../engines/graph/impact.js';
import logger from '../utils/logger.js';

export const impactCommand = new Command('impact')
  .description('Perform backward traversal to see what relies on a Component or File')
  .argument('<target>', 'The target file or component to analyze')
  .action(async (target) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory || !memory.knowledgeGraph) {
      logger.error('Project-Mind graph is not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const result = analyzeImpact(memory.knowledgeGraph, target);
    console.log(formatImpactResult(result));
  });
