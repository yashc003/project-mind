// ============================================================================
// CLI Command: handoff
// ============================================================================
// Regenerates all AI handoff documents from current memory state.
// Useful after manual memory edits or when switching AI agents.
// ============================================================================

import { Command } from 'commander';
import logger from '../utils/logger.js';
import { getProjectRoot } from '../utils/fs.js';
import {
  isInitialized,
  loadMemory,
  addSessionRef,
  saveMemory,
  getNextSessionId,
} from '../engines/memory/index.js';
import { recordSession } from '../engines/memory/session.js';
import { generateHandoff } from '../engines/handoff/index.js';
import { getMemoryFilePaths } from '../engines/memory/schema.js';

export const handoffCommand = new Command('handoff')
  .description('Regenerate AI handoff documents')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    try {
      const projectPath = options.projectDir
        ? options.projectDir
        : await getProjectRoot();

      // Check initialization
      if (!(await isInitialized(projectPath))) {
        logger.error('Project-Mind is not initialized. Run `project-mind init` first.');
        process.exit(1);
      }

      // Load memory
      const memory = await loadMemory(projectPath);
      if (!memory) {
        logger.error('Failed to load memory.');
        process.exit(1);
      }

      logger.info('Regenerating handoff documents...');

      // Generate handoff
      await generateHandoff(projectPath, memory);

      // Record session
      const sessionId = getNextSessionId(memory);
      const ref = await recordSession(
        projectPath,
        sessionId,
        'handoff',
        'Regenerated AI handoff documents',
      );
      addSessionRef(memory, ref);
      await saveMemory(projectPath, memory);

      const paths = getMemoryFilePaths(projectPath);
      logger.blank();
      logger.success('Handoff documents regenerated successfully.');
      logger.blank();
      logger.info('Generated files:');
      logger.bullet(paths.aiStartHere);
      logger.bullet(paths.projectContext);
      logger.bullet(paths.handoff);
      logger.bullet(paths.workflowsMd);
      logger.blank();
      logger.info('Share AI_START_HERE.md with any AI agent for instant project context.');
    } catch (err) {
      logger.error(`Handoff failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
