// ============================================================================
// Git Evidence Collector
// ============================================================================
// Delegates to the git utility for evidence collection.
// This module exists as part of the discovery engine's collector interface.
// ============================================================================

import type { GitEvidence } from '../../types/index.js';
import { collectGitEvidence as collectFromGit } from '../../utils/git.js';

/**
 * Collects Git evidence from the project directory.
 * Returns null if not a Git repository.
 */
export async function collectGitEvidence(
  projectPath: string,
  maxCommits: number = 20,
): Promise<GitEvidence | null> {
  return collectFromGit(projectPath, maxCommits);
}
