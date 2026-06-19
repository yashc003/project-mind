// ============================================================================
// CLI Command: init
// ============================================================================
// Initializes Project-Mind in the current (or specified) project directory.
// Supports --deep-scan for full evidence collection and architecture analysis.
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import logger from '../utils/logger.js';
import { getProjectRoot } from '../utils/fs.js';
import { isInitialized, initMemory, saveMemory, updateEvidence, addSessionRef } from '../engines/memory/index.js';
import { loadConfig } from '../engines/memory/index.js';
import { recordSession } from '../engines/memory/session.js';
import { runDiscovery } from '../engines/discovery/index.js';
import { generateHandoff } from '../engines/handoff/index.js';
import { getNextSessionId } from '../engines/memory/index.js';
import { getMemoryFilePaths } from '../engines/memory/schema.js';
import { BUILTIN_POLICIES } from '../engines/governance/builtins.js';
import { writeJson, writeText } from '../utils/fs.js';
import path from 'node:path';
import { installHook } from './install-hooks.js';
import { isGitRepo } from '../utils/git.js';
import { detectAvailableIDEs } from '../engines/ide/index.js';
import chalk from 'chalk';
import { getProjectMindVersion } from '../utils/version.js';

export const initCommand = new Command('init')
  .description('Initialize Project-Mind in the current project')
  .option('--no-scan', 'Skip the deep analysis of the project')
  .option('--no-governance', 'Skip scaffolding default architectural governance policies')
  .option('--force', 'Re-initialize even if .project-mind/ already exists')
  .option('--safe', 'Safe Mode: Disables all plugin execution (Security)')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .option('-n, --name <name>', 'Project name (defaults to directory name)')
  .action(async (options) => {
    try {
      const projectPath = options.projectDir
        ? options.projectDir
        : await getProjectRoot();

      // Check if already initialized
      if (await isInitialized(projectPath) && !options.force) {
        logger.error('Project-Mind is already initialized in this directory.');
        logger.info('Use --force to re-initialize, or run `project-mind update` instead.');
        process.exit(1);
      }

      logger.box(`Initializing Project-Mind${options.scan !== false ? ' (Deep Scan)' : ''}`);

      const startTime = Date.now();

      // Step 1: Initialize memory structure
      const spinner = ora('Creating .project-mind/ directory...').start();
      const memory = await initMemory(projectPath, options.name);
      
      // Step 1.5: Generate .gitignore for the memory directory
      const gitignoreContent = '*\n!authored/\n!authored/**\n!.gitignore\n';
      const paths = getMemoryFilePaths(projectPath);
      await writeText(path.join(paths.root, '.gitignore'), gitignoreContent);
      
      spinner.succeed('Created .project-mind/ directory');

      if (options.scan !== false) {
        // Step 2: Run full discovery
        const config = await loadConfig(projectPath);
        if (options.safe) {
          config.safeMode = true;
          logger.info('Running in Safe Mode (plugins disabled)');
        }
        const result = await runDiscovery(projectPath, config);

        // Step 3: Update memory with discovery results
        updateEvidence(memory, result);
      }

      // Step 4: Generate handoff documents
      logger.section('Generating Handoff Documents');
      await generateHandoff(projectPath, memory);

      // Step 4.5: Scaffold Governance
      if (options.governance !== false) {
        logger.section('Scaffolding Governance Policies');
        const configPath = path.join(projectPath, '.project-mind.json');
        const initialConfig = {
          version: getProjectMindVersion(),
          policies: BUILTIN_POLICIES,
        };
        await writeJson(configPath, initialConfig);
        logger.success('Created .project-mind.json with built-in governance policies');
      }

      // Step 5: Create init session
      const sessionId = getNextSessionId(memory);
      const sessionType = options.scan !== false ? 'deep-scan' as const : 'init' as const;
      const duration = Date.now() - startTime;
      const ref = await recordSession(
        projectPath,
        sessionId,
        sessionType,
        `Initialized Project-Mind${options.scan !== false ? ' with deep scan' : ''}`,
        [{ file: '.project-mind/', action: 'created' }],
        null,
        duration,
      );
      addSessionRef(memory, ref);

      // Step 6: Save final memory state
      await saveMemory(projectPath, memory);

      // Final output
      logger.blank();
      logger.box(
        `Project-Mind initialized successfully!\n` +
        `\n` +
        `  Project:  ${memory.projectName}\n` +
        `  Scenario: ${memory.scenario}\n` +
        `  Duration: ${duration}ms\n` +
        `\n` +
        `  AI handoff: ${paths.aiStartHere}`
      );
      logger.blank();
      logger.info('Next steps:');
      logger.bullet('Run `project-mind install-hooks` to auto-update on every commit');
      logger.bullet('Run `project-mind note --decision "..."` to record decisions');
      logger.bullet('Run `project-mind handoff` to regenerate AI documents');

      const availableIdes = await detectAvailableIDEs(projectPath);
      if (availableIdes.length > 0) {
        logger.blank();
        logger.info(`Detected ${availableIdes.map(i => i.name).join(', ')}.`);
        logger.info(`To integrate Project-Mind context natively, run:`);
        console.log(chalk.cyan(`  npx project-mind install-ide`));
      }

      logger.blank();
    } catch (err) {
      logger.error(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
