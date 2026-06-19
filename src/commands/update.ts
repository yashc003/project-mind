// ============================================================================
// CLI Command: update
// ============================================================================
// Re-runs evidence collection and updates the project memory.
// Designed to be called manually or automatically via Git hooks.
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import logger from '../utils/logger.js';
import { getProjectRoot, fileExists } from '../utils/fs.js';
import { isGitRepo, getRecentChanges, getChangedFilesSinceHash } from '../utils/git.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const execAsync = promisify(exec);
import {
  isInitialized,
  loadMemory,
  loadConfig,
  saveMemory,
  updateEvidence,
  addSessionRef,
  getNextSessionId,
  getMemoryFilePaths
} from '../engines/memory/index.js';
import { recordSession } from '../engines/memory/session.js';
import { runDiscovery } from '../engines/discovery/index.js';
import { generateHandoff } from '../engines/handoff/index.js';
import { detectScopeDrift, linkCommit } from '../engines/focus/index.js';
import chalk from 'chalk';

export const updateCommand = new Command('update')
  .description('Update project memory from current evidence')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .option('-q, --quiet', 'Suppress output (for Git hook usage)')
  .option('--safe', 'Safe Mode: Disables all plugin execution (Security)')
  .action(async (options) => {
    let projectPath = '';
    try {
      projectPath = options.projectDir
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

      // Lock File Mechanism for Concurrency Protection
      const derivedDir = path.join(projectPath, '.project-mind', 'derived');
      const lockFile = path.join(derivedDir, 'UPDATE.lock');
      
      try {
        await fs.mkdir(derivedDir, { recursive: true });
        
        // Check if lock file is stale (> 5 minutes)
        try {
          const stats = await fs.stat(lockFile);
          if (Date.now() - stats.mtimeMs > 5 * 60 * 1000) {
            await fs.unlink(lockFile);
          }
        } catch {
          // File doesn't exist or already removed, which is fine
        }

        // wx flag fails if the file already exists (atomic lock)
        await fs.writeFile(lockFile, String(Date.now()), { flag: 'wx' });
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          if (!options.quiet) {
            logger.info('Another update is currently running. Skipping redundant update.');
          }
          process.exit(0);
        }
        throw err;
      }
        const startTime = Date.now();

      // Load existing memory
      const memory = await loadMemory(projectPath);
      if (!memory) {
        logger.error('Failed to load memory. The MEMORY.json file may be corrupted.');
        process.exit(1);
      }

      const config = await loadConfig(projectPath);
      
      if (options.safe) {
        config.safeMode = true;
        if (!options.quiet) logger.info('Running in Safe Mode (plugins disabled)');
      }

      // Incremental Cache Check
      let cachedSemantics = null;
      let cachedRationale = null;
      let changedFilesList: string[] | null = null;
      let deletedFilesList: string[] | null = null;

      const paths = getMemoryFilePaths(projectPath);

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

          // If we have a last hash, we can attempt an incremental scan
          if (lastHash) {
            const { changed, deleted } = await getChangedFilesSinceHash(projectPath, lastHash);
            
            // Only try to load caches if we successfully got a diff
            if (changed.length > 0 || deleted.length > 0 || isClean) {
              if (await fileExists(paths.semanticsJson)) {
                cachedSemantics = JSON.parse(await fs.readFile(paths.semanticsJson, 'utf-8'));
              }
              if (await fileExists(paths.rationaleJson)) {
                cachedRationale = JSON.parse(await fs.readFile(paths.rationaleJson, 'utf-8'));
              }
              changedFilesList = changed;
              deletedFilesList = deleted;
            }
          }
        } catch (e) {
          // Ignore git errors, just proceed with full update
        }
      }

      if (!options.quiet && cachedSemantics) {
        logger.info(`Incremental scan enabled: ${changedFilesList?.length || 0} files changed, ${deletedFilesList?.length || 0} deleted`);
      }

      // Run discovery
      let result;
      if (!options.quiet) {
        const spinner = ora('Collecting evidence...').start();
        result = await runDiscovery(projectPath, config, cachedSemantics, changedFilesList, deletedFilesList);
        spinner.succeed('Evidence collection complete');
        // Update memory
        updateEvidence(memory, result);
      } else {
        // Quiet mode for hooks
        result = await runDiscovery(projectPath, config, cachedSemantics, changedFilesList, deletedFilesList);
        updateEvidence(memory, result);
      }

      // --- Focus Git & Drift Integration ---
      if (memory.focusHistory.active && memory.evidence.git?.recentCommits) {
        const active = memory.focusHistory.active;
        let newCommitsLinked = 0;

        for (const commit of memory.evidence.git.recentCommits) {
          // If the commit happened after the focus started, and isn't linked yet
          if (new Date(commit.date).getTime() >= new Date(active.startedAt).getTime()) {
            if (!active.linkedCommits.includes(commit.hash)) {
              linkCommit(memory, commit.hash);
              newCommitsLinked++;
            }
          }
        }

        if (newCommitsLinked > 0) {
          // Fetch files changed since the focus started
          const changedFiles = await getRecentChanges(projectPath, active.startedAt);
          changedFiles.forEach((f: string) => {
            if (!active.actualModules.includes(f)) {
              active.actualModules.push(f);
            }
          });

          if (!options.quiet) {
            logger.info(`Linked ${newCommitsLinked} new commit(s) to current focus.`);
            
            const drift = detectScopeDrift(memory);
            if (drift.hasDrift) {
              console.log(chalk.bold.yellow('\n  ⚠ Scope Drift Detected:'));
              console.log(`    Expected: ${active.expectedModules.join(', ') || 'None'}`);
              console.log(`    Extra Modules Touched: ${drift.extraModules.length}`);
              drift.extraModules.slice(0, 5).forEach(m => console.log(`      - ${m}`));
              if (drift.extraModules.length > 5) console.log(`      ... and ${drift.extraModules.length - 5} more`);
              console.log();
            }
          }
        }
      }

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

      // Save Memory FIRST so MEMORY_PREV.json represents state N, and memory represents state N+1
      await saveMemory(projectPath, memory, result.semantics);

      // Regenerate handoff documents using the correct delta
      await generateHandoff(projectPath, memory);

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
    } finally {
      // Clean up lock file
      try {
        const derivedDir = path.join(projectPath, '.project-mind', 'derived');
        const lockFile = path.join(derivedDir, 'UPDATE.lock');
        await fs.unlink(lockFile);
      } catch {
        // Ignore errors if lock file is already gone
      }
    }
  });
