// ============================================================================
// Git Utilities — simple-git wrapper
// ============================================================================
// Provides a safe, typed abstraction over the simple-git library.
// All functions gracefully handle non-Git repos by returning null/defaults.
// ============================================================================

import simpleGit, { type SimpleGit, type LogResult } from 'simple-git';
import type { GitEvidence, CommitInfo, AuthorInfo, FileHotspot } from '../types/index.js';

/**
 * Checks whether the given directory is a Git repository.
 */
export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const git = simpleGit(dir);
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}

/**
 * Collects comprehensive Git evidence from a repository.
 * Returns null if the directory is not a Git repo.
 */
export async function collectGitEvidence(
  dir: string,
  maxCommits: number = 20,
): Promise<GitEvidence | null> {
  if (!(await isGitRepo(dir))) {
    return null;
  }

  const git = simpleGit(dir);

  // Collect all data in parallel where possible
  const [log, branches, tags, remotes, status] = await Promise.all([
    safeLog(git, maxCommits),
    safeBranches(git),
    safeTags(git),
    safeRemotes(git),
    safeStatus(git),
  ]);

  // Process commit log
  const commits = log ? mapCommits(log) : [];
  const authors = log ? extractAuthors(log) : [];
  const hotspots = await collectHotspots(git);

  // Determine dates from commits
  const firstCommitDate = commits.length > 0 ? commits[commits.length - 1].date : null;
  const latestCommitDate = commits.length > 0 ? commits[0].date : null;

  // Extract remote URL
  const remoteUrl = remotes.length > 0 ? remotes[0] : null;

  return {
    isGitRepo: true,
    totalCommits: log?.total ?? 0,
    authors,
    branches: branches.all ?? [],
    tags: tags ?? [],
    currentBranch: status?.current ?? branches.current ?? 'unknown',
    remoteUrl,
    recentCommits: commits,
    hotspots,
    firstCommitDate,
    latestCommitDate,
  };
}

/**
 * Gets files changed since a given date.
 */
export async function getRecentChanges(
  dir: string,
  since: string,
): Promise<string[]> {
  try {
    const git = simpleGit(dir);
    const log = await git.log({ '--since': since, '--name-only': null });
    const files = new Set<string>();
    for (const commit of log.all) {
      // The diff.files won't be populated with --name-only on log
      // Parse from body if available
      if (commit.body) {
        for (const line of commit.body.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('commit ')) {
            files.add(trimmed);
          }
        }
      }
    }
    return Array.from(files);
  } catch {
    return [];
  }
}

/**
 * Gets files changed and deleted since a specific commit hash.
 * Also includes untracked files.
 */
export async function getChangedFilesSinceHash(
  dir: string,
  lastHash: string
): Promise<{ changed: string[], deleted: string[] }> {
  try {
    const git = simpleGit(dir);
    
    // Get diff against the last known hash
    // --name-status returns lines like:
    // M       src/foo.ts
    // D       src/bar.ts
    // A       src/baz.ts
    const statusOutput = await git.raw(['diff', '--name-status', lastHash, 'HEAD']);
    const untrackedOutput = await git.raw(['ls-files', '--others', '--exclude-standard']);
    const cachedOutput = await git.raw(['diff', '--name-status', '--cached']);
    
    const changed = new Set<string>();
    const deleted = new Set<string>();

    const parseNameStatus = (output: string) => {
      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Split by whitespace
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const status = parts[0];
          const file = parts.slice(1).join(' '); // handle spaces in paths just in case
          
          if (status.startsWith('D')) {
            deleted.add(file);
          } else {
            changed.add(file);
          }
        }
      }
    };

    parseNameStatus(statusOutput);
    parseNameStatus(cachedOutput);
    
    // Add untracked files as changed
    for (const file of untrackedOutput.split('\n')) {
      const trimmed = file.trim();
      if (trimmed) {
        changed.add(trimmed);
      }
    }

    return {
      changed: Array.from(changed),
      deleted: Array.from(deleted)
    };
  } catch (err) {
    // If hash doesn't exist or git fails, return null to fallback to full scan
    return { changed: [], deleted: [] };
  }
}

// ---------------------------------------------------------------------------
// Internal safe wrappers — never throw, return defaults on failure
// ---------------------------------------------------------------------------

async function safeLog(git: SimpleGit, max: number): Promise<LogResult | null> {
  try {
    return await git.log({ maxCount: max });
  } catch {
    return null;
  }
}

async function safeBranches(git: SimpleGit) {
  try {
    return await git.branchLocal();
  } catch {
    return { all: [] as string[], current: 'unknown', branches: {}, detached: false };
  }
}

async function safeTags(git: SimpleGit): Promise<string[]> {
  try {
    const result = await git.tags();
    return result.all;
  } catch {
    return [];
  }
}

async function safeRemotes(git: SimpleGit): Promise<string[]> {
  try {
    const remotes = await git.getRemotes(true);
    return remotes
      .filter(r => r.name === 'origin')
      .map(r => r.refs?.fetch || r.refs?.push || '')
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function safeStatus(git: SimpleGit) {
  try {
    return await git.status();
  } catch {
    return null;
  }
}

function mapCommits(log: LogResult): CommitInfo[] {
  return log.all.map(c => ({
    hash: c.hash,
    shortHash: c.hash.substring(0, 7),
    author: c.author_name,
    email: c.author_email,
    date: c.date,
    message: c.message,
    filesChanged: 0, // Populated by diffSummary if needed
  }));
}

function extractAuthors(log: LogResult): AuthorInfo[] {
  const authorMap = new Map<string, AuthorInfo>();
  for (const commit of log.all) {
    const key = commit.author_email.toLowerCase();
    const existing = authorMap.get(key);
    if (existing) {
      existing.commitCount++;
    } else {
      authorMap.set(key, {
        name: commit.author_name,
        email: commit.author_email,
        commitCount: 1,
      });
    }
  }
  return Array.from(authorMap.values()).sort((a, b) => b.commitCount - a.commitCount);
}

/**
 * Collects file change frequency (hotspots) from the full git log.
 * Returns files sorted by change frequency (most changed first).
 */
async function collectHotspots(git: SimpleGit): Promise<FileHotspot[]> {
  try {
    // Use git log --name-only to get all changed files
    const result = await git.raw(['log', '--name-only', '--format=', '--max-count=200']);
    const fileCount = new Map<string, number>();
    for (const line of result.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) {
        fileCount.set(trimmed, (fileCount.get(trimmed) || 0) + 1);
      }
    }
    return Array.from(fileCount.entries())
      .map(([filePath, changeCount]) => ({ filePath, changeCount }))
      .sort((a, b) => b.changeCount - a.changeCount)
      .slice(0, 20); // Top 20 hotspots
  } catch {
    return [];
  }
}
