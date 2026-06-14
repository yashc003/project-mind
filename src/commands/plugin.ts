import { Command } from 'commander';
import { trustPlugin, untrustPlugin } from '../engines/plugin/trust.js';
import logger from '../utils/logger.js';

export const pluginCommand = new Command('plugin')
  .description('Manage Project-Mind plugins');

pluginCommand
  .command('trust <plugin>')
  .description('Explicitly trust a local or third-party plugin to execute code')
  .action(async (plugin: string) => {
    try {
      await trustPlugin(plugin);
    } catch (err: any) {
      logger.error(`Error trusting plugin: ${err.message}`);
      process.exit(1);
    }
  });

pluginCommand
  .command('untrust <plugin>')
  .description('Remove trust for a previously trusted plugin')
  .action(async (plugin: string) => {
    try {
      await untrustPlugin(plugin);
    } catch (err: any) {
      logger.error(`Error untrusting plugin: ${err.message}`);
      process.exit(1);
    }
  });

pluginCommand
  .command('inspect <plugin>')
  .description('Inspect a plugin to audit its capabilities and trust status without executing it')
  .action(async (pluginIdentifier: string) => {
    try {
      const { promises: fs } = await import('node:fs');
      const crypto = await import('node:crypto');
      const path = await import('node:path');
      const { getTrustedPlugins } = await import('../engines/plugin/trust.js');

      let type = 'Official / Internal';
      let absolutePath = pluginIdentifier;
      let sha256 = 'N/A';
      let name = pluginIdentifier;
      let capabilities: string[] = [];
      let isLocal = false;

      // Determine type and absolute path
      if (pluginIdentifier.startsWith('.') || pluginIdentifier.startsWith('/') || pluginIdentifier.startsWith('C:\\') || pluginIdentifier.startsWith('D:\\')) {
        type = 'Local Plugin';
        absolutePath = path.resolve(process.cwd(), pluginIdentifier);
        isLocal = true;
      } else if (!pluginIdentifier.startsWith('plugins/')) {
        type = 'Third-Party NPM Plugin';
      }

      // If local, safely read file and hash
      if (isLocal) {
        try {
          const content = await fs.readFile(absolutePath, 'utf-8');
          const buffer = await fs.readFile(absolutePath);
          sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
          
          // Naive static extraction to prevent RCE
          const nameMatch = /name:\s*['"]([^'"]+)['"]/.exec(content);
          if (nameMatch) name = nameMatch[1];
          
          const capMatch = /capabilities:\s*\[([^\]]+)\]/.exec(content);
          if (capMatch) {
            capabilities = capMatch[1].split(',').map(s => s.replace(/['"\s]/g, '').trim()).filter(Boolean);
          }
        } catch {
          logger.error(`Failed to read local plugin file at ${absolutePath}`);
          process.exit(1);
        }
      }

      // Check trust registry
      const trustedPlugins = await getTrustedPlugins();
      const trustInfo = trustedPlugins[pluginIdentifier];
      const isTrusted = pluginIdentifier.startsWith('plugins/') ? true : !!(trustInfo && trustInfo.trusted);

      logger.blank();
      logger.box(`Plugin Inspection`);
      console.log(`Name: ${name}`);
      console.log(`Type: ${type}`);
      console.log(`Path: ${absolutePath}`);
      console.log(`SHA256: ${sha256}`);
      
      if (capabilities.length > 0) {
        console.log(`Capabilities:`);
        capabilities.forEach(c => console.log(`  - ${c}`));
      } else if (isLocal) {
        console.log(`Capabilities: (Could not be statically inferred)`);
      }

      console.log(`\nTrusted: ${isTrusted ? 'YES' : 'NO'}`);
      
      if (trustInfo) {
        console.log(`Trusted At: ${trustInfo.trustedAt}`);
        console.log(`Project-Mind Version: ${trustInfo.projectMindVersion}`);
      }
      
      logger.blank();

    } catch (err: any) {
      logger.error(`Error inspecting plugin: ${err.message}`);
      process.exit(1);
    }
  });
