// ============================================================================
// Official Plugin: Django
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

const DJANGO_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-django',
  version: '1.0.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'Django',
  priority: 150,
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
    
    const sourceFiles = [
      ...(context.evidence.sourceCode.fileCategories.source || []),
    ].filter(f => f.endsWith('.py'));

    for (const file of sourceFiles) {
      const content = await readText(path.join(context.projectPath, file));
      if (!content) continue;
      
      let type: Component['type'] = 'other';
      if (file.endsWith('views.py') || content.includes('ViewSet(')) {
        type = 'controller';
      } else if (file.endsWith('models.py')) {
        type = 'model';
      } else if (file.endsWith('urls.py')) {
        type = 'controller'; // Treat urls as routing controllers
      }

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.py', '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        
        const endpoints: string[] = [];
        if (file.endsWith('urls.py')) {
          // match path('route', ...), re_path('route', ...)
          const routeRegex = /(path|re_path)\s*\(\s*['"]([^'"]+)['"]/g;
          let match;
          while ((match = routeRegex.exec(content)) !== null) {
            const routePath = match[2];
            endpoints.push(`GET/POST /${routePath}`); // Django routes don't specify HTTP method in urls.py directly usually

            workflows.push({
              id: crypto.randomBytes(4).toString('hex'),
              name: `ROUTE /${routePath}`,
              description: `Django Route in ${file.split('/').pop()}`,
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
        
        // DRF ViewSets
        if (file.endsWith('views.py')) {
          const viewsetRegex = /class\s+([A-Za-z0-9_]+ViewSet)\s*\(/g;
          let match;
          while ((match = viewsetRegex.exec(content)) !== null) {
            const vsName = match[1];
            endpoints.push(`DRF ViewSet: ${vsName}`);
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
    const isDjango = context.node.label.includes('views.py') || context.node.label.includes('urls.py');
    if (!isDjango) return [];

    return [
      {
        title: 'Django Structure',
        content: `This component relies on Django MVC (MVT) architecture.`,
      }
    ];
  }
};

export default DJANGO_PLUGIN;
