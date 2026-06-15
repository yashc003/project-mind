// ============================================================================
// Project-Mind Community Plugin Template
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// If building against project-mind natively, you would import these from '@project-mind/core'
// For this template, we define structural stubs for type checking
export interface PluginContext {
  projectPath: string;
  evidence: {
    sourceCode: {
      fileCategories: Record<string, string[]>;
    };
  };
}
export interface PluginContribution {
  source: string;
  components: any[];
  workflows: any[];
}
export interface ExplainContext {
  node: { label: string; [key: string]: any };
}
export interface ExplainSection {
  title: string;
  content: string;
}

const MY_PLUGIN = {
  name: 'my-project-mind-plugin',
  version: '1.0.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'Custom',
  priority: 500,
  capabilities: ['architecture', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: any[] = [];
    const workflows: any[] = [];
    
    // Example: Looking for .txt files as components
    const sourceFiles = context.evidence.sourceCode.fileCategories.source || [];
    for (const file of sourceFiles) {
      if (file.endsWith('.txt')) {
        components.push({
          name: path.basename(file, '.txt'),
          type: 'other',
          directory: path.dirname(file),
          files: [file],
          confidence: 0.9,
        });
      }
    }

    return {
      source: this.name,
      components,
      workflows,
    };
  },

  onExplain(context: ExplainContext): ExplainSection[] {
    return [];
  }
};

export default MY_PLUGIN;
