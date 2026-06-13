import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { getMemoryFilePaths } from '../engines/memory/schema.js';
import { compareMemory } from '../engines/graph/diff.js';
import { promises as fs } from 'node:fs';
import { fileExists } from '../utils/fs.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';
import type { ProjectMemory } from '../types/index.js';

export const diffCommand = new Command('diff')
  .description('Show structural changes since the last update')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    const projectPath = options.projectDir || process.cwd();
    const paths = getMemoryFilePaths(projectPath);

    const memory = await loadMemory(projectPath);
    if (!memory) {
      logger.error('Project-Mind is not initialized. Run `project-mind init` first.');
      process.exit(1);
    }

    let memoryPrev: ProjectMemory | null = null;
    if (await fileExists(paths.memoryPrev)) {
      try {
        const prevStr = await fs.readFile(paths.memoryPrev, 'utf-8');
        memoryPrev = JSON.parse(prevStr) as ProjectMemory;
      } catch (err) {
        logger.warn('Failed to parse previous memory state. Comparing against an empty baseline.');
      }
    }

    if (!memoryPrev) {
      logger.info('No previous memory baseline found. (Run `project-mind update` twice to generate a delta).');
    }

    logger.section('Project Delta');

    const delta = compareMemory(memoryPrev, memory);

    if (!delta.hasChanges) {
      logger.success('No structural changes detected since last update.');
      return;
    }

    // Render Components
    if (delta.components.added.length > 0) {
      console.log(chalk.green('\n+ Added Components:'));
      delta.components.added.forEach(c => console.log(chalk.green(`  - ${c.name} (${c.type})`)));
    }
    if (delta.components.removed.length > 0) {
      console.log(chalk.red('\n- Removed Components:'));
      delta.components.removed.forEach(c => console.log(chalk.red(`  - ${c.name}`)));
    }
    if (delta.components.modified.length > 0) {
      console.log(chalk.yellow('\n~ Modified Components:'));
      delta.components.modified.forEach(c => console.log(chalk.yellow(`  - ${c.name}`)));
    }

    // Render Dependencies
    if (delta.dependencies.added.length > 0) {
      console.log(chalk.green('\n+ Added Dependencies:'));
      delta.dependencies.added.forEach(d => console.log(chalk.green(`  - ${d.from} -> ${d.to}`)));
    }
    if (delta.dependencies.removed.length > 0) {
      console.log(chalk.red('\n- Removed Dependencies:'));
      delta.dependencies.removed.forEach(d => console.log(chalk.red(`  - ${d.from} -> ${d.to}`)));
    }

    // Render Features
    if (delta.features.started.length > 0) {
      console.log(chalk.blue('\n▶ Started Features:'));
      delta.features.started.forEach(f => console.log(chalk.blue(`  - ${f.name}`)));
    }
    if (delta.features.completed.length > 0) {
      console.log(chalk.magenta('\n✓ Completed Features:'));
      delta.features.completed.forEach(f => console.log(chalk.magenta(`  - ${f.name}`)));
    }

    // Render Decisions
    if (delta.decisions.added.length > 0) {
      console.log(chalk.cyan('\n💡 New Decisions:'));
      delta.decisions.added.forEach(d => console.log(chalk.cyan(`  - ${d.title}`)));
    }

    console.log(''); // newline
  });
