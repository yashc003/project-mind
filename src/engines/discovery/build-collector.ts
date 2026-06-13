// ============================================================================
// Build File Collector
// ============================================================================
// Detects build systems, package managers, dependencies, frameworks, and
// scripts from common build/config files across multiple ecosystems.
// ============================================================================

import path from 'node:path';
import type {
  BuildEvidence,
  BuildSystem,
  DependencyInfo,
  FrameworkInfo,
  ScriptInfo,
} from '../../types/index.js';
import { readJson, readText, fileExists } from '../../utils/fs.js';

// ---------------------------------------------------------------------------
// Known framework fingerprints
// ---------------------------------------------------------------------------

const FRAMEWORK_FINGERPRINTS: Record<string, {
  category: FrameworkInfo['category'];
  confidence: number;
}> = {
  // Web frameworks
  'react': { category: 'web', confidence: 95 },
  'react-dom': { category: 'web', confidence: 95 },
  'next': { category: 'web', confidence: 95 },
  'vue': { category: 'web', confidence: 95 },
  'nuxt': { category: 'web', confidence: 95 },
  'angular': { category: 'web', confidence: 90 },
  '@angular/core': { category: 'web', confidence: 95 },
  'svelte': { category: 'web', confidence: 95 },
  'solid-js': { category: 'web', confidence: 90 },
  // API/Backend
  'express': { category: 'api', confidence: 95 },
  'fastify': { category: 'api', confidence: 95 },
  'koa': { category: 'api', confidence: 90 },
  'hapi': { category: 'api', confidence: 90 },
  'nestjs': { category: 'api', confidence: 90 },
  '@nestjs/core': { category: 'api', confidence: 95 },
  'spring-boot': { category: 'api', confidence: 95 },
  'django': { category: 'api', confidence: 95 },
  'flask': { category: 'api', confidence: 95 },
  'fastapi': { category: 'api', confidence: 95 },
  'gin-gonic': { category: 'api', confidence: 90 },
  'actix-web': { category: 'api', confidence: 90 },
  // Testing
  'jest': { category: 'testing', confidence: 90 },
  'vitest': { category: 'testing', confidence: 90 },
  'mocha': { category: 'testing', confidence: 85 },
  'pytest': { category: 'testing', confidence: 90 },
  'junit': { category: 'testing', confidence: 90 },
  'cypress': { category: 'testing', confidence: 90 },
  'playwright': { category: 'testing', confidence: 90 },
  // Build
  'webpack': { category: 'build', confidence: 85 },
  'vite': { category: 'build', confidence: 90 },
  'rollup': { category: 'build', confidence: 85 },
  'esbuild': { category: 'build', confidence: 85 },
  'tsup': { category: 'build', confidence: 85 },
  'turbopack': { category: 'build', confidence: 85 },
  // Database
  'prisma': { category: 'database', confidence: 90 },
  '@prisma/client': { category: 'database', confidence: 90 },
  'mongoose': { category: 'database', confidence: 90 },
  'typeorm': { category: 'database', confidence: 90 },
  'sequelize': { category: 'database', confidence: 90 },
  'drizzle-orm': { category: 'database', confidence: 90 },
  'knex': { category: 'database', confidence: 85 },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collects build evidence from the project directory.
 */
export async function collectBuildEvidence(projectPath: string): Promise<BuildEvidence> {
  const evidence: BuildEvidence = {
    buildSystems: [],
    dependencies: [],
    frameworks: [],
    scripts: [],
    packageManager: null,
  };

  // Run all collectors in parallel
  await Promise.all([
    collectNodeEvidence(projectPath, evidence),
    collectPythonEvidence(projectPath, evidence),
    collectJavaEvidence(projectPath, evidence),
    collectGoEvidence(projectPath, evidence),
    collectRustEvidence(projectPath, evidence),
    collectDotNetEvidence(projectPath, evidence),
    collectDockerEvidence(projectPath, evidence),
  ]);

  // Detect frameworks from dependencies
  detectFrameworks(evidence);

  return evidence;
}

// ---------------------------------------------------------------------------
// Node.js / npm
// ---------------------------------------------------------------------------

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  packageManager?: string;
}

async function collectNodeEvidence(
  projectPath: string,
  evidence: BuildEvidence,
): Promise<void> {
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = await readJson<PackageJson>(pkgPath);
  if (!pkg) return;

  evidence.buildSystems.push({
    name: 'npm',
    configFile: 'package.json',
    language: 'JavaScript/TypeScript',
  });

  // Detect package manager
  if (pkg.packageManager) {
    evidence.packageManager = pkg.packageManager.split('@')[0];
  } else if (await fileExists(path.join(projectPath, 'yarn.lock'))) {
    evidence.packageManager = 'yarn';
  } else if (await fileExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
    evidence.packageManager = 'pnpm';
  } else if (await fileExists(path.join(projectPath, 'bun.lockb'))) {
    evidence.packageManager = 'bun';
  } else {
    evidence.packageManager = 'npm';
  }

  // Collect dependencies
  const addDeps = (deps: Record<string, string> | undefined, type: DependencyInfo['type']) => {
    if (!deps) return;
    for (const [name, version] of Object.entries(deps)) {
      evidence.dependencies.push({ name, version, type, source: 'package.json' });
    }
  };
  addDeps(pkg.dependencies, 'production');
  addDeps(pkg.devDependencies, 'development');
  addDeps(pkg.peerDependencies, 'peer');
  addDeps(pkg.optionalDependencies, 'optional');

  // Collect scripts
  if (pkg.scripts) {
    for (const [name, command] of Object.entries(pkg.scripts)) {
      evidence.scripts.push({ name, command, source: 'package.json' });
    }
  }
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

async function collectPythonEvidence(
  projectPath: string,
  evidence: BuildEvidence,
): Promise<void> {
  // requirements.txt
  const reqPath = path.join(projectPath, 'requirements.txt');
  const reqContent = await readText(reqPath);
  if (reqContent) {
    evidence.buildSystems.push({
      name: 'pip',
      configFile: 'requirements.txt',
      language: 'Python',
    });
    for (const line of reqContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*(?:[><=!~]+\s*(.+))?/);
        if (match) {
          evidence.dependencies.push({
            name: match[1],
            version: match[2] || '*',
            type: 'production',
            source: 'requirements.txt',
          });
        }
      }
    }
  }

  // pyproject.toml (basic detection)
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fileExists(pyprojectPath)) {
    evidence.buildSystems.push({
      name: 'pyproject',
      configFile: 'pyproject.toml',
      language: 'Python',
    });
  }

  // setup.py
  if (await fileExists(path.join(projectPath, 'setup.py'))) {
    evidence.buildSystems.push({
      name: 'setuptools',
      configFile: 'setup.py',
      language: 'Python',
    });
  }
}

// ---------------------------------------------------------------------------
// Java / Kotlin
// ---------------------------------------------------------------------------

async function collectJavaEvidence(
  projectPath: string,
  evidence: BuildEvidence,
): Promise<void> {
  // pom.xml (Maven)
  if (await fileExists(path.join(projectPath, 'pom.xml'))) {
    evidence.buildSystems.push({
      name: 'Maven',
      configFile: 'pom.xml',
      language: 'Java',
    });
  }

  // build.gradle / build.gradle.kts (Gradle)
  if (await fileExists(path.join(projectPath, 'build.gradle'))) {
    evidence.buildSystems.push({
      name: 'Gradle',
      configFile: 'build.gradle',
      language: 'Java',
    });
  } else if (await fileExists(path.join(projectPath, 'build.gradle.kts'))) {
    evidence.buildSystems.push({
      name: 'Gradle',
      configFile: 'build.gradle.kts',
      language: 'Kotlin',
    });
  }
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

async function collectGoEvidence(
  projectPath: string,
  evidence: BuildEvidence,
): Promise<void> {
  const goModPath = path.join(projectPath, 'go.mod');
  const goModContent = await readText(goModPath);
  if (!goModContent) return;

  evidence.buildSystems.push({
    name: 'Go Modules',
    configFile: 'go.mod',
    language: 'Go',
  });

  // Parse basic dependencies from go.mod
  const lines = goModContent.split('\n');
  let inRequire = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'require (') {
      inRequire = true;
      continue;
    }
    if (trimmed === ')') {
      inRequire = false;
      continue;
    }
    if (inRequire) {
      const match = trimmed.match(/^(\S+)\s+(\S+)/);
      if (match) {
        evidence.dependencies.push({
          name: match[1],
          version: match[2],
          type: 'production',
          source: 'go.mod',
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rust
// ---------------------------------------------------------------------------

async function collectRustEvidence(
  projectPath: string,
  evidence: BuildEvidence,
): Promise<void> {
  if (await fileExists(path.join(projectPath, 'Cargo.toml'))) {
    evidence.buildSystems.push({
      name: 'Cargo',
      configFile: 'Cargo.toml',
      language: 'Rust',
    });
  }
}

// ---------------------------------------------------------------------------
// .NET
// ---------------------------------------------------------------------------

async function collectDotNetEvidence(
  projectPath: string,
  evidence: BuildEvidence,
): Promise<void> {
  // Look for *.csproj or *.sln
  const fg = (await import('fast-glob')).default;
  const csprojFiles = await fg('*.csproj', { cwd: projectPath });
  if (csprojFiles.length > 0) {
    evidence.buildSystems.push({
      name: '.NET',
      configFile: csprojFiles[0],
      language: 'C#',
    });
  }

  const slnFiles = await fg('*.sln', { cwd: projectPath });
  if (slnFiles.length > 0 && csprojFiles.length === 0) {
    evidence.buildSystems.push({
      name: '.NET Solution',
      configFile: slnFiles[0],
      language: 'C#',
    });
  }
}

// ---------------------------------------------------------------------------
// Docker
// ---------------------------------------------------------------------------

async function collectDockerEvidence(
  projectPath: string,
  evidence: BuildEvidence,
): Promise<void> {
  if (await fileExists(path.join(projectPath, 'Dockerfile'))) {
    evidence.buildSystems.push({
      name: 'Docker',
      configFile: 'Dockerfile',
      language: 'Container',
    });
  }
  if (await fileExists(path.join(projectPath, 'docker-compose.yml')) ||
      await fileExists(path.join(projectPath, 'docker-compose.yaml'))) {
    evidence.buildSystems.push({
      name: 'Docker Compose',
      configFile: 'docker-compose.yml',
      language: 'Container',
    });
  }
}

// ---------------------------------------------------------------------------
// Framework detection from collected dependencies
// ---------------------------------------------------------------------------

function detectFrameworks(evidence: BuildEvidence): void {
  const seen = new Set<string>();
  for (const dep of evidence.dependencies) {
    const lowerName = dep.name.toLowerCase();
    const fingerprint = FRAMEWORK_FINGERPRINTS[lowerName];
    if (fingerprint && !seen.has(lowerName)) {
      seen.add(lowerName);
      evidence.frameworks.push({
        name: dep.name,
        version: dep.version,
        category: fingerprint.category,
        confidence: fingerprint.confidence,
      });
    }
  }
  // Sort frameworks by confidence
  evidence.frameworks.sort((a, b) => b.confidence - a.confidence);
}
