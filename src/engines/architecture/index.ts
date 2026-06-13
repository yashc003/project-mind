// ============================================================================
// Architecture Engine — Heuristic Detection
// ============================================================================
// Infers project architecture from directory naming conventions, file
// categorization, and framework detection. No AST parsing — this is purely
// heuristic-based for v0.1.
// ============================================================================

import type {
  EvidenceSources,
  ArchitectureModel,
  ArchitecturePattern,
  ArchitectureLayer,
  Component,
  ComponentType,
  LayerType,
  ComponentDependency,
} from '../../types/index.js';
import logger from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Directory → Component mapping rules
// ---------------------------------------------------------------------------

export interface DirectoryRule {
  /** Directory name patterns (case-insensitive match) */
  patterns: string[];
  /** Component type to assign */
  componentType: ComponentType;
  /** Architecture layer this belongs to */
  layerType: LayerType;
  /** Human-readable layer name */
  layerName: string;
}

const DIRECTORY_RULES: DirectoryRule[] = [
  // Presentation / UI
  {
    patterns: ['components', 'component', 'ui', 'widgets', 'app', 'pages', 'views', 'screens', 'layouts'],
    componentType: 'component',
    layerType: 'presentation',
    layerName: 'UI Components',
  },

  // API / Controller
  {
    patterns: ['controllers', 'controller', 'routes', 'route', 'api', 'endpoints', 'handlers', 'handler', 'actions'],
    componentType: 'controller',
    layerType: 'api',
    layerName: 'API / Controllers',
  },
  // Business Logic
  {
    patterns: ['services', 'service', 'providers', 'provider', 'usecases', 'use-cases', 'domain', 'logic', 'core', 'composables', 'hooks', 'store', 'modules'],
    componentType: 'service',
    layerType: 'business-logic',
    layerName: 'Business Logic / Services',
  },
  {
    patterns: ['middleware', 'middlewares', 'interceptors', 'guards', 'filters', 'pipes'],
    componentType: 'middleware',
    layerType: 'business-logic',
    layerName: 'Middleware',
  },
  // Data Access
  {
    patterns: ['repositories', 'repository', 'repos', 'dao', 'dal', 'data', 'database', 'db'],
    componentType: 'repository',
    layerType: 'data-access',
    layerName: 'Data Access',
  },
  {
    patterns: ['models', 'model', 'entities', 'entity', 'schemas', 'schema'],
    componentType: 'model',
    layerType: 'data-access',
    layerName: 'Data Models',
  },
  {
    patterns: ['dtos', 'dto', 'types', 'interfaces', 'contracts'],
    componentType: 'dto',
    layerType: 'data-access',
    layerName: 'DTOs / Types',
  },
  {
    patterns: ['migrations', 'migration', 'seeds', 'seed', 'fixtures'],
    componentType: 'migration',
    layerType: 'data-access',
    layerName: 'Migrations',
  },
  // Infrastructure
  {
    patterns: ['config', 'configs', 'configuration', 'settings'],
    componentType: 'config',
    layerType: 'infrastructure',
    layerName: 'Configuration',
  },
  // Utilities
  {
    patterns: ['utils', 'util', 'utilities', 'helpers', 'helper', 'lib', 'libs', 'common', 'shared', 'pkg', 'internal', 'cmd'],
    componentType: 'utility',
    layerType: 'utility',
    layerName: 'Utilities',
  },
  // Test
  {
    patterns: ['tests', 'test', '__tests__', 'spec', 'specs', 'e2e', 'integration'],
    componentType: 'test',
    layerType: 'test',
    layerName: 'Tests',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point for the Architecture Engine
 * @param evidence Processed evidence from discovery engines
 * @param customRules Optional custom architecture rules from config
 * @returns Inferred architecture model
 */
export function detectArchitecture(evidence: EvidenceSources, customRules: DirectoryRule[] = []): ArchitectureModel {
  const components: Component[] = [];
  const layers: ArchitectureLayer[] = [];

  // Extract all directories and check them against rules
  const dirs = extractDirectoryNames(evidence);
  
  // Merge rules, giving precedence to custom rules
  const allRules = [...customRules, ...DIRECTORY_RULES];

  for (const dir of dirs) {
    const rule = matchDirectoryRule(dir.name, allRules);
    if (rule) {
      // Add component
      components.push({
        name: dir.name,
        type: rule.componentType,
        directory: dir.path,
        files: dir.files || [],
        confidence: 75, // Heuristic detection baseline
      });

      // Track layer
      const existingLayer = layers.find(l => l.type === rule.layerType);
      if (existingLayer) {
        existingLayer.directories.push(dir.path);
        existingLayer.fileCount += dir.fileCount;
      } else {
        layers.push({
          name: rule.layerName,
          type: rule.layerType,
          directories: [dir.path],
          fileCount: dir.fileCount,
        });
      }
    }
  }

  // Detect architectural pattern from layers and frameworks
  const pattern = detectPattern(layers, evidence);

  // Calculate confidence
  const confidence = calculateArchitectureConfidence(layers, components, evidence);

  // Log detection results
  if (components.length > 0) {
    logger.kv('Architecture pattern', pattern || 'unknown');
    logger.kv('Detected layers', layers.length);
    logger.kv('Detected components', components.length);
    for (const layer of layers) {
      logger.bullet(`${layer.name}: ${layer.directories.join(', ')}`);
    }
  } else {
    logger.kv('Architecture', 'insufficient structure for detection');
  }

  // Calculate component dependencies from import graph (v0.2)
  const componentDependencies = calculateComponentDependencies(components, evidence);

  return {
    pattern,
    layers,
    components,
    componentDependencies,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Internal functions
// ---------------------------------------------------------------------------

interface DirInfo {
  name: string;
  path: string;
  fileCount: number;
  files: string[];
}

function extractDirectoryNames(evidence: EvidenceSources): DirInfo[] {
  const dirs: DirInfo[] = [];

  // Extract from directory structure
  for (const node of evidence.sourceCode.directoryStructure) {
    if (node.type === 'directory') {
      const childFiles = node.children
        ?.filter(c => c.type === 'file')
        .map(c => `${node.path}/${c.name}`) || [];

      dirs.push({
        name: node.name.toLowerCase(),
        path: node.path,
        fileCount: childFiles.length,
        files: childFiles,
      });

      // Also check second-level directories (e.g., src/controllers/)
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'directory') {
            const grandchildFiles = child.children
              ?.filter(c => c.type === 'file')
              .map(c => `${node.path}/${child.name}/${c.name}`) || [];

            dirs.push({
              name: child.name.toLowerCase(),
              path: `${node.path}/${child.name}`,
              fileCount: grandchildFiles.length,
              files: grandchildFiles,
            });
          }
        }
      }
    }
  }

  return dirs;
}

function matchDirectoryRule(dirName: string, rules: DirectoryRule[] = DIRECTORY_RULES): DirectoryRule | null {
  const lowerName = dirName.toLowerCase();
  for (const rule of rules) {
    if (rule.patterns.includes(lowerName)) {
      return rule;
    }
  }
  return null;
}

function detectPattern(
  layers: ArchitectureLayer[],
  evidence: EvidenceSources,
): ArchitecturePattern | null {
  const layerTypes = new Set(layers.map(l => l.type));

  // Check for common frameworks that imply patterns
  const frameworkNames = evidence.buildFiles.frameworks.map(f => f.name.toLowerCase());

  // React/Vue/Angular → component-based
  if (frameworkNames.some(f => ['react', 'react-dom', 'vue', 'angular', '@angular/core', 'svelte'].includes(f))) {
    if (layerTypes.has('api') || layerTypes.has('business-logic')) {
      return 'layered';
    }
    return 'component-based';
  }

  // NestJS, Spring → layered
  if (frameworkNames.some(f => ['@nestjs/core', 'nestjs', 'spring-boot'].includes(f))) {
    return 'layered';
  }

  // MVC pattern detection
  if (layerTypes.has('api') && layerTypes.has('data-access') && layerTypes.has('presentation')) {
    return 'mvc';
  }

  // Layered detection
  if (layerTypes.has('api') && layerTypes.has('business-logic') && layerTypes.has('data-access')) {
    return 'layered';
  }

  // Simple modular
  if (layers.length >= 2) {
    return 'modular';
  }

  if (layers.length > 0) {
    return 'monolith';
  }

  return null;
}

function calculateArchitectureConfidence(
  layers: ArchitectureLayer[],
  components: Component[],
  evidence: EvidenceSources,
): number {
  let confidence = 0;

  // More layers = higher confidence
  if (layers.length >= 3) confidence += 30;
  else if (layers.length >= 2) confidence += 20;
  else if (layers.length >= 1) confidence += 10;

  // More components = higher confidence
  if (components.length >= 5) confidence += 25;
  else if (components.length >= 3) confidence += 15;
  else if (components.length >= 1) confidence += 5;

  // Frameworks boost confidence (we know what the project is)
  if (evidence.buildFiles.frameworks.length > 0) confidence += 20;

  // Build files present = structured project
  if (evidence.buildFiles.buildSystems.length > 0) confidence += 10;

  // Having many source files is a positive signal
  if (evidence.sourceCode.totalFiles > 20) confidence += 10;
  else if (evidence.sourceCode.totalFiles > 5) confidence += 5;

  // Cap at 95 since heuristic detection is never 100%
  return Math.min(confidence, 95);
}

function calculateComponentDependencies(
  components: Component[],
  evidence: EvidenceSources
): ComponentDependency[] {
  if (!evidence.sourceCode.importGraph) return [];

  // Map files to their components
  const fileToComponent = new Map<string, string>();
  for (const comp of components) {
    for (const file of comp.files) {
      fileToComponent.set(file, comp.name);
    }
  }

  // Aggregate edges between components
  const depMap = new Map<string, { count: number }>();

  for (const edge of evidence.sourceCode.importGraph.edges) {
    if (!edge.isRelative) continue;

    const fromComp = fileToComponent.get(edge.from);
    const toComp = fileToComponent.get(edge.to);

    // Only track cross-component dependencies
    if (fromComp && toComp && fromComp !== toComp) {
      const key = `${fromComp}->${toComp}`;
      const existing = depMap.get(key) || { count: 0 };
      existing.count++;
      depMap.set(key, existing);
    }
  }

  // Convert to ComponentDependency array
  const dependencies: ComponentDependency[] = [];
  for (const [key, data] of depMap.entries()) {
    const [from, to] = key.split('->');
    dependencies.push({
      from,
      to,
      type: 'imports',
      confidence: Math.min(100, 50 + data.count * 10), // Base 50, +10 per import
    });
  }

  return dependencies;
}
