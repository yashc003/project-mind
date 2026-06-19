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
import type { Component, Workflow } from '../../src/types/index.js';
import { readText } from '../../src/utils/fs.js';
import path from 'node:path';
import crypto from 'node:crypto';

const NESTJS_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-nestjs',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'NestJS',
  priority: 250,
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
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
        let usedRegex = true;

        if (type === 'controller') {
          if (context.ast) {
            const absolutePath = path.join(context.projectPath, file);
            const astResult = await context.ast.parseFile(absolutePath);
            if (astResult) {
              usedRegex = false;
              // Build tree-sitter query for decorators
              const queryStr = `
                (decorator
                  (call_expression
                    function: (identifier) @name
                    arguments: (arguments (string) @path)?
                  )
                )
                (decorator
                  (identifier) @name
                )
              `;
              try {
                const matches = context.ast.executeQuery(astResult.tree, astResult.language, queryStr);
                let basePath = '';
                
                // First pass: find Controller base path
                matches.forEach(match => {
                  let decName = '';
                  let routePath = '';
                  match.captures.forEach(c => {
                    if (c.name === 'name') decName = c.node.text;
                    if (c.name === 'path') routePath = c.node.text.replace(/['"\`]/g, '');
                  });
                  if (decName === 'Controller') {
                    basePath = routePath;
                    if (basePath && !basePath.startsWith('/')) basePath = '/' + basePath;
                  }
                });

                // Second pass: find endpoints
                matches.forEach(match => {
                  let decName = '';
                  let routePath = '';
                  match.captures.forEach(c => {
                    if (c.name === 'name') decName = c.node.text;
                    if (c.name === 'path') routePath = c.node.text.replace(/['"\`]/g, '');
                  });

                  if (['Get', 'Post', 'Put', 'Delete', 'Patch'].includes(decName)) {
                    if (routePath && !routePath.startsWith('/')) routePath = '/' + routePath;
                    const fullPath = `${basePath}${routePath}` || '/';
                    const method = decName.toUpperCase();
                    endpoints.push(`${method} ${fullPath}`);

                    workflows.push({
                      id: crypto.randomBytes(4).toString('hex'),
                      name: `${method} ${fullPath}`,
                      description: `NestJS API Route in ${file.split('/').pop()}`,
                      entryPoint: file,
                      dependencyScope: 'file',
                      sourceFile: file.split('/').pop(),
                      components: [],
                      files: [file],
                      confidence: 95,
                      type: 'api-request'
                    });
                  }
                });
              } catch (e) {
                usedRegex = true;
              }
            }
          }

          if (usedRegex) {
            const controllerRegex = /@Controller\(\s*(?:['"]([^'"]+)['"])?\s*\)/g;
            const ctrlMatch = controllerRegex.exec(content);
            let basePath = ctrlMatch && ctrlMatch[1] ? ctrlMatch[1] : '';
            if (basePath && !basePath.startsWith('/')) basePath = '/' + basePath;
  
            const routeRegex = /@(Get|Post|Put|Delete|Patch)\s*\(\s*(?:['"]([^'"]+)['"])?\s*\)/g;
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
                description: `NestJS API Route in ${file.split('/').pop()}`,
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
