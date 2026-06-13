// ============================================================================
// Documentation Collector
// ============================================================================
// Scans the project for documentation artifacts: README, CHANGELOG,
// CONTRIBUTING, API docs, license, and docs directories.
// ============================================================================

import path from 'node:path';
import fg from 'fast-glob';
import type { DocEvidence } from '../../types/index.js';
import { readText, fileExists, normalizePath } from '../../utils/fs.js';

// ---------------------------------------------------------------------------
// License detection patterns
// ---------------------------------------------------------------------------

const LICENSE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /MIT License/i, type: 'MIT' },
  { pattern: /Apache License.*2\.0/i, type: 'Apache-2.0' },
  { pattern: /GNU General Public License.*v3/i, type: 'GPL-3.0' },
  { pattern: /GNU General Public License.*v2/i, type: 'GPL-2.0' },
  { pattern: /BSD 2-Clause/i, type: 'BSD-2-Clause' },
  { pattern: /BSD 3-Clause/i, type: 'BSD-3-Clause' },
  { pattern: /ISC License/i, type: 'ISC' },
  { pattern: /Mozilla Public License.*2\.0/i, type: 'MPL-2.0' },
  { pattern: /The Unlicense/i, type: 'Unlicense' },
  { pattern: /Creative Commons/i, type: 'CC' },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collects documentation evidence from the project directory.
 */
export async function collectDocEvidence(projectPath: string): Promise<DocEvidence> {
  const [
    readme,
    changelog,
    contributing,
    apiDocs,
    license,
    docFiles,
  ] = await Promise.all([
    findReadme(projectPath),
    findChangelog(projectPath),
    fileExists(path.join(projectPath, 'CONTRIBUTING.md')),
    findApiDocs(projectPath),
    findLicense(projectPath),
    findDocFiles(projectPath),
  ]);

  return {
    hasReadme: readme !== null,
    readmeSummary: readme ? extractSummary(readme, 500) : null,
    hasChangelog: changelog,
    hasContributing: contributing,
    hasApiDocs: apiDocs,
    licenseType: license,
    documentationFiles: docFiles,
  };
}

// ---------------------------------------------------------------------------
// Internal functions
// ---------------------------------------------------------------------------

async function findReadme(projectPath: string): Promise<string | null> {
  const candidates = [
    'README.md', 'readme.md', 'Readme.md',
    'README.rst', 'README.txt', 'README',
  ];
  for (const candidate of candidates) {
    const content = await readText(path.join(projectPath, candidate));
    if (content) return content;
  }
  return null;
}

async function findChangelog(projectPath: string): Promise<boolean> {
  const candidates = [
    'CHANGELOG.md', 'changelog.md', 'CHANGES.md',
    'HISTORY.md', 'RELEASE_NOTES.md',
  ];
  for (const candidate of candidates) {
    if (await fileExists(path.join(projectPath, candidate))) {
      return true;
    }
  }
  return false;
}

async function findApiDocs(projectPath: string): Promise<boolean> {
  const candidates = [
    'API.md', 'api.md',
    'openapi.yaml', 'openapi.yml', 'openapi.json',
    'swagger.yaml', 'swagger.yml', 'swagger.json',
  ];
  for (const candidate of candidates) {
    if (await fileExists(path.join(projectPath, candidate))) {
      return true;
    }
  }
  return false;
}

async function findLicense(projectPath: string): Promise<string | null> {
  const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'];
  for (const candidate of candidates) {
    const content = await readText(path.join(projectPath, candidate));
    if (content) {
      for (const { pattern, type } of LICENSE_PATTERNS) {
        if (pattern.test(content)) {
          return type;
        }
      }
      return 'Unknown';
    }
  }
  return null;
}

async function findDocFiles(projectPath: string): Promise<string[]> {
  const docGlobs = [
    'docs/**/*.md',
    'doc/**/*.md',
    'documentation/**/*.md',
    'wiki/**/*.md',
    '*.md',
  ];

  const files = await fg(docGlobs, {
    cwd: projectPath,
    ignore: ['**/node_modules/**', '**/.git/**'],
    onlyFiles: true,
  });

  return files.map(f => normalizePath(f)).sort();
}

/**
 * Extracts the first N characters from text, trying to end at a sentence boundary.
 */
function extractSummary(text: string, maxLength: number): string {
  // Remove markdown headers, links, badges
  let cleaned = text
    .replace(/^#+\s+/gm, '')           // Headers
    .replace(/!\[.*?\]\(.*?\)/g, '')    // Image badges
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Links → text
    .replace(/^\s*[-*]\s+/gm, '')       // List markers
    .replace(/\n{3,}/g, '\n\n')         // Multiple blank lines
    .trim();

  if (cleaned.length <= maxLength) return cleaned;

  // Try to break at sentence boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxLength * 0.5) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '…';
}
