// ============================================================================
// Plugin Registry Engine
// ============================================================================

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProjectMindPlugin } from '../../types/index.js';
import logger from '../../utils/logger.js';
import { fileExists, readJson } from '../../utils/fs.js';
import { isPluginTrusted } from './trust.js';

export interface InstalledPlugin {
  name: string;
  version: string;
  enabled: boolean;
  path?: string; // If local
}

export interface PluginsConfig {
  installed: InstalledPlugin[];
}

export class PluginRegistry {
  private plugins: ProjectMindPlugin[] = [];
  private failedPlugins: { name: string; error: string }[] = [];

  /**
   * Loads all enabled plugins from .project-mind/plugins.json
   */
  async loadPlugins(projectPath: string, autoLoadFrameworks?: string[]): Promise<void> {
    this.plugins = [];
    this.failedPlugins = [];

    // 1. Auto-load official plugins based on frameworks
    const officialMap: Record<string, string> = {
      'spring-boot': 'plugins/spring-boot/index.js',
      'fastapi': 'plugins/fastapi/index.js',
      'react': 'plugins/react/index.js',
      'nestjs': 'plugins/nestjs/index.js'
    };

    if (autoLoadFrameworks) {
      for (const framework of autoLoadFrameworks) {
        if (officialMap[framework]) {
           await this.loadSinglePlugin(projectPath, officialMap[framework], `@project-mind/plugin-${framework}`);
        }
      }
    }

    // 2. Load from user config
    const configPath = path.join(projectPath, '.project-mind', 'authored', 'plugins.json');
    if (await fileExists(configPath)) {
      try {
        const config = await readJson<PluginsConfig>(configPath);
        if (config && config.installed && Array.isArray(config.installed)) {
          const enabledPlugins = config.installed.filter(p => p.enabled);
          for (const pluginDef of enabledPlugins) {
            const identifier = pluginDef.path || pluginDef.name;
            await this.loadSinglePlugin(projectPath, identifier, pluginDef.name);
          }
        }
      } catch (error) {
        logger.error('Failed to parse plugins.json');
      }
    }

    // Sort by priority (lower number = higher priority / runs first)
    this.plugins.sort((a, b) => (a.priority!) - (b.priority!));
  }

  private async loadSinglePlugin(projectPath: string, identifier: string, name: string): Promise<void> {
    try {
      // Tier 1: Official internal plugins bypass trust check
      const isOfficial = identifier.startsWith('plugins/');
      
      if (!isOfficial) {
        // Tier 2 & 3: Third-Party and Local plugins require explicit trust
        const trusted = await isPluginTrusted(identifier);
        if (!trusted) {
          logger.error(`\n⚠ Untrusted Plugin Blocked`);
          logger.info(`Plugin: ${identifier}`);
          logger.info(`Reason: Local and third-party plugins can execute arbitrary code.`);
          logger.info(`To trust: npx project-mind plugin trust ${identifier}\n`);
          this.failedPlugins.push({ name, error: 'Untrusted plugin blocked by security policy.' });
          return;
        }
      }

      // Check if already loaded to avoid duplicates
      if (this.plugins.some(p => p.name.includes(identifier.split('/')[1]))) {
        return; // Already loaded via auto-load or config
      }

      const plugin = await this.resolveAndLoad(projectPath, identifier);
      // Default priority to 100 if not provided
      plugin.priority = plugin.priority ?? 100;
      
      // Double check by actual plugin name
      if (!this.plugins.some(p => p.name === plugin.name)) {
        this.plugins.push(plugin);
        logger.success(`Loaded plugin: ${plugin.name} v${plugin.version}`);
      }
    } catch (error: any) {
      logger.error(`Failed to load plugin "${identifier}": ${error.message}`);
      this.failedPlugins.push({ name, error: error.message });
    }
  }

  private async resolveAndLoad(projectPath: string, identifier: string): Promise<ProjectMindPlugin> {
    let importPath = identifier;

    // Official plugins resolution (bypasses local resolution)
    if (identifier.startsWith('plugins/')) {
      const url = new URL(`./${identifier}`, import.meta.url);
      importPath = url.href;
    }
    // Is it a local path?
    else if (identifier.startsWith('.') || identifier.startsWith('/') || identifier.startsWith('C:\\') || identifier.startsWith('D:\\')) {
      const absolutePath = path.resolve(projectPath, identifier);
      
      // Path Escaping Protection
      const relative = path.relative(projectPath, absolutePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Security Violation: Local plugin path escapes the project root (${absolutePath})`);
      }

      if (!(await fileExists(absolutePath))) {
        throw new Error(`Local plugin file not found at ${absolutePath}`);
      }
      importPath = pathToFileURL(absolutePath).href;
    }

    // Import the module
    const module = await import(importPath);
    const plugin = module.default as ProjectMindPlugin;

    if (!plugin) {
      throw new Error(`Plugin ${identifier} does not have a default export`);
    }

    if (!plugin.name || !plugin.version) {
      throw new Error(`Plugin ${identifier} is missing required 'name' or 'version' fields`);
    }

    if (!plugin.capabilities || !Array.isArray(plugin.capabilities)) {
      throw new Error(`Plugin ${plugin.name} must declare an array of 'capabilities'`);
    }

    return plugin;
  }

  getPlugins(): ProjectMindPlugin[] {
    return this.plugins;
  }

  getFailedPlugins(): { name: string; error: string }[] {
    return this.failedPlugins;
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();
