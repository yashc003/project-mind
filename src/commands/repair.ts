// ============================================================================
// CLI Command: repair
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import logger from '../utils/logger.js';
import { getProjectRoot, fileExists, ensureDir, writeJson } from '../utils/fs.js';
import { getMemoryFilePaths, SCHEMA_VERSION } from '../engines/memory/schema.js';
import { loadMemory, saveMemory } from '../engines/memory/index.js';
import { migrateMemory } from '../engines/memory/migration.js';
import { generateHandoff } from '../engines/handoff/index.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export const repairCommand = new Command('repair')
  .description('Validate, migrate, and rebuild corrupted Project-Mind state')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    try {
      const projectPath = options.projectDir ? options.projectDir : await getProjectRoot();
      const paths = getMemoryFilePaths(projectPath);

      logger.box('Running Project-Mind Repair Engine');

      // 1. Check if .project-mind exists at all
      if (!(await fileExists(paths.root))) {
        logger.error(`No .project-mind directory found in ${projectPath}. Run \`project-mind init\` first.`);
        process.exit(1);
      }

      // 2. Validate MEMORY.json
      let memoryStr = '';
      if (!(await fileExists(paths.memory))) {
        logger.error('CRITICAL: MEMORY.json is missing! Cannot repair without root state.');
        logger.info('Recommendation: Re-run `project-mind init --force` to start over.');
        process.exit(1);
      } else {
        memoryStr = await fs.readFile(paths.memory, 'utf-8');
      }

      const spinner = ora('Validating schema and data integrity...').start();

      let memory;
      try {
        memory = JSON.parse(memoryStr);
      } catch (err) {
        spinner.fail('MEMORY.json contains invalid JSON.');
        process.exit(1);
      }

      // 3. Migrate Memory
      try {
        const oldVersion = memory.version;
        memory = migrateMemory(memory);
        if (oldVersion !== memory.version) {
          logger.info(`Schema migrated from v${oldVersion} to v${memory.version}`);
        }
      } catch (err: any) {
        spinner.fail(`Schema migration failed: ${err.message}`);
        process.exit(1);
      }

      spinner.succeed('Memory validated and migrated to current schema.');

      // 4. Force Save Memory (which rebuilds ARCHITECTURE.json, DECISIONS.md, Graph etc)
      const rebuildSpinner = ora('Rebuilding derived artifacts (Graph, Architecture)...').start();
      try {
        // Mock the lastHash so optimistic concurrency check doesn't fail on our manual parse
        memory.lastHash = undefined;
        await saveMemory(projectPath, memory);
        rebuildSpinner.succeed('Derived artifacts successfully rebuilt.');
      } catch (err: any) {
        rebuildSpinner.fail(`Failed to rebuild artifacts: ${err.message}`);
        process.exit(1);
      }

      // 5. Rebuild Handoff Documents
      const handoffSpinner = ora('Regenerating AI Context Documents...').start();
      try {
        await generateHandoff(projectPath, memory);
        handoffSpinner.succeed('Handoff documents (AI_START_HERE.md, etc.) restored.');
      } catch (err: any) {
        handoffSpinner.fail(`Failed to regenerate handoff docs: ${err.message}`);
      }

      logger.blank();
      logger.success('Repair complete! Your project intelligence state is healthy.');

    } catch (err) {
      logger.error(`Repair failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
