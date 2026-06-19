// ============================================================================
// Agent History Engine
// ============================================================================
// Tracks the history of AI agents (and human users) interacting with the
// project via the CLI.
// ============================================================================

import type { AgentInteraction } from '../../types/index.js';
import { getMemoryFilePaths } from './schema.js';
import { ensureDir } from '../../utils/fs.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function logAgentInteraction(
  projectPath: string,
  agent: string,
  action: string,
  details?: string
): Promise<void> {
  const paths = getMemoryFilePaths(projectPath);
  
  const interaction: AgentInteraction = {
    agent,
    action,
    timestamp: new Date().toISOString(),
    details,
  };

  await ensureDir(path.dirname(paths.agentHistory));
  const jsonlLine = JSON.stringify(interaction) + '\n';
  
  await fs.appendFile(paths.agentHistory, jsonlLine, 'utf-8');
}
