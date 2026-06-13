// ============================================================================
// Plugin Registry Engine
// ============================================================================

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProjectMindPlugin } from '../../types/index.js';
import logger from '../../utils/logger.js';
import { fileExists, readJson } from '../../utils/fs.js';

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
  async loadPlugins(projectPath: string): Promise<void> {
    this.plugins = [];
    this.failedPlugins = [];

    const configPath = path.join(projectPath, '.project-mind', 'plugins.json');
    if (!(await fileExists(configPath))) {
      return;
    }

    let config: PluginsConfig | null;
    try {
      config = await readJson<PluginsConfig>(configPath);
    } catch (error) {
      logger.error('Failed to parse plugins.json');
      return;
    }

    if (!config) return;

    if (!config.installed || !Array.isArray(config.installed)) {
      return;
    }

    const enabledPlugins = config.installed.filter(p => p.enabled);

    for (const pluginDef of enabledPlugins) {
      const identifier = pluginDef.path || pluginDef.name;
      try {
        const plugin = await this.resolveAndLoad(projectPath, identifier);
        // Default priority to 100 if not provided
        plugin.priority = plugin.priority ?? 100;
        this.plugins.push(plugin);
        logger.success(`Loaded plugin: ${plugin.name} v${plugin.version}`);
      } catch (error: any) {
        logger.error(`Failed to load plugin "${identifier}": ${error.message}`);
        this.failedPlugins.push({ name: pluginDef.name, error: error.message });
      }
    }

    // Sort by priority (lower number = higher priority / runs first)
    this.plugins.sort((a, b) => (a.priority!) - (b.priority!));
  }

  private async resolveAndLoad(projectPath: string, identifier: string): Promise<ProjectMindPlugin> {
    let importPath = identifier;

    // Is it a local path?
    if (identifier.startsWith('.') || identifier.startsWith('/') || identifier.startsWith('C:\\') || identifier.startsWith('D:\\')) {
      const absolutePath = path.resolve(projectPath, identifier);
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
