// ============================================================================
// Command: focus
// ============================================================================

import { Command } from 'commander';
import { loadMemory, saveMemory } from '../engines/memory/index.js';
import { logAgentInteraction } from '../engines/memory/agent-history.js';
import {
  updateFocusStatus,
  addBlocker,
  removeBlocker,
  addSubTask,
  completeSubTask,
  computeProgress,
  detectScopeDrift
} from '../engines/focus/index.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const focusCommand = new Command('focus')
  .description('Manage the current focus (subtasks, blockers, status)');

focusCommand
  .command('status')
  .description('Show current focus status and progress')
  .action(async () => {
    const memory = await loadMemory(process.cwd());
    if (!memory || !memory.focusHistory.active) {
      logger.info('No active focus. Run `project-mind start-feature` to begin.');
      process.exit(0);
    }
    
    const active = memory.focusHistory.active;
    const progress = computeProgress(memory);
    const drift = detectScopeDrift(memory);

    console.log(chalk.bold.magenta('\n🎯 Current Focus\n'));
    console.log(`  ${chalk.bold('Feature:')} ${active.feature}`);
    console.log(`  ${chalk.bold('Task:')}    ${active.task}`);
    console.log(`  ${chalk.bold('Status:')}  ${active.status}`);
    console.log(`  ${chalk.bold('Progress:')} ${progress.completed}/${progress.total} (${progress.percentage}%)\n`);

    if (active.subTasks.length > 0) {
      console.log(chalk.bold('  Subtasks:'));
      active.subTasks.forEach(st => {
        const icon = st.status === 'done' ? chalk.green('✔') : chalk.gray('☐');
        console.log(`    ${icon} [${st.id}] ${st.description}`);
      });
      console.log();
    }

    if (active.blockers.length > 0) {
      console.log(chalk.bold.red('  Blockers:'));
      active.blockers.forEach((b, i) => {
        console.log(`    [${i}] ${b}`);
      });
      console.log();
    }

    if (drift.hasDrift) {
      console.log(chalk.bold.yellow('  ⚠ Scope Drift Detected:'));
      console.log(`    Expected: ${active.expectedModules.join(', ') || 'None'}`);
      console.log(`    Extra Modules Touched: ${drift.extraModules.length}`);
      drift.extraModules.slice(0, 5).forEach(m => console.log(`      - ${m}`));
      if (drift.extraModules.length > 5) console.log(`      ... and ${drift.extraModules.length - 5} more`);
      console.log();
    }
  });

focusCommand
  .command('update <status>')
  .description('Update the status (planning, in-progress, blocked, review)')
  .action(async (status, _, command) => {
    const valid = ['planning', 'in-progress', 'blocked', 'review'];
    if (!valid.includes(status)) {
      logger.error(`Invalid status. Must be one of: ${valid.join(', ')}`);
      process.exit(1);
    }
    
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);
    if (!memory || !memory.focusHistory.active) return;
    
    updateFocusStatus(memory, status as any);
    await saveMemory(projectPath, memory);
    const agent = command.parent?.parent?.opts().agent || 'human';
    await logAgentInteraction(projectPath, agent, 'focus-update', `Status changed to ${status}`);
    logger.success(`Focus status updated to: ${status}`);
  });

focusCommand
  .command('block <reason>')
  .description('Add a blocker to the current focus')
  .action(async (reason, _, command) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);
    if (!memory || !memory.focusHistory.active) return;
    
    addBlocker(memory, reason);
    updateFocusStatus(memory, 'blocked');
    await saveMemory(projectPath, memory);
    
    const agent = command.parent?.parent?.opts().agent || 'human';
    await logAgentInteraction(projectPath, agent, 'focus-blocked', reason);
    logger.success('Blocker added and status set to blocked.');
  });

focusCommand
  .command('unblock <index>')
  .description('Remove a blocker by index')
  .action(async (index, _, command) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);
    if (!memory || !memory.focusHistory.active) return;
    
    const idx = parseInt(index, 10);
    removeBlocker(memory, idx);
    await saveMemory(projectPath, memory);
    
    const agent = command.parent?.parent?.opts().agent || 'human';
    await logAgentInteraction(projectPath, agent, 'focus-unblocked', `Removed blocker index ${idx}`);
    logger.success('Blocker removed.');
  });

focusCommand
  .command('task-add <description>')
  .description('Add a subtask')
  .action(async (desc, _, command) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);
    if (!memory || !memory.focusHistory.active) return;
    
    addSubTask(memory, desc);
    await saveMemory(projectPath, memory);
    
    const agent = command.parent?.parent?.opts().agent || 'human';
    await logAgentInteraction(projectPath, agent, 'focus-task-add', desc);
    logger.success(`Subtask added: ${desc}`);
  });

focusCommand
  .command('task-done <id>')
  .description('Mark a subtask as done by its ID')
  .action(async (id, _, command) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);
    if (!memory || !memory.focusHistory.active) return;
    
    if (completeSubTask(memory, id)) {
      await saveMemory(projectPath, memory);
      const agent = command.parent?.parent?.opts().agent || 'human';
      await logAgentInteraction(projectPath, agent, 'focus-task-done', id);
      logger.success(`Subtask ${id} marked as done.`);
    } else {
      logger.error(`Subtask ${id} not found.`);
    }
  });
