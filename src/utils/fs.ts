// ============================================================================
// File System Utilities
// ============================================================================
// Async helpers for reading, writing, and navigating the file system.
// All writes are atomic (write to temp → rename) to prevent corruption.
// ============================================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

/**
 * Ensures a directory exists, creating it recursively if needed.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Reads and parses a JSON file. Returns null if the file doesn't exist.
 */
export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Atomically writes a JSON file (write to temp → rename).
 * Pretty-prints with 2-space indentation.
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = path.join(dir, `.tmp-${crypto.randomBytes(6).toString('hex')}.json`);
  const content = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * Atomically writes a text file.
 */
export async function writeText(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = path.join(dir, `.tmp-${crypto.randomBytes(6).toString('hex')}`);
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * Reads a text file. Returns null if not found.
 */
export async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Checks whether a file or directory exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a path is a directory.
 */
export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Gets file size in bytes. Returns 0 if not found.
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

/**
 * Counts lines in a file. Returns 0 for binary or missing files.
 */
export async function countLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Walks up the directory tree looking for a marker directory.
 * Returns the directory containing the marker, or null.
 */
export async function findUpwards(
  startDir: string,
  markerName: string,
): Promise<string | null> {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const candidate = path.join(current, markerName);
    if (await fileExists(candidate)) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

/**
 * Finds the project root by looking for .project-mind/ or .git/ directories.
 * Falls back to the provided directory.
 */
export async function getProjectRoot(startDir?: string): Promise<string> {
  const dir = startDir || process.cwd();

  // First try to find .project-mind
  const pmDir = await findUpwards(dir, '.project-mind');
  if (pmDir) return pmDir;

  // Then try .git
  const gitDir = await findUpwards(dir, '.git');
  if (gitDir) return gitDir;

  // Fall back to current directory
  return path.resolve(dir);
}

/**
 * Gets a human-readable relative path from the project root.
 */
export function relativePath(from: string, to: string): string {
  return path.relative(from, to).replace(/\\/g, '/');
}

/**
 * Normalizes path separators to forward slashes (for cross-platform JSON storage).
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Gets the OS-specific temp directory.
 */
export function getTempDir(): string {
  return os.tmpdir();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && 'code' in err;
}
