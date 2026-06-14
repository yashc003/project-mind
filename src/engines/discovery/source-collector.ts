// ============================================================================
// Source Code Collector
// ============================================================================
// Scans the project's source code to detect languages, count files/lines,
// categorize files, detect entry points, and build a directory tree model.
// Uses file extensions and directory naming conventions (no AST parsing).
// ============================================================================

import fg from 'fast-glob';
import path from 'node:path';
import type {
  SourceEvidence,
  LanguageInfo,
  DirectoryNode,
  FileCategories,
} from '../../types/index.js';
import type { ProjectMindConfig } from '../../types/index.js';
import { countLines, normalizePath } from '../../utils/fs.js';

// ---------------------------------------------------------------------------
// Language Detection
// ---------------------------------------------------------------------------

const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
  // Python
  '.py': 'Python', '.pyw': 'Python', '.pyi': 'Python',
  // Java / JVM
  '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin', '.scala': 'Scala', '.groovy': 'Groovy',
  // C / C++
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++',
  // C#
  '.cs': 'C#',
  // Go
  '.go': 'Go',
  // Rust
  '.rs': 'Rust',
  // Ruby
  '.rb': 'Ruby', '.erb': 'Ruby',
  // PHP
  '.php': 'PHP',
  // Swift
  '.swift': 'Swift',
  // Web
  '.html': 'HTML', '.htm': 'HTML',
  '.css': 'CSS', '.scss': 'SCSS', '.sass': 'Sass', '.less': 'Less',
  // Data / Config
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
  '.xml': 'XML', '.xsl': 'XML',
  // Shell
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell', '.fish': 'Shell',
  '.ps1': 'PowerShell', '.psm1': 'PowerShell',
  '.bat': 'Batch', '.cmd': 'Batch',
  // SQL
  '.sql': 'SQL',
  // Markdown
  '.md': 'Markdown', '.mdx': 'MDX',
  // Dart
  '.dart': 'Dart',
  // Elixir / Erlang
  '.ex': 'Elixir', '.exs': 'Elixir', '.erl': 'Erlang',
  // Lua
  '.lua': 'Lua',
  // R
  '.r': 'R', '.R': 'R',
  // Haskell
  '.hs': 'Haskell',
  // Zig
  '.zig': 'Zig',
};

/** File categories based on common naming conventions */
const TEST_PATTERNS = [
  '**/*.test.*', '**/*.spec.*', '**/*_test.*', '**/*_spec.*',
  '**/test/**', '**/tests/**', '**/__tests__/**', '**/spec/**',
];

const CONFIG_PATTERNS = [
  '**/.*rc', '**/.*rc.js', '**/.*rc.json', '**/.*rc.yml',
  '**/*.config.*', '**/config/**',
  '**/tsconfig*.json', '**/jest.config.*', '**/vitest.config.*',
  '**/webpack.config.*', '**/vite.config.*', '**/rollup.config.*',
  '**/babel.config.*', '**/.babelrc',
  '**/Makefile', '**/Dockerfile', '**/docker-compose*',
  '**/.env*', '**/.editorconfig', '**/.prettierrc*', '**/.eslintrc*',
];

const DOC_PATTERNS = [
  '**/*.md', '**/*.mdx', '**/*.txt', '**/*.rst',
  '**/docs/**', '**/doc/**', '**/documentation/**',
];

const ASSET_PATTERNS = [
  '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg', '**/*.ico',
  '**/*.woff', '**/*.woff2', '**/*.ttf', '**/*.eot',
  '**/*.mp4', '**/*.mp3', '**/*.wav',
  '**/*.pdf',
  '**/assets/**', '**/static/**', '**/public/**', '**/images/**',
];

const ENTRY_POINT_NAMES = [
  'index', 'main', 'app', 'server', 'cli',
  'mod', 'lib',
  'Program', 'Application', 'Startup',
  'manage',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scans the project directory and collects source code evidence.
 */
export async function collectSourceEvidence(
  projectPath: string,
  config: ProjectMindConfig,
): Promise<SourceEvidence> {
  // Build ignore patterns from config
  const ignorePatterns = config.ignoreDirs.map(d => `**/${d}/**`);

  // Parse .gitignore and .projectmindignore
  const gitignorePatterns = await parseIgnoreFile(path.join(projectPath, '.gitignore'));
  const projectmindignorePatterns = await parseIgnoreFile(path.join(projectPath, '.projectmindignore'));
  
  ignorePatterns.push(...gitignorePatterns, ...projectmindignorePatterns);

  // Find all files
  const allFiles = await fg('**/*', {
    cwd: projectPath,
    ignore: ignorePatterns,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    deep: config.maxDepth,
  });

  // Categorize files
  const categories = categorizeFiles(allFiles, projectPath);

  // Detect languages and categorize
  const langMap = new Map<string, { files: string[]; extensions: Set<string>; lines: number }>();
  
  // First pass: Categorize and prepare files that need line counting
  const filesToCount: { file: string; fullPath: string; lang: string }[] = [];
  
  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    const lang = LANGUAGE_MAP[ext];
    if (lang) {
      const existing = langMap.get(lang) || { files: [], extensions: new Set(), lines: 0 };
      existing.files.push(file);
      existing.extensions.add(ext);
      langMap.set(lang, existing);

      const fullPath = path.join(projectPath, file);
      filesToCount.push({ file, fullPath, lang });
    }
  }

  // Second pass: Count lines concurrently in chunks to prevent EMFILE limits
  let totalLines = 0;
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < filesToCount.length; i += BATCH_SIZE) {
    const batch = filesToCount.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async ({ fullPath, lang }) => {
      const fileSize = await getFileSizeQuick(fullPath);
      if (fileSize <= config.maxFileSizeBytes) {
        const lines = await countLines(fullPath);
        
        // Update counts (synchronous additions within Promise.all are safe in Node.js event loop)
        const existing = langMap.get(lang)!;
        existing.lines += lines;
        totalLines += lines;
      }
    }));
  }

  // Build language info sorted by file count
  const totalSourceFiles = allFiles.length;
  const languages: LanguageInfo[] = Array.from(langMap.entries())
    .map(([name, data]) => ({
      name,
      extensions: Array.from(data.extensions),
      fileCount: data.files.length,
      lineCount: data.lines,
      percentage: totalSourceFiles > 0
        ? Math.round((data.files.length / totalSourceFiles) * 100)
        : 0,
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  // Build directory tree (top 2 levels)
  const directoryStructure = await buildDirectoryTree(projectPath, config.ignoreDirs, 2);

  // Detect entry points
  const entryPoints = detectEntryPoints(allFiles);

  return {
    totalFiles: allFiles.length,
    totalLines,
    languages,
    directoryStructure,
    entryPoints,
    fileCategories: categories,
  };
}

// ---------------------------------------------------------------------------
// Internal functions
// ---------------------------------------------------------------------------

async function parseIgnoreFile(filePath: string): Promise<string[]> {
  const { promises: fs } = await import('node:fs');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        // Convert gitignore syntax to fast-glob
        let pattern = line;
        if (pattern.startsWith('/')) pattern = pattern.slice(1);
        if (pattern.endsWith('/')) pattern = pattern.slice(0, -1);
        
        // If it's a directory rule, make it a glob wildcard
        if (!pattern.includes('*') && !pattern.includes('.')) {
          return `**/${pattern}/**`;
        }
        
        // Wrap with ** if it's a simple pattern without slashes
        if (!pattern.includes('/')) {
          return `**/${pattern}/**`;
        }
        
        return pattern;
      });
  } catch {
    return [];
  }
}

function categorizeFiles(files: string[], _projectPath: string): FileCategories {
  const categories: FileCategories = {
    source: [],
    test: [],
    config: [],
    docs: [],
    assets: [],
    other: [],
  };

  for (const file of files) {
    const normalized = normalizePath(file);

    if (matchesAnyPattern(normalized, TEST_PATTERNS)) {
      categories.test.push(normalized);
    } else if (matchesAnyPattern(normalized, CONFIG_PATTERNS)) {
      categories.config.push(normalized);
    } else if (matchesAnyPattern(normalized, DOC_PATTERNS)) {
      categories.docs.push(normalized);
    } else if (matchesAnyPattern(normalized, ASSET_PATTERNS)) {
      categories.assets.push(normalized);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (LANGUAGE_MAP[ext]) {
        categories.source.push(normalized);
      } else {
        categories.other.push(normalized);
      }
    }
  }

  return categories;
}

function matchesAnyPattern(file: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (simpleGlobMatch(file, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Simplified glob matching for categorization.
 * Handles **, *, and literal segments.
 */
function simpleGlobMatch(file: string, pattern: string): boolean {
  // Convert glob to regex
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§')    // Placeholder for **
    .replace(/\*/g, '[^/]*')   // * matches non-slash
    .replace(/§§/g, '.*');     // ** matches anything
  try {
    return new RegExp(`^${regexStr}$`).test(file);
  } catch {
    return false;
  }
}

async function buildDirectoryTree(
  rootPath: string,
  ignoreDirs: string[],
  maxDepth: number,
  currentDepth: number = 0,
): Promise<DirectoryNode[]> {
  if (currentDepth >= maxDepth) return [];

  const { promises: fs } = await import('node:fs');
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const nodes: DirectoryNode[] = [];

  for (const entry of entries) {
    if (ignoreDirs.includes(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;

    const fullPath = path.join(rootPath, entry.name);
    const relativePath = normalizePath(entry.name);

    if (entry.isDirectory()) {
      const children = await buildDirectoryTree(
        fullPath, ignoreDirs, maxDepth, currentDepth + 1,
      );
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        language: LANGUAGE_MAP[ext] || undefined,
      });
    }
  }

  return nodes.sort((a, b) => {
    // Directories first, then alphabetical
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function detectEntryPoints(files: string[]): string[] {
  const entryPoints: string[] = [];
  for (const file of files) {
    const basename = path.basename(file, path.extname(file));
    if (ENTRY_POINT_NAMES.includes(basename)) {
      entryPoints.push(normalizePath(file));
    }
  }
  return entryPoints;
}

async function getFileSizeQuick(filePath: string): Promise<number> {
  try {
    const { promises: fs } = await import('node:fs');
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}
