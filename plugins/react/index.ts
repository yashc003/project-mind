// ============================================================================
// Official Plugin: React
// ============================================================================

import type {
  ProjectMindPlugin,
  PluginContext,
  PluginContribution,
  ExplainContext,

  ExplainSection,
} from '../../src/types/plugin.js';
import type { Component, Workflow } from '../../src/types/index.js';
import { readText } from '../../src/utils/fs.js';
import path from 'node:path';
import crypto from 'node:crypto';

const REACT_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-react',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'React',
  priority: 150,
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
    const sourceFiles = context.evidence.sourceCode.fileCategories.source.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

    for (const file of sourceFiles) {
      let type: Component['type'] = 'other';
      if (file.includes('hooks/')) type = 'utility'; // Custom Hook
      else if (file.includes('components/')) type = 'component';
      else if (file.includes('contexts/')) type = 'other'; // Context
      else if (file.includes('store/')) type = 'other'; // Redux Slice

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.tsx', '').replace('.jsx', '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        components.push({
          name,
          type,
          directory,
          files: [file],
          confidence: 0.8,
        });
      }

      // Workflow detection: Extract precise UI events instead of generic flows
      const fullPath = path.join(context.projectPath, file);
      const fs = await import('node:fs');
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Form Submissions
        const submitRegex = /onSubmit={([^}]+)}/g;
        let match;
        while ((match = submitRegex.exec(content)) !== null) {
          const handler = match[1].replace('() =>', '').trim();
          workflows.push({
            id: crypto.randomBytes(4).toString('hex'),
            name: `Form Submission: ${handler}`,
            description: `Triggered via onSubmit in ${file.split('/').pop()}`,
            entryPoint: file,
            dependencyScope: 'file',
            sourceFile: file.split('/').pop(),
            components: [],
            files: [file],
            confidence: 95,
            type: 'ui-flow'
          });
        }

        // Button Clicks (heuristic: looks for specific handlers)
        const clickRegex = /onClick={([^}]+)}/g;
        while ((match = clickRegex.exec(content)) !== null) {
          const handler = match[1].replace('() =>', '').trim();
          // Filter out inline arrow functions that are too simple
          if (handler && !handler.includes('set') && handler.length > 3) {
            workflows.push({
              id: crypto.randomBytes(4).toString('hex'),
              name: `Button Click: ${handler}`,
              description: `Triggered via onClick in ${file.split('/').pop()}`,
              entryPoint: file,
              dependencyScope: 'file',
              sourceFile: file.split('/').pop(),
              components: [],
              files: [file],
              confidence: 80,
              type: 'ui-flow'
            });
          }
        }
      } catch (e) {
        // ignore
      }
    }

    return {
      source: this.name,
      components,
      workflows,
    };
  },

  onExplain(context: ExplainContext): ExplainSection[] {
    const isReact = context.node.label.includes('Hook') || context.node.label.includes('Component');
    if (!isReact) return [];

    return [
      {
        title: 'React Details',
        content: `This is a React element. Ensure functional component purity.`,
      }
    ];
  }
};

export default REACT_PLUGIN;
