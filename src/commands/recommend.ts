// ============================================================================
// Command: recommend
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { runDiagnostics } from '../engines/doctor/index.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const recommendCommand = new Command('recommend')
  .description('Provides actionable recommendations based on project health')
  .action(async () => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory) {
      logger.error('Project memory not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const issues = runDiagnostics(memory);

    console.log(chalk.bold.magenta('\n💡 Recommendations\n'));

    if (issues.length === 0) {
      console.log(chalk.green('Everything looks perfect! No recommendations at this time.\n'));
      process.exit(0);
    }

    let recommendationCount = 1;

    issues.forEach(issue => {
      console.log(`${chalk.bold.cyan(`${recommendationCount}.`)} ${issue.recommendation}`);
      recommendationCount++;
    });

    console.log();
  });
