// ============================================================================
// Official Plugin: Express
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

const EXPRESS_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-express',
  version: '1.0.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'Express',
  priority: 100, // Explicit priority
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
    
    // Look in JS and TS files
    const sourceFiles = [
      ...(context.evidence.sourceCode.fileCategories.source || []),
    ].filter(f => f.endsWith('.js') || f.endsWith('.ts'));

    for (const file of sourceFiles) {
      const content = await readText(path.join(context.projectPath, file));
      if (!content) continue;
      
      let type: Component['type'] = 'other';
      if (file.includes('routes/') || file.includes('controllers/') || content.includes('express.Router()') || content.includes('app.get(')) {
        type = 'controller';
      } else if (file.includes('services/')) {
        type = 'service';
      } else if (file.includes('models/')) {
        type = 'model';
      }

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace(/\.(js|ts)$/, '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        
        const endpoints: string[] = [];
        if (type === 'controller') {
          // match app.get('/path') or router.post('/path')
          const routeRegex = /(app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
          let match;
          while ((match = routeRegex.exec(content)) !== null) {
            const method = match[2].toUpperCase();
            const routePath = match[3];
            endpoints.push(`${method} ${routePath}`);

            workflows.push({
              id: crypto.randomBytes(4).toString('hex'),
              name: `${method} ${routePath}`,
              description: `Express Route in ${file.split('/').pop()}`,
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
    const isExpress = context.node.label.includes('Router') || context.node.label.includes('Controller');
    if (!isExpress) return [];

    return [
      {
        title: 'Express Router',
        content: `This component relies on Express.js routing definitions.`,
      }
    ];
  }
};

export default EXPRESS_PLUGIN;
