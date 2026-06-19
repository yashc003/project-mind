// ============================================================================
// CLI Command: install-ide
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { checkbox } from '@inquirer/prompts';
import { checkIDEIntegrations, detectAvailableIDEs, installIDEIntegration, IDE_PROVIDERS } from '../engines/ide/index.js';

export const installIdeCommand = new Command('install-ide')
  .description('Install Project-Mind integration into IDE configuration files')
  .argument('[ide]', 'Specific IDE to integrate (e.g., cursor, windsurf, copilot)')
  .option('--check', 'Check integration status across all supported IDEs')
  .action(async (targetIde, options) => {
    const projectPath = process.cwd();

    if (options.check) {
      console.log(chalk.bold('\nIDE Integration Status:'));
      const statuses = await checkIDEIntegrations(projectPath);
      for (const s of statuses) {
        if (s.isIntegrated) {
          console.log(`  ${chalk.green('✓')} ${s.provider.name.padEnd(15)} Installed`);
        } else if (s.isInstalled) {
          console.log(`  ${chalk.yellow('⚠')} ${s.provider.name.padEnd(15)} Detected but not integrated`);
        } else {
          console.log(`  ${chalk.gray('✗')} ${s.provider.name.padEnd(15)} Not Installed`);
        }
      }
      console.log();
      return;
    }

    if (targetIde) {
      const provider = IDE_PROVIDERS.find(p => p.id === targetIde.toLowerCase());
      if (!provider) {
        console.error(chalk.red(`Unknown IDE: ${targetIde}. Supported: ${IDE_PROVIDERS.map(p => p.id).join(', ')}`));
        process.exit(1);
      }

      const spinner = ora(`Integrating Project-Mind with ${provider.name}...`).start();
      const success = await installIDEIntegration(projectPath, provider);
      if (success) {
        spinner.succeed(`Successfully integrated with ${provider.name} (${provider.ruleFile})`);
      } else {
        spinner.fail(`Failed to integrate with ${provider.name}`);
      }
      return;
    }

    // Interactive Mode
    const available = await detectAvailableIDEs(projectPath);
    const unintegrated = IDE_PROVIDERS.filter(p => !available.find(a => a.id === p.id)); // For display

    const choices = IDE_PROVIDERS.map(p => {
      const isDetected = available.find(a => a.id === p.id);
      return {
        name: `${p.name} ${isDetected ? chalk.yellow('(Detected)') : ''}`,
        value: p,
        checked: !!isDetected,
      };
    });

    console.log();
    const selectedProviders = await checkbox({
      message: 'Select IDEs to install Project-Mind integration (Press <Space> to select, <Enter> to confirm):',
      choices: choices,
    });

    if (selectedProviders.length === 0) {
      console.log(chalk.gray('No IDEs selected. Exiting.'));
      return;
    }

    console.log();
    for (const provider of selectedProviders) {
      const spinner = ora(`Integrating ${provider.name}...`).start();
      const success = await installIDEIntegration(projectPath, provider);
      if (success) {
        spinner.succeed(`Successfully integrated with ${provider.name}`);
      } else {
        spinner.fail(`Failed to integrate with ${provider.name}`);
      }
    }
    console.log();
  });
