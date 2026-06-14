// ============================================================================
// Command: complete-feature
// ============================================================================

import { Command } from 'commander';
import { loadMemory, saveMemory } from '../engines/memory/index.js';
import { logAgentInteraction } from '../engines/memory/agent-history.js';
import { detectScopeDrift } from '../engines/focus/index.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

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

    const incompleteSubTasks = active.subTasks.filter(t => t.status !== 'done');
    if (incompleteSubTasks.length > 0) {
      logger.warn(`There are ${incompleteSubTasks.length} incomplete subtasks. They will be archived with the feature.`);
    }

    const drift = detectScopeDrift(memory);
    if (drift.hasDrift) {
      console.log(chalk.bold.yellow('\n⚠ Scope Drift Summary:'));
      console.log(`  Expected: ${active.expectedModules.join(', ') || 'None'}`);
      console.log(`  Extra Modules Touched: ${drift.extraModules.length}`);
      drift.extraModules.slice(0, 5).forEach(m => console.log(`    - ${m}`));
      if (drift.extraModules.length > 5) console.log(`    ... and ${drift.extraModules.length - 5} more`);
      console.log();
    }

    const start = new Date(active.startedAt).getTime();
    const end = new Date().getTime();
    const durationHours = Math.round((end - start) / (1000 * 60 * 60) * 10) / 10;

    active.status = 'completed';
    active.completedAt = new Date().toISOString();
    active.lastUpdated = active.completedAt;

    memory.focusHistory.history.push(active);
    memory.focusHistory.active = null;

    await saveMemory(projectPath, memory);
    await logAgentInteraction(projectPath, agent, 'complete-feature', active.feature);

    logger.success(`Feature '${active.feature}' marked as complete in ${durationHours} hours and moved to history.`);
  });
