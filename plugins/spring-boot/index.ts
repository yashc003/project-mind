// ============================================================================
// Official Plugin: Spring Boot
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

const SPRING_BOOT_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-spring-boot',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'Spring Boot',
  priority: 100,
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
    const sourceFiles = context.evidence.sourceCode.fileCategories.source.filter(f => f.endsWith('.java') || f.endsWith('.kt'));

    // We scan Java/Kotlin files for Spring annotations
    for (const file of sourceFiles) {
      const content = await readText(path.join(context.projectPath, file));
      if (!content) continue;
      
      let type: Component['type'] = 'other';
      if (file.includes('Controller') || content.includes('@RestController') || content.includes('@Controller')) type = 'controller';
      else if (file.includes('Service') || content.includes('@Service')) type = 'service';
      else if (file.includes('Repository') || content.includes('@Repository')) type = 'repository';
      else if (file.includes('Config') || content.includes('@Configuration')) type = 'config';

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace(/\.(java|kt)$/, '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        
        // Extract endpoints if it's a controller
        const endpoints: string[] = [];
        if (type === 'controller') {
          // Check for class-level @RequestMapping base path
          const requestMappingRegex = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g;
          const mapMatch = requestMappingRegex.exec(content);
          let basePath = mapMatch && mapMatch[1] ? mapMatch[1] : '';
          if (basePath && !basePath.startsWith('/')) basePath = '/' + basePath;

          const routeRegex = /@(Get|Post|Put|Delete|Patch)Mapping(?:\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']*)["']\s*\))?/g;
          let match;
          while ((match = routeRegex.exec(content)) !== null) {
            let routePath = match[2] || '';
            if (routePath && !routePath.startsWith('/')) routePath = '/' + routePath;
            const fullPath = `${basePath}${routePath}` || '/';
            const method = match[1].toUpperCase();
            endpoints.push(`${method} ${fullPath}`);

            workflows.push({
              id: crypto.randomBytes(4).toString('hex'),
              name: `${method} ${fullPath}`,
              description: `Spring Boot API Route in ${file.split('/').pop()}`,
              entryPoint: file,
              dependencyScope: 'file',
              sourceFile: file.split('/').pop(),
              components: [],
              files: [file],
              confidence: 95,
              type: 'api-request'
            });
          }

          // Check for method-level @RequestMapping with explicit method
          const reqMappingRegex = /@RequestMapping\s*\(\s*([^)]+)\s*\)/g;
          while ((match = reqMappingRegex.exec(content)) !== null) {
            const args = match[1];
            if (args.includes('method') && args.includes('RequestMethod.')) {
              const methodMatch = /RequestMethod\.(GET|POST|PUT|DELETE|PATCH)/.exec(args);
              const pathMatch = /(?:value\s*=\s*|path\s*=\s*)?["']([^"']+)["']/.exec(args);
              if (methodMatch) {
                const method = methodMatch[1];
                let routePath = pathMatch ? pathMatch[1] : '';
                if (routePath && !routePath.startsWith('/')) routePath = '/' + routePath;
                const fullPath = `${basePath}${routePath}` || '/';
                endpoints.push(`${method} ${fullPath}`);
                
                workflows.push({
                  id: crypto.randomBytes(4).toString('hex'),
                  name: `${method} ${fullPath}`,
                  description: `Spring Boot API Route in ${file.split('/').pop()}`,
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
    const isSpringRelated = context.node.label.includes('Controller') || context.node.label.includes('Service');
    if (!isSpringRelated) return [];

    return [
      {
        title: 'Spring Context',
        content: `This component is managed by the Spring IoC container.`,
      }
    ];
  }
};

export default SPRING_BOOT_PLUGIN;
