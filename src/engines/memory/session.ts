// ============================================================================
// Session Manager
// ============================================================================
// Creates, reads, and lists session files in .project-mind/sessions/.
// Each session is a JSON file recording one unit of project-mind activity.
// ============================================================================

import path from 'node:path';
import type { Session, SessionType, SessionChange, SessionReference } from '../../types/index.js';
import { createSession } from './schema.js';
import { getMemoryFilePaths } from './schema.js';
import { writeJson, readJson, ensureDir } from '../../utils/fs.js';

/**
 * Records a new session to disk and returns the session reference.
 */
export async function recordSession(
  projectPath: string,
  id: number,
  type: SessionType,
  summary: string,
  changes: SessionChange[] = [],
  notes: string | null = null,
  duration: number | null = null,
): Promise<SessionReference> {
  const paths = getMemoryFilePaths(projectPath);
  await ensureDir(paths.sessions);

  const session = createSession(id, type, summary, changes, notes, duration);
  const sessionFile = path.join(paths.sessions, `session-${id}.json`);
  await writeJson(sessionFile, session);

  return {
    id: session.id,
    timestamp: session.timestamp,
    type: session.type,
    summary: session.summary,
  };
}

/**
 * Reads a specific session file.
 */
export async function getSession(
  projectPath: string,
  id: number,
): Promise<Session | null> {
  const paths = getMemoryFilePaths(projectPath);
  const sessionFile = path.join(paths.sessions, `session-${id}.json`);
  return readJson<Session>(sessionFile);
}

/**
 * Lists all session files and returns their references.
 */
export async function listSessions(projectPath: string): Promise<SessionReference[]> {
  const paths = getMemoryFilePaths(projectPath);
  const fg = (await import('fast-glob')).default;

  try {
    const files = await fg('session-*.json', {
      cwd: paths.sessions,
      onlyFiles: true,
    });

    const sessions: SessionReference[] = [];
    for (const file of files) {
      const session = await readJson<Session>(path.join(paths.sessions, file));
      if (session) {
        sessions.push({
          id: session.id,
          timestamp: session.timestamp,
          type: session.type,
          summary: session.summary,
        });
      }
    }

    return sessions.sort((a, b) => a.id - b.id);
  } catch {
    return [];
  }
}
