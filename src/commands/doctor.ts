// ============================================================================
// Command: doctor
// ============================================================================

import { Command } from 'commander';
import { runDoctorChecks } from '../engines/doctor/index.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const doctorCommand = new Command('doctor')
  .description('Diagnose project intelligence health and readiness')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    const projectPath = options.projectDir || process.cwd();

    logger.box('Project-Mind Doctor');
    logger.info('Analyzing project intelligence health...\n');

    let results: any[] = [];
    try {
      results = await runDoctorChecks(projectPath);
    } catch (err: any) {
      logger.error(`Doctor checks threw an unexpected error: ${err.stack || err.message}`);
      process.exit(1);
    }

    let criticalFailures = 0;
    let warnings = 0;
    let passes = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      let title = result.title;
      if (result.passed) {
        if (result.message && result.message.includes('⚠')) {
           // It's a pass but with a warning embedded
           console.log(`${chalk.yellow('⚠')} ${chalk.bold(title)}`);
           console.log(`  ${chalk.gray(result.message)}`);
           warnings++;
        } else {
           console.log(`${chalk.green('✓')} ${chalk.bold(title)}`);
           passes++;
        }
      } else {
        if (result.severity === 'critical') {
          console.log(`${chalk.red('✗')} ${chalk.bold(title)}`);
          console.log(`  ${chalk.red(result.message)}`);
          criticalFailures++;
        } else {
          console.log(`${chalk.yellow('⚠')} ${chalk.bold(title)}`);
          console.log(`  ${chalk.yellow(result.message)}`);
          warnings++;
        }
      }
    }

    console.log(chalk.bold(`\nDiagnostics Complete:`));
    
    if (criticalFailures > 0) {
      console.log(`Found ${chalk.red(criticalFailures + ' critical failures')}, ${chalk.yellow(warnings + ' warnings')}, and ${chalk.green(passes + ' passing')}.`);
      logger.error('Doctor checks failed due to critical issues.');
      process.exit(1);
    } else if (warnings > 0) {
      console.log(`Found ${chalk.yellow(warnings + ' warnings')} and ${chalk.green(passes + ' passing')}.`);
      logger.success('Doctor checks passed with warnings.');
      process.exit(0);
    } else {
      console.log(`All ${chalk.green(passes + ' checks')} passed.`);
      logger.success('No issues found! Your project intelligence is completely healthy.');
      process.exit(0);
    }
  });
