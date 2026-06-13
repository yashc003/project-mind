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
import { readText } from '../../src/utils/fs.js';
import path from 'node:path';

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
      const content = await readText(path.join(context.projectPath, file));
      if (!content) continue;
      
      let type: Component['type'] = 'other';
      if (file.includes('.module.') || content.includes('@Module(')) type = 'other'; // Module
      else if (file.includes('.controller.') || content.includes('@Controller(')) type = 'controller';
      else if (file.includes('.service.') || file.includes('.provider.') || content.includes('@Injectable(')) type = 'service';
      else if (file.includes('.guard.') || content.includes('CanActivate')) type = 'middleware'; // Guard
      else if (file.includes('.interceptor.') || content.includes('NestInterceptor')) type = 'middleware'; // Interceptor
      else if (file.includes('.pipe.') || content.includes('PipeTransform')) type = 'utility'; // Pipe
      else if (file.includes('.dto.')) type = 'dto'; // DTO
      else if (file.includes('.decorator.')) type = 'utility'; // Decorator

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.ts', '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        
        const endpoints: string[] = [];
        if (type === 'controller') {
          // match @Get('path') or @Post("path") or @Get()
          const routeRegex = /@(Get|Post|Put|Delete|Patch)\s*\(\s*(?:['"]([^'"]+)['"])?\s*\)/g;
          let match;
          while ((match = routeRegex.exec(content)) !== null) {
            const routePath = match[2] || '/';
            endpoints.push(`${match[1].toUpperCase()} ${routePath}`);
          }
        }

        components.push({
          name,
          type,
          directory,
          files: [file],
          endpoints: endpoints.length > 0 ? endpoints : undefined,
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
