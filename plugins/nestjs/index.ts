// ============================================================================
// Official Plugin: NestJS
// ============================================================================

import type {
  ProjectMindPlugin,
  PluginContext,
  PluginContribution,
  ExplainContext,
  ExplainSection,
} from '../../src/types/plugin.js';
import type { Component } from '../../src/types/index.js';

const NESTJS_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-nestjs',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'NestJS',
  priority: 250,
  capabilities: ['architecture', 'explain'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const sourceFiles = context.evidence.sourceCode.fileCategories.source.filter(f => f.endsWith('.ts'));

    for (const file of sourceFiles) {
      let type: Component['type'] = 'other';
      if (file.includes('.module.')) type = 'other'; // Module
      else if (file.includes('.controller.')) type = 'controller';
      else if (file.includes('.service.') || file.includes('.provider.')) type = 'service';
      else if (file.includes('.guard.')) type = 'middleware'; // Guard
      else if (file.includes('.interceptor.')) type = 'middleware'; // Interceptor
      else if (file.includes('.pipe.')) type = 'utility'; // Pipe
      else if (file.includes('.dto.')) type = 'dto'; // DTO
      else if (file.includes('.decorator.')) type = 'utility'; // Decorator

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.ts', '') || 'Unknown';
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
    const isNestJS = context.node.label.includes('Module') || context.node.label.includes('Provider');
    if (!isNestJS) return [];

    return [
      {
        title: 'NestJS Architecture',
        content: `This component relies on NestJS IoC and Decorators.`,
      }
    ];
  }
};

export default NESTJS_PLUGIN;
