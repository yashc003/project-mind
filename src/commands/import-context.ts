// ============================================================================
// Command: import-context
// ============================================================================

import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadMemory, saveMemory } from '../engines/memory/index.js';
import { extractContext } from '../engines/extraction/index.js';
import { logAgentInteraction } from '../engines/memory/agent-history.js';
import logger from '../utils/logger.js';

export const importContextCommand = new Command('import-context')
  .description('Import a markdown chat/design document to extract intent')
  .argument('<file>', 'Path to the markdown file to import')
  .action(async (file, options, command) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory) {
      logger.error('Project-Mind is not initialized. Run `project-mind init` first.');
      process.exit(1);
    }

    const agent = command.parent?.opts().agent || 'human';
    const filePath = path.resolve(projectPath, file);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      logger.section('Importing Context');
      logger.info(`Analyzing ${file}...`);

      const result = extractContext(content, memory);

      memory.decisions.push(...result.decisions);
      memory.notes.push(...result.notes);

      await saveMemory(projectPath, memory);
      await logAgentInteraction(projectPath, agent, 'import-context', `Imported ${result.decisions.length} decisions from ${file}`);

      if (result.decisions.length > 0) {
        logger.success(`Extracted ${result.decisions.length} high-confidence decisions.`);
      } else {
        logger.warn('No high-confidence decisions extracted.');
      }

      if (result.notes.length > 0) {
        logger.success(`Extracted ${result.notes.length} developer notes.`);
      }

    } catch (err: any) {
      logger.error(`Failed to read or parse file: ${err.message}`);
      process.exit(1);
    }
  });
