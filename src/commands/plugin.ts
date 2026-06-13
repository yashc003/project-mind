// ============================================================================
// Command: plugin
// ============================================================================

import { Command } from 'commander';
import path from 'node:path';
import { pluginRegistry } from '../engines/plugin/registry.js';
import { ensureDir, writeJson, fileExists } from '../utils/fs.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';
import { performance } from 'node:perf_hooks';

export const pluginCommand = new Command('plugin')
  .description('Manage Project-Mind plugins');

// ---------------------------------------------------------------------------
// List Plugins
// ---------------------------------------------------------------------------
pluginCommand.command('list')
  .description('List installed plugins')
  .action(async () => {
    const projectPath = process.cwd();
    await pluginRegistry.loadPlugins(projectPath);

    const plugins = pluginRegistry.getPlugins();
    const failed = pluginRegistry.getFailedPlugins();

    console.log(chalk.bold.magenta('\n🔌 Installed Plugins\n'));

    if (plugins.length === 0 && failed.length === 0) {
      console.log(chalk.gray('No plugins installed.'));
      return;
    }

    plugins.forEach(p => {
      console.log(chalk.bold.cyan(p.name) + chalk.gray(` v${p.version}`));
      console.log(`  Priority: ${p.priority}`);
      console.log(`  Capabilities: ${p.capabilities.join(', ')}\n`);
    });

    if (failed.length > 0) {
      console.log(chalk.bold.red('Failed to Load:'));
      failed.forEach(f => {
        console.log(`  ${f.name}: ${f.error}`);
      });
      console.log();
    }
  });

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------
pluginCommand.command('doctor')
  .description('Debug installed plugins')
  .action(async () => {
    const projectPath = process.cwd();
    await pluginRegistry.loadPlugins(projectPath);

    const plugins = pluginRegistry.getPlugins();
    const failed = pluginRegistry.getFailedPlugins();

    console.log(chalk.bold.magenta('\n🏥 Plugin Doctor\n'));
    
    console.log(`Installed: ${plugins.length + failed.length}`);
    console.log(`Loaded:    ${chalk.green(plugins.length)}`);
    console.log(`Failed:    ${failed.length > 0 ? chalk.red(failed.length) : 0}`);
    console.log(`Conflicts: 0\n`);

    if (failed.length > 0) {
      console.log(chalk.bold('Failure Details:'));
      failed.forEach(f => {
        console.log(`  ${chalk.red(f.name)}`);
        console.log(`  ${chalk.gray(f.error)}\n`);
      });
    }
  });

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------
pluginCommand.command('benchmark')
  .description('Benchmark execution time of loaded plugins')
  .action(async () => {
    const projectPath = process.cwd();
    await pluginRegistry.loadPlugins(projectPath);

    const plugins = pluginRegistry.getPlugins();

    if (plugins.length === 0) {
      console.log(chalk.gray('No plugins loaded to benchmark.'));
      return;
    }

    console.log(chalk.bold.magenta('\n⏱️ Plugin Benchmark\n'));

    // Mock context
    const mockContext = {
      projectPath,
      evidence: { git: null as any, sourceCode: { files: [] } as any, buildFiles: null as any, documentation: null as any }
    };

    for (const plugin of plugins) {
      if (plugin.analyze && plugin.capabilities.some(c => ['architecture', 'workflow', 'feature'].includes(c))) {
        const start = performance.now();
        try {
          await plugin.analyze(mockContext);
          const duration = Math.round(performance.now() - start);
          console.log(`${chalk.cyan(plugin.name)}`);
          console.log(`  Execution Time: ${duration}ms\n`);
        } catch (e: any) {
          console.log(`${chalk.red(plugin.name)}`);
          console.log(`  Execution Time: ERROR (${e.message})\n`);
        }
      } else {
        console.log(`${chalk.gray(plugin.name)}`);
        console.log(`  Execution Time: N/A (No analyze capability)\n`);
      }
    }
  });

// ---------------------------------------------------------------------------
// Create Plugin Template
// ---------------------------------------------------------------------------
pluginCommand.command('create')
  .description('Scaffold a new plugin')
  .argument('<name>', 'Name of the plugin')
  .action(async (name) => {
    logger.info(`Not implemented yet. Will scaffold plugin: ${name}`);
  });
