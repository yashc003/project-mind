// ============================================================================
// Official Plugin: Laravel
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

const LARAVEL_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-laravel',
  version: '1.0.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'Laravel',
  priority: 150,
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
    
    const sourceFiles = [
      ...(context.evidence.sourceCode.fileCategories.source || []),
    ].filter(f => f.endsWith('.php'));

    for (const file of sourceFiles) {
      const content = await readText(path.join(context.projectPath, file));
      if (!content) continue;
      
      let type: Component['type'] = 'other';
      if (file.includes('routes/') || file.includes('Controllers/')) {
        type = 'controller';
      } else if (file.includes('Models/')) {
        type = 'model';
      }

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.php', '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        
        const endpoints: string[] = [];
        if (file.includes('routes/')) {
          // match Route::get('/path', ...)
          const routeRegex = /Route::(get|post|put|delete|patch|resource)\s*\(\s*['"]([^'"]+)['"]/g;
          let match;
          while ((match = routeRegex.exec(content)) !== null) {
            const method = match[1].toUpperCase();
            const routePath = match[2];
            endpoints.push(`${method} /${routePath}`);

            workflows.push({
              id: crypto.randomBytes(4).toString('hex'),
              name: `${method} /${routePath}`,
              description: `Laravel Route in ${file.split('/').pop()}`,
              entryPoint: file,
              dependencyScope: 'file',
              sourceFile: file.split('/').pop(),
              components: [],
              files: [file],
              confidence: 90,
              type: 'api-request'
            });
            
            // If resource, it implies GET, POST, PUT, DELETE for that path
            if (method === 'RESOURCE') {
               workflows.push({
                 id: crypto.randomBytes(4).toString('hex'),
                 name: `RESOURCE /${routePath}`,
                 description: `Laravel Resource Controller`,
                 entryPoint: file,
                 dependencyScope: 'file',
                 sourceFile: file.split('/').pop(),
                 components: [],
                 files: [file],
                 confidence: 90,
                 type: 'api-request'
               });
            }
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
      workflows,
    };
  },

  onExplain(context: ExplainContext): ExplainSection[] {
    const isLaravel = context.node.label.includes('Controller') || context.node.label.includes('Route::');
    if (!isLaravel) return [];

    return [
      {
        title: 'Laravel Architecture',
        content: `This relies on Laravel's Eloquent ORM and routing layer.`,
      }
    ];
  }
};

export default LARAVEL_PLUGIN;
