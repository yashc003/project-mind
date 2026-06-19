import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';

export async function createAndStartServer(projectPath: string): Promise<void> {
  const server = new McpServer({
    name: 'project-mind',
    version: '1.1.0',
  });

  registerResources(server, projectPath);
  registerTools(server, projectPath);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
