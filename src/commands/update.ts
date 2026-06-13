// ============================================================================
// CLI Command: update
// ============================================================================
// Re-runs evidence collection and updates the project memory.
// Designed to be called manually or automatically via Git hooks.
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import logger from '../utils/logger.js';
import { getProjectRoot } from '../utils/fs.js';
import { isGitRepo } from '../utils/git.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
import {
  isInitialized,
  loadMemory,
  loadConfig,
  saveMemory,
  updateEvidence,
  addSessionRef,
  getNextSessionId,
} from '../engines/memory/index.js';
import { recordSession } from '../engines/memory/session.js';
import { runDiscovery } from '../engines/discovery/index.js';
import { generateHandoff } from '../engines/handoff/index.js';

export const updateCommand = new Command('update')
  .description('Update project memory from current evidence')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .option('-q, --quiet', 'Suppress output (for Git hook usage)')
  .action(async (options) => {
    try {
      const projectPath = options.projectDir
        ? options.projectDir
        : await getProjectRoot();

      // Check initialization
      if (!(await isInitialized(projectPath))) {
        if (!options.quiet) {
          logger.error('Project-Mind is not initialized. Run `project-mind init` first.');
        }
        process.exit(1);
      }

      if (!options.quiet) {
        logger.box('Updating Project Memory');
      }

      const startTime = Date.now();

      // Load existing memory
      const memory = await loadMemory(projectPath);
      if (!memory) {
        logger.error('Failed to load memory. The MEMORY.json file may be corrupted.');
        process.exit(1);
      }

      const config = await loadConfig(projectPath);

      // Incremental Cache Check
      if (await isGitRepo(projectPath)) {
        try {
          const { stdout: status } = await execAsync('git status --porcelain', { cwd: projectPath });
          const { stdout: hash } = await execAsync('git rev-parse HEAD', { cwd: projectPath });
          const currentHash = hash.trim();
          const isClean = status.trim() === '';
          const lastHash = memory.evidence?.git?.recentCommits?.[0]?.hash;
          
          if (isClean && lastHash === currentHash) {
            if (!options.quiet) {
              logger.success('Project memory is already up to date (no changes detected).');
            }
            process.exit(0);
          }
        } catch (e) {
          // Ignore git errors, just proceed with full update
        }
      }

      // Run discovery
      if (!options.quiet) {
        const spinner = ora('Collecting evidence...').start();
        const result = await runDiscovery(projectPath, config);
        spinner.succeed('Evidence collection complete');

        // Update memory
        updateEvidence(memory, result);
      } else {
        // Quiet mode for hooks
        const result = await runDiscovery(projectPath, config);
        updateEvidence(memory, result);
      }

      // Regenerate handoff documents
      await generateHandoff(projectPath, memory);

      // Record session
      const duration = Date.now() - startTime;
      const sessionId = getNextSessionId(memory);
      const ref = await recordSession(
        projectPath,
        sessionId,
        'update',
        'Updated project memory from evidence',
        [],
        null,
        duration,
      );
      addSessionRef(memory, ref);

      // Save
      await saveMemory(projectPath, memory);

      if (!options.quiet) {
        logger.blank();
        logger.success(`Memory updated in ${duration}ms`);
        logger.confidence('Overall confidence', memory.confidence.overall);
        logger.blank();
      }
    } catch (err) {
      if (!options.quiet) {
        logger.error(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      process.exit(1);
    }
  });
