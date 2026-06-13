// ============================================================================
// Agent History Engine
// ============================================================================
// Tracks the history of AI agents (and human users) interacting with the
// project via the CLI.
// ============================================================================

import type { AgentInteraction } from '../../types/index.js';
import { getMemoryFilePaths } from './schema.js';
import { readJson, writeJson, fileExists } from '../../utils/fs.js';

export async function logAgentInteraction(
  projectPath: string,
  agent: string,
  action: string,
  details?: string
): Promise<void> {
  const paths = getMemoryFilePaths(projectPath);
  
  if (!(await fileExists(paths.agentHistory))) {
    return;
  }

  const history = (await readJson<AgentInteraction[]>(paths.agentHistory)) || [];

  history.push({
    agent,
    action,
    timestamp: new Date().toISOString(),
    details,
  });

  await writeJson(paths.agentHistory, history);
}
