// ============================================================================
// Command: doctor
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { runDiagnostics } from '../engines/doctor/index.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const doctorCommand = new Command('doctor')
  .description('Diagnose missing intent, context gaps, and orphaned decisions')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    const projectPath = options.projectDir || process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory) {
      logger.error('Project-Mind is not initialized. Run `project-mind init` first.');
      process.exit(1);
    }

    logger.section('Project Doctor');
    logger.info('Analyzing project intelligence health...\n');

    const issues = runDiagnostics(memory);

    if (issues.length === 0) {
      logger.success('No issues found! Your project intelligence is healthy.');
      return;
    }

    let high = 0;
    let medium = 0;
    let low = 0;

    issues.forEach(issue => {
      let icon = '';
      if (issue.severity === 'high') { icon = chalk.red('🚨 HIGH:'); high++; }
      if (issue.severity === 'medium') { icon = chalk.yellow('⚠️  MED:'); medium++; }
      if (issue.severity === 'low') { icon = chalk.blue('ℹ️  LOW:'); low++; }

      console.log(`${icon} [${issue.type}]`);
      console.log(`  ${issue.message}`);
      console.log(`  💡 ${chalk.italic(issue.recommendation)}\n`);
    });

    console.log(chalk.bold(`Diagnostics Complete:`));
    console.log(`Found ${high} high, ${medium} medium, and ${low} low severity issues.`);
  });
