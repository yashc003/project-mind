// ============================================================================
// Config Loader (v0.3)
// ============================================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProjectMindConfig } from '../types/index.js';
import { fileExists, readJson } from './fs.js';

export async function loadStaticConfig(projectPath: string, defaultConfig: ProjectMindConfig): Promise<ProjectMindConfig> {
  const configPath = path.join(projectPath, '.project-mind.json');
  
  if (!(await fileExists(configPath))) {
    return defaultConfig;
  }

  try {
    const customConfig = await readJson<Partial<ProjectMindConfig>>(configPath);
    return {
      ...defaultConfig,
      ...customConfig,
      customArchitectureRules: [
        ...(defaultConfig.customArchitectureRules || []),
        ...(customConfig?.customArchitectureRules || [])
      ]
    };
  } catch (err) {
    // If invalid JSON, fallback to default and maybe log warning (though we don't inject logger here directly)
    return defaultConfig;
  }
}
