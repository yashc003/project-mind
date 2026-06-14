// ============================================================================
// Import Analyzer Engine (Regex-Based)
// ============================================================================
// Extracts dependency relationships between files using regex patterns.
// Supports JS/TS, Python, Java, Go, Rust, and C#.
// Creates a directed graph of imports and detects circular dependencies.
// ============================================================================

import path from 'node:path';
import { readText, normalizePath } from '../../utils/fs.js';
import type { ImportGraph, ImportNode, ImportEdge, FileCategories } from '../../types/index.js';

interface RawImport {
  raw: string;
  target: string;
}

// ---------------------------------------------------------------------------
// Regex Extractors
// ---------------------------------------------------------------------------

function extractJsTsImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  // import ... from '...' OR export ... from '...'
  const esmRegex = /(?:import|export)\s+(?:type\s+)?(?:[^'"]+)\s+from\s+['"]([^'"]+)['"]/g;
  // import('...')
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // require('...')
  const cjsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = esmRegex.exec(content)) !== null) imports.push({ raw: match[0], target: match[1] });
  while ((match = dynamicRegex.exec(content)) !== null) imports.push({ raw: match[0], target: match[1] });
  while ((match = cjsRegex.exec(content)) !== null) imports.push({ raw: match[0], target: match[1] });
  
  return imports;
}

function extractPythonImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  // import x, y
  const importRegex = /^import\s+([^\n]+)/gm;
  // from x import y
  const fromRegex = /^from\s+([^\s]+)\s+import/gm;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const modules = match[1].split(',').map(s => s.trim());
    for (const mod of modules) {
      if (mod) imports.push({ raw: match[0], target: mod.split(' ')[0] }); // handle 'import x as y'
    }
  }
  while ((match = fromRegex.exec(content)) !== null) {
    imports.push({ raw: match[0], target: match[1] });
  }

  return imports;
}

function extractJavaImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  const regex = /^import\s+(?:static\s+)?([^;]+);/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push({ raw: match[0], target: match[1].trim() });
  }
  return imports;
}

function extractGoImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  // Single import: import "fmt"
  const singleRegex = /^import\s+(?:[a-zA-Z0-9_.]+\s+)?['"]([^'"]+)['"]/gm;
  // Multiline import: import ( ... )
  const multiRegex = /^import\s*\(\s*([\s\S]*?)\s*\)/gm;

  let match;
  while ((match = singleRegex.exec(content)) !== null) {
    imports.push({ raw: match[0], target: match[1] });
  }
  while ((match = multiRegex.exec(content)) !== null) {
    const block = match[1];
    const stringRegex = /['"]([^'"]+)['"]/g;
    let blockMatch;
    while ((blockMatch = stringRegex.exec(block)) !== null) {
      imports.push({ raw: match[0], target: blockMatch[1] });
    }
  }

  return imports;
}

function extractRustImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  const useRegex = /^\s*use\s+([^;]+);/gm;
  const modRegex = /^\s*mod\s+([^;]+);/gm;

  let match;
  while ((match = useRegex.exec(content)) !== null) imports.push({ raw: match[0], target: match[1].trim() });
  while ((match = modRegex.exec(content)) !== null) imports.push({ raw: match[0], target: match[1].trim() });
  
  return imports;
}

function extractCSharpImports(content: string): RawImport[] {
  const imports: RawImport[] = [];
  const regex = /^\s*using\s+([^;=]+)(?:;|=)/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push({ raw: match[0], target: match[1].trim() });
  }
  return imports;
}

// ---------------------------------------------------------------------------
// Analyzer Engine
// ---------------------------------------------------------------------------

export async function analyzeImports(
  projectPath: string,
  categories: FileCategories
): Promise<ImportGraph> {
  const nodes: Map<string, ImportNode> = new Map();
  const edges: ImportEdge[] = [];
  const filesToScan = [...categories.source, ...categories.test];

  // Initialize nodes
  for (const file of filesToScan) {
    nodes.set(file, {
      filePath: file,
      language: getLanguage(file),
      importCount: 0,
      importedByCount: 0,
    });
  }

  // Set to track resolved files for fast lookup
  const fileSet = new Set(filesToScan);

  // Parse each file
  for (const file of filesToScan) {
    const fullPath = path.join(projectPath, file);
    const content = await readText(fullPath);
    if (!content) continue;

    const lang = getLanguage(file);
    let rawImports: RawImport[] = [];

    if (lang === 'typescript' || lang === 'javascript') rawImports = extractJsTsImports(content);
    else if (lang === 'python') rawImports = extractPythonImports(content);
    else if (lang === 'java') rawImports = extractJavaImports(content);
    else if (lang === 'go') rawImports = extractGoImports(content);
    else if (lang === 'rust') rawImports = extractRustImports(content);
    else if (lang === 'csharp') rawImports = extractCSharpImports(content);

    for (const imp of rawImports) {
      // 1. Determine if relative
      const isRelative = isRelativeImport(imp.target, lang);
      
      // 2. Resolve to actual file if relative
      let resolvedTarget = imp.target;
      if (isRelative) {
        resolvedTarget = resolveRelativeImport(file, imp.target, lang, fileSet);
      }

      // Add edge
      edges.push({
        from: file,
        to: resolvedTarget,
        importedSymbols: [], // We'd need AST to reliably get this
        isRelative,
      });

      // Update node counts
      const fromNode = nodes.get(file);
      if (fromNode) fromNode.importCount++;

      if (isRelative && nodes.has(resolvedTarget)) {
        const toNode = nodes.get(resolvedTarget);
        if (toNode) toNode.importedByCount++;
      }
    }
  }

  const finalNodes = Array.from(nodes.values());
  const circularDeps = detectCircularDependencies(finalNodes, edges);

  return {
    nodes: finalNodes,
    edges,
    circularDeps,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (['.ts', '.tsx', '.mts', '.cts'].includes(ext)) return 'typescript';
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (ext === '.py') return 'python';
  if (ext === '.java') return 'java';
  if (ext === '.go') return 'go';
  if (ext === '.rs') return 'rust';
  if (ext === '.cs') return 'csharp';
  return 'unknown';
}

function isRelativeImport(target: string, lang: string): boolean {
  if (lang === 'typescript' || lang === 'javascript') {
    return target.startsWith('.') || target.startsWith('/') || target.startsWith('@/') || target.startsWith('~/');
  }
  if (lang === 'python') {
    return target.startsWith('.');
  }
  if (lang === 'go') {
    return target.startsWith('.') || target.includes('/'); // Module imports often look like relative but aren't strictly
  }
  // For Java, Rust, C# it's usually namespace/module based, not file path based.
  // We'll treat them as non-relative by default unless we do complex namespace mapping.
  return false;
}

function checkPath(basePath: string, fileSet: Set<string>): string | null {
  if (fileSet.has(basePath)) return basePath;
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cjs', '/index.ts', '/index.js'];
  for (const ext of exts) {
    const testPath = basePath.endsWith(ext) ? basePath : basePath + ext;
    if (fileSet.has(testPath)) return testPath;
  }
  return null;
}

function resolveRelativeImport(
  sourceFile: string,
  target: string,
  lang: string,
  fileSet: Set<string>
): string {
  if (lang === 'typescript' || lang === 'javascript') {
    let resolved = target;

    // Handle path aliases
    if (target.startsWith('@/') || target.startsWith('~/')) {
      const remainder = target.substring(2); // remove @/ or ~/
      
      // Typical monorepo/app structures for aliases
      const possibleRoots = ['src', 'app', 'lib', ''];
      for (const root of possibleRoots) {
        const testPath = normalizePath(path.join(root, remainder));
        const matched = checkPath(testPath, fileSet);
        if (matched) return matched;
      }
      
      // Fallback
      resolved = normalizePath(path.join('src', remainder));
    } else {
      // Basic resolution: join path
      const dir = path.dirname(sourceFile);
      resolved = normalizePath(path.join(dir, target));
    }
    
    return checkPath(resolved, fileSet) || resolved;
  }
  
  if (lang === 'python') {
    // Relative imports in python: from . import X -> ./X.py or ./X/__init__.py
    // This is a naive resolution
    const dir = path.dirname(sourceFile);
    const targetPath = target.replace(/\./g, '/'); // .utils -> utils, ..utils -> ../utils
    let resolved = normalizePath(path.join(dir, targetPath));
    
    if (fileSet.has(resolved + '.py')) return resolved + '.py';
    if (fileSet.has(resolved + '/__init__.py')) return resolved + '/__init__.py';
    
    return resolved;
  }

  return target;
}

// ---------------------------------------------------------------------------
// Cycle Detection (Tarjan's strongly connected components)
// ---------------------------------------------------------------------------

function detectCircularDependencies(nodes: ImportNode[], edges: ImportEdge[]): string[][] {
  const adjList = new Map<string, string[]>();
  
  // Build adjacency list for relative internal imports only
  for (const node of nodes) {
    adjList.set(node.filePath, []);
  }
  
  for (const edge of edges) {
    if (edge.isRelative && adjList.has(edge.from) && adjList.has(edge.to)) {
      adjList.get(edge.from)!.push(edge.to);
    }
  }

  let index = 0;
  const stack: string[] = [];
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const sccs: string[][] = [];

  function strongconnect(v: string) {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adjList.get(v) || [];
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      
      // We only care about cycles (SCCs with more than 1 node)
      if (scc.length > 1) {
        sccs.push(scc);
      }
    }
  }

  for (const node of nodes) {
    if (!indices.has(node.filePath)) {
      strongconnect(node.filePath);
    }
  }

  return sccs;
}
