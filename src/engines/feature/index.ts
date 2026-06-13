// ============================================================================
// Feature Intelligence Engine
// ============================================================================
// Groups files into logical features using directory clustering, naming
// conventions, and import relationships.
// ============================================================================

import path from 'node:path';
import crypto from 'node:crypto';
import type {
  EvidenceSources,
  ArchitectureModel,
  Feature,
} from '../../types/index.js';

export function detectFeatures(
  evidence: EvidenceSources,
  architecture: ArchitectureModel
): Feature[] {
  const features = new Map<string, Feature>();
  const files = evidence.sourceCode.fileCategories.source;

  // 1. Cluster by shared prefixes (e.g., auth-service, auth-controller -> 'auth')
  const prefixMap = new Map<string, Set<string>>();
  
  for (const file of files) {
    const basename = path.basename(file, path.extname(file));
    
    // Look for common separators like '-', '_', '.'
    const parts = basename.split(/[-_.]/);
    if (parts.length > 1) {
      const prefix = parts[0].toLowerCase();
      // Ignore common generic prefixes
      if (!['index', 'main', 'app', 'base', 'core', 'shared', 'common'].includes(prefix)) {
        if (!prefixMap.has(prefix)) prefixMap.set(prefix, new Set());
        prefixMap.get(prefix)!.add(file);
      }
    }
  }

  // 2. Cluster by leaf directory name
  const dirMap = new Map<string, Set<string>>();
  
  for (const file of files) {
    const dir = path.dirname(file);
    if (dir !== '.' && dir !== '/') {
      const leafDir = path.basename(dir).toLowerCase();
      // Ignore architectural directories
      if (!['src', 'lib', 'controllers', 'services', 'models', 'utils', 'components'].includes(leafDir)) {
        if (!dirMap.has(leafDir)) dirMap.set(leafDir, new Set());
        dirMap.get(leafDir)!.add(file);
      }
    }
  }

  // 3. Create features from clusters (minimum 2 files to form a feature)
  for (const [prefix, featureFiles] of prefixMap.entries()) {
    if (featureFiles.size >= 2) {
      features.set(prefix, createFeatureObject(prefix, Array.from(featureFiles), architecture));
    }
  }

  for (const [dir, featureFiles] of dirMap.entries()) {
    if (featureFiles.size >= 2) {
      // Merge with prefix if exists
      if (features.has(dir)) {
        const existing = features.get(dir)!;
        for (const f of featureFiles) {
          if (!existing.files.includes(f)) existing.files.push(f);
        }
      } else {
        features.set(dir, createFeatureObject(dir, Array.from(featureFiles), architecture));
      }
    }
  }

  // 4. Resolve dependencies between features using the import graph
  const graph = evidence.sourceCode.importGraph;
  if (graph) {
    const fileToFeature = new Map<string, string>();
    for (const [name, feat] of features.entries()) {
      for (const file of feat.files) {
        fileToFeature.set(file, name);
      }
    }

    for (const edge of graph.edges) {
      if (!edge.isRelative) continue;
      
      const fromFeature = fileToFeature.get(edge.from);
      const toFeature = fileToFeature.get(edge.to);

      if (fromFeature && toFeature && fromFeature !== toFeature) {
        const feat = features.get(fromFeature)!;
        if (!feat.dependencies.includes(toFeature)) {
          feat.dependencies.push(toFeature);
        }
      }
    }
  }

  return Array.from(features.values()).sort((a, b) => b.files.length - a.files.length);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFeatureObject(
  name: string,
  files: string[],
  architecture: ArchitectureModel
): Feature {
  const components = new Set<string>();

  // Map files to their architectural components
  for (const file of files) {
    for (const comp of architecture.components) {
      if (comp.files.includes(file)) {
        components.add(comp.name);
      }
    }
  }

  // Capitalize name
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    id: crypto.randomBytes(4).toString('hex'),
    name: displayName,
    files,
    components: Array.from(components),
    dependencies: [],
    status: 'active', // In a full version, we'd check git dates to see if it's stale
    confidence: 60 + Math.min(files.length * 5, 30), // More files = higher confidence it's a real feature
  };
}
