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
import type { Component } from '../../src/types/index.js';

const REACT_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-react',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'React',
  priority: 150,
  capabilities: ['architecture', 'explain'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
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
    }

    return {
      source: this.name,
      components,
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
