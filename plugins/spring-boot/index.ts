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
import type { Component } from '../../src/types/index.js';
import { readText } from '../../src/utils/fs.js';
import path from 'node:path';

const SPRING_BOOT_PLUGIN: ProjectMindPlugin = {
  name: '@project-mind/plugin-spring-boot',
  version: '0.6.0',
  projectMindVersion: '>=0.6.0',
  targetFramework: 'Spring Boot',
  priority: 100,
  capabilities: ['architecture', 'explain'],

  async analyze(context: PluginContext): Promise<PluginContribution> {
    const components: Component[] = [];
    const sourceFiles = context.evidence.sourceCode.fileCategories.source.filter(f => f.endsWith('.java'));

    // We scan Java files for Spring annotations
    for (const file of sourceFiles) {
      const content = await readText(path.join(context.projectPath, file));
      if (!content) continue;
      
      let type: Component['type'] = 'other';
      if (file.includes('Controller') || content.includes('@RestController') || content.includes('@Controller')) type = 'controller';
      else if (file.includes('Service') || content.includes('@Service')) type = 'service';
      else if (file.includes('Repository') || content.includes('@Repository')) type = 'repository';
      else if (file.includes('Config') || content.includes('@Configuration')) type = 'config';

      if (type !== 'other') {
        const name = file.split('/').pop()?.replace('.java', '') || 'Unknown';
        const directory = file.substring(0, file.lastIndexOf('/')) || '';
        
        // Extract endpoints if it's a controller
        const endpoints: string[] = [];
        if (type === 'controller') {
          const routeRegex = /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*["']([^"']+)["']\s*\)/g;
          let match;
          while ((match = routeRegex.exec(content)) !== null) {
            endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
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
