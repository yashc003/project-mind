// ============================================================================
// CLI Command: note
// ============================================================================
// Records developer notes or architectural decisions into the project memory.
// Supports plain notes and structured decisions with rejected alternatives.
// ============================================================================

import { Command } from 'commander';
import crypto from 'node:crypto';
import logger from '../utils/logger.js';
import { getProjectRoot } from '../utils/fs.js';
import {
  isInitialized,
  loadMemory,
  saveMemory,
  addDecision,
  addNote,
  addSessionRef,
  getNextSessionId,
} from '../engines/memory/index.js';
import { recordSession } from '../engines/memory/session.js';
import { generateHandoff } from '../engines/handoff/index.js';
import type { Decision, DeveloperNote } from '../types/index.js';

export const noteCommand = new Command('note')
  .description('Record a developer note or decision')
  .argument('<message>', 'Note or decision message')
  .option('--decision', 'Record as a formal decision')
  .option('--rejected <alternatives...>', 'Rejected alternatives (use with --decision)')
  .option('--reason <reason>', 'Reason for the decision')
  .option('--tags <tags...>', 'Tags for categorization')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (message: string, options) => {
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

      const tags: string[] = options.tags || [];
      const now = new Date().toISOString();

      if (options.decision) {
        // Record as a decision
        const decision: Decision = {
          id: crypto.randomBytes(8).toString('hex'),
          title: message,
          description: message,
          rejected: options.rejected || [],
          reason: options.reason || '',
          timestamp: now,
          source: 'manual',
          tags,
          confidence: 100,
          impactedFeatures: [],
          impactedComponents: [],
        };
        addDecision(memory, decision);

        logger.success(`Decision recorded: "${message}"`);
        if (decision.rejected.length > 0) {
          logger.kv('Rejected', decision.rejected.join(', '));
        }
        if (decision.reason) {
          logger.kv('Reason', decision.reason);
        }
      } else {
        // Record as a plain note
        const note: DeveloperNote = {
          id: crypto.randomBytes(8).toString('hex'),
          content: message,
          timestamp: now,
          tags,
        };
        addNote(memory, note);

        logger.success(`Note recorded: "${message}"`);
      }

      // Record session
      const sessionId = getNextSessionId(memory);
      const sessionType = options.decision ? 'note' as const : 'note' as const;
      const ref = await recordSession(
        projectPath,
        sessionId,
        sessionType,
        options.decision ? `Decision: ${message}` : `Note: ${message}`,
        [],
        message,
      );
      addSessionRef(memory, ref);

      // Save and regenerate
      await saveMemory(projectPath, memory);
      await generateHandoff(projectPath, memory);

      logger.info('Memory updated and handoff documents regenerated.');
    } catch (err) {
      logger.error(`Note failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
