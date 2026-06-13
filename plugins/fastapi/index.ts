// ============================================================================
// Official Plugin: FastAPI
// ============================================================================

import type {
  ProjectMindPlugin,
  PluginContext,
  PluginContribution,
  ExplainContext,
  ExplainSection,
} from '../../src/types/plugin.js';
import type { Component } from '../../src/types/index.js';

const FASTAPI_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-fastapi',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'FastAPI',
  priority: 200,
  capabilities: ['architecture', 'explain'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const sourceFiles = context.evidence.sourceCode.fileCategories.source.filter(f => f.endsWith('.py'));

    for (const file of sourceFiles) {
      let type: Component['type'] = 'other';
      if (file.includes('routers/')) type = 'controller';
      else if (file.includes('dependencies')) type = 'service';
      else if (file.includes('models')) type = 'model';
      else if (file.includes('schemas')) type = 'dto';

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.py', '') || 'Unknown';
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
    const isFastAPI = context.node.label.includes('Router') || context.node.label.includes('Schema');
    if (!isFastAPI) return [];

    return [
      {
        title: 'FastAPI Router',
        content: `This component relies on Pydantic schemas and FastAPI DI.`,
      }
    ];
  }
};

export default FASTAPI_PLUGIN;
