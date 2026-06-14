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
  ProjectMindConfig,
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
 * Collects build evidence from the project directory, supporting monorepos.
 */
export async function collectBuildEvidence(projectPath: string, config: ProjectMindConfig): Promise<BuildEvidence> {
  const evidence: BuildEvidence = {
    buildSystems: [],
    dependencies: [],
    frameworks: [],
    scripts: [],
    packageManager: null,
  };

  const fg = (await import('fast-glob')).default;
  const ignorePatterns = config.ignoreDirs.map(d => `**/${d}/**`);

  const buildFiles = await fg([
    '**/package.json',
    '**/requirements.txt',
    '**/pyproject.toml',
    '**/setup.py',
    '**/pom.xml',
    '**/build.gradle',
    '**/build.gradle.kts',
    '**/go.mod',
    '**/Cargo.toml',
    '**/*.csproj',
    '**/*.sln',
    '**/Dockerfile',
    '**/docker-compose.yml',
    '**/docker-compose.yaml'
  ], {
    cwd: projectPath,
    ignore: ignorePatterns,
    deep: config.maxDepth,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  // Run all collectors in parallel
  await Promise.all([
    collectNodeEvidence(projectPath, evidence, buildFiles.filter(f => f.endsWith('package.json'))),
    collectPythonEvidence(projectPath, evidence, buildFiles.filter(f => ['requirements.txt', 'pyproject.toml', 'setup.py'].some(ext => f.endsWith(ext)))),
    collectJavaEvidence(projectPath, evidence, buildFiles.filter(f => ['pom.xml', 'build.gradle', 'build.gradle.kts'].some(ext => f.endsWith(ext)))),
    collectGoEvidence(projectPath, evidence, buildFiles.filter(f => f.endsWith('go.mod'))),
    collectRustEvidence(projectPath, evidence, buildFiles.filter(f => f.endsWith('Cargo.toml'))),
    collectDotNetEvidence(projectPath, evidence, buildFiles.filter(f => f.endsWith('.csproj') || f.endsWith('.sln'))),
    collectDockerEvidence(projectPath, evidence, buildFiles.filter(f => f.endsWith('Dockerfile') || f.includes('docker-compose'))),
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
  files: string[],
): Promise<void> {
  for (const file of files) {
    const pkgPath = path.join(projectPath, file);
    const pkg = await readJson<PackageJson>(pkgPath);
    if (!pkg) continue;

    evidence.buildSystems.push({
      name: 'npm',
      configFile: file,
      language: 'JavaScript/TypeScript',
    });

    // Detect package manager from root package.json or if not set yet
    if (file === 'package.json' || !evidence.packageManager) {
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
    }

    // Collect dependencies
    const addDeps = (deps: Record<string, string> | undefined, type: DependencyInfo['type']) => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        evidence.dependencies.push({ name, version, type, source: file });
      }
    };
    addDeps(pkg.dependencies, 'production');
    addDeps(pkg.devDependencies, 'development');
    addDeps(pkg.peerDependencies, 'peer');
    addDeps(pkg.optionalDependencies, 'optional');

    // Collect scripts
    if (pkg.scripts) {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        evidence.scripts.push({ name, command, source: file });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

async function collectPythonEvidence(
  projectPath: string,
  evidence: BuildEvidence,
  files: string[],
): Promise<void> {
  for (const file of files) {
    const fullPath = path.join(projectPath, file);
    
    if (file.endsWith('requirements.txt')) {
      const reqContent = await readText(fullPath);
      if (reqContent) {
        evidence.buildSystems.push({
          name: 'pip',
          configFile: file,
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
                source: file,
              });
            }
          }
        }
      }
    } else if (file.endsWith('pyproject.toml')) {
      evidence.buildSystems.push({
        name: 'pyproject',
        configFile: file,
        language: 'Python',
      });
    } else if (file.endsWith('setup.py')) {
      evidence.buildSystems.push({
        name: 'setuptools',
        configFile: file,
        language: 'Python',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Java / Kotlin
// ---------------------------------------------------------------------------

async function collectJavaEvidence(
  projectPath: string,
  evidence: BuildEvidence,
  files: string[],
): Promise<void> {
  for (const file of files) {
    const fullPath = path.join(projectPath, file);

    if (file.endsWith('pom.xml')) {
      evidence.buildSystems.push({
        name: 'Maven',
        configFile: file,
        language: 'Java',
      });
      const pomContent = await readText(fullPath);
      if (pomContent) {
        const depRegex = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>(?:\s*<version>([^<]+)<\/version>)?/g;
        let match;
        while ((match = depRegex.exec(pomContent)) !== null) {
          const artifactId = match[2];
          const version = match[3] || 'latest';
          evidence.dependencies.push({
            name: artifactId,
            version: version,
            type: 'production',
            source: file,
          });
        }
      }
    } else if (file.endsWith('build.gradle') || file.endsWith('build.gradle.kts')) {
      evidence.buildSystems.push({
        name: 'Gradle',
        configFile: file,
        language: file.endsWith('.kts') ? 'Kotlin' : 'Java',
      });
      await parseGradleDependencies(fullPath, evidence);
    }
  }
}

async function parseGradleDependencies(filePath: string, evidence: BuildEvidence): Promise<void> {
  const content = await readText(filePath);
  if (!content) return;
  // Match `implementation 'org.jsoup:jsoup:1.15.3'` or `implementation("org.jsoup:jsoup:1.15.3")`
  const depRegex = /(?:implementation|api|compile|testImplementation)\s*\(?['"]([^:'"]+):([^:'"]+)(?::([^:'"]+))?['"]\)?/g;
  let match;
  while ((match = depRegex.exec(content)) !== null) {
    const artifactId = match[2];
    const version = match[3] || 'latest';
    evidence.dependencies.push({
      name: artifactId,
      version: version,
      type: 'production',
      source: path.basename(filePath),
    });
  }
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

async function collectGoEvidence(
  projectPath: string,
  evidence: BuildEvidence,
  files: string[],
): Promise<void> {
  for (const file of files) {
    const fullPath = path.join(projectPath, file);
    const goModContent = await readText(fullPath);
    if (!goModContent) continue;

    evidence.buildSystems.push({
      name: 'Go Modules',
      configFile: file,
      language: 'Go',
    });

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
            source: file,
          });
        }
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
  files: string[],
): Promise<void> {
  for (const file of files) {
    evidence.buildSystems.push({
      name: 'Cargo',
      configFile: file,
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
  files: string[],
): Promise<void> {
  for (const file of files) {
    if (file.endsWith('.csproj')) {
      evidence.buildSystems.push({
        name: '.NET',
        configFile: file,
        language: 'C#',
      });
    } else if (file.endsWith('.sln')) {
      evidence.buildSystems.push({
        name: '.NET Solution',
        configFile: file,
        language: 'C#',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Docker
// ---------------------------------------------------------------------------

async function collectDockerEvidence(
  projectPath: string,
  evidence: BuildEvidence,
  files: string[],
): Promise<void> {
  for (const file of files) {
    if (file.endsWith('Dockerfile')) {
      evidence.buildSystems.push({
        name: 'Docker',
        configFile: file,
        language: 'Container',
      });
    } else if (file.includes('docker-compose')) {
      evidence.buildSystems.push({
        name: 'Docker Compose',
        configFile: file,
        language: 'Container',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Framework detection from collected dependencies
// ---------------------------------------------------------------------------

function detectFrameworks(evidence: BuildEvidence): void {
  const seen = new Set<string>();
  for (const dep of evidence.dependencies) {
    // Treat devDependencies with lower confidence so backend projects aren't
    // misclassified as React just because they have a tiny react script.
    const isDev = dep.type === 'development';
    
    const lowerName = dep.name.toLowerCase();
    const fingerprint = FRAMEWORK_FINGERPRINTS[lowerName];
    if (fingerprint && !seen.has(lowerName)) {
      seen.add(lowerName);
      
      const confidenceScore = isDev ? fingerprint.confidence - 20 : fingerprint.confidence;
      
      evidence.frameworks.push({
        name: dep.name,
        version: dep.version,
        category: fingerprint.category,
        confidence: confidenceScore,
      });
    }
  }
  // Sort frameworks by confidence
  evidence.frameworks.sort((a, b) => b.confidence - a.confidence);
}
