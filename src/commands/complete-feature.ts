// ============================================================================
// Command: complete-feature
// ============================================================================

import { Command } from 'commander';
import { loadMemory, saveMemory } from '../engines/memory/index.js';
import { logAgentInteraction } from '../engines/memory/agent-history.js';
import logger from '../utils/logger.js';

export const completeFeatureCommand = new Command('complete-feature')
  .description('Mark the active feature as complete')
  .action(async (options, command) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory) {
      logger.error('Project-Mind is not initialized. Run `project-mind init` first.');
      process.exit(1);
    }

    const agent = command.parent?.opts().agent || 'human';
    const active = memory.focusHistory.active;

    if (!active) {
      logger.warn('No active feature to complete.');
      process.exit(0);
    }

    active.status = 'completed';
    active.completedAt = new Date().toISOString();
    active.lastUpdated = active.completedAt;

    memory.focusHistory.history.push(active);
    memory.focusHistory.active = null;

    await saveMemory(projectPath, memory);
    await logAgentInteraction(projectPath, agent, 'complete-feature', active.feature);

    logger.success(`Feature '${active.feature}' marked as complete and moved to history.`);
  });
