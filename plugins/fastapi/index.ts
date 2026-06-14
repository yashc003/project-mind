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
import type { Component, Workflow } from '../../src/types/index.js';
import { readText } from '../../src/utils/fs.js';
import path from 'node:path';
import crypto from 'node:crypto';

const FASTAPI_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-fastapi',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'FastAPI',
  priority: 200,
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
    const sourceFiles = context.evidence.sourceCode.fileCategories.source.filter(f => f.endsWith('.py'));

    for (const file of sourceFiles) {
      const content = await readText(path.join(context.projectPath, file));
      if (!content) continue;
      
      let type: Component['type'] = 'other';
      if (file.includes('routers/') || file.includes('main.py') || content.includes('APIRouter(')) type = 'controller';
      else if (file.includes('dependencies') || content.includes('Depends(')) type = 'service';
      else if (file.includes('models')) type = 'model';
      else if (file.includes('schemas') || content.includes('BaseModel')) type = 'dto';

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.py', '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        
        const endpoints: string[] = [];
        if (type === 'controller') {
          // match @app.get("/path") or @router.post('/path')
          const routeRegex = /@(app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
          let match;
          while ((match = routeRegex.exec(content)) !== null) {
            const method = match[2].toUpperCase();
            const routePath = match[3];
            endpoints.push(`${method} ${routePath}`);

            workflows.push({
              id: crypto.randomBytes(4).toString('hex'),
              name: `${method} ${routePath}`,
              description: `FastAPI Route in ${file.split('/').pop()}`,
              entryPoint: file,
              dependencyScope: 'file',
              sourceFile: file.split('/').pop(),
              components: [],
              files: [file],
              confidence: 95,
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
