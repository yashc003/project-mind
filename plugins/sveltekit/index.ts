// ============================================================================
// Official Plugin: SvelteKit
// ============================================================================

import type {
  ProjectMindPlugin,
  PluginContext,
  PluginContribution,
  ExplainContext,
  ExplainSection,
} from '../../src/types/plugin.js';
import type { Component, Workflow } from '../../src/types/index.js';
import path from 'node:path';
import crypto from 'node:crypto';

const SVELTEKIT_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-sveltekit',
  version: '1.0.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'SvelteKit',
  priority: 150,
  capabilities: ['architecture', 'explain', 'workflow'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const workflows: Workflow[] = [];
    
    // Both JS/TS source files AND Svelte component files
    const sourceFiles = [
      ...(context.evidence.sourceCode.fileCategories.source || []),
      ...(context.evidence.sourceCode.fileCategories.ui || [])
    ];

    const routeFiles = sourceFiles.filter(f => f.includes('src/routes/') || f.includes('src\\routes\\'));

    for (const file of routeFiles) {
      const filename = path.basename(file);
      const isRoute = filename.startsWith('+page') || filename.startsWith('+server') || filename.startsWith('+layout');
      
      if (isRoute) {
        // Extract route path from directory structure
        // e.g. src/routes/api/users/+server.ts -> /api/users
        const normalizedFile = file.replace(/\\/g, '/');
        const routeMatch = normalizedFile.match(/src\/routes\/(.*)\/\+.*\.(svelte|ts|js)$/);
        
        // If it's directly in src/routes (e.g. src/routes/+page.svelte) routePath is empty -> /
        let routePath = '/';
        if (routeMatch && routeMatch[1]) {
          routePath = `/${routeMatch[1]}`;
        } else if (normalizedFile.match(/src\/routes\/\+.*\.(svelte|ts|js)$/)) {
           routePath = '/';
        }

        const type = filename.includes('+server') ? 'controller' : 'ui-component';
        
        components.push({
          name: `Route: ${routePath}`,
          type,
          directory: path.dirname(file),
          files: [file],
          endpoints: [type === 'controller' ? `API: ${routePath}` : `PAGE: ${routePath}`],
          confidence: 0.9,
        });

        workflows.push({
          id: crypto.randomBytes(4).toString('hex'),
          name: `${type === 'controller' ? 'API' : 'UI'} Route ${routePath}`,
          description: `SvelteKit File-based Route`,
          entryPoint: file,
          dependencyScope: 'file',
          sourceFile: filename,
          components: [],
          files: [file],
          confidence: 95,
          type: type === 'controller' ? 'api-request' : 'user-journey'
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
    const isSvelte = context.node.label.includes('+page') || context.node.label.includes('+server');
    if (!isSvelte) return [];

    return [
      {
        title: 'SvelteKit Routing',
        content: `This relies on SvelteKit's file-system based routing mechanism.`,
      }
    ];
  }
};

export default SVELTEKIT_PLUGIN;
