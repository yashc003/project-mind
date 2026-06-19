// ============================================================================
// Command: mcp
// ============================================================================

import { Command } from 'commander';
import { startMcpServer } from '../engines/mcp/index.js';
import { isInitialized } from '../engines/memory/index.js';
import { getProjectRoot } from '../utils/fs.js';

export const mcpCommand = new Command('mcp')
  .description('Start the Model Context Protocol (MCP) server over stdio')
  .option('-p, --project-path <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    let projectPath = '';
    try {
      projectPath = options.projectPath ? options.projectPath : await getProjectRoot();

      if (!(await isInitialized(projectPath))) {
        console.error('Project-Mind is not initialized. Run `project-mind init` first.');
        process.exit(1);
      }

      await startMcpServer(projectPath);
    } catch (err: any) {
      console.error(`MCP Server Error: ${err.message}`);
      process.exit(1);
    }
  });
