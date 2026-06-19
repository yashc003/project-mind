import crypto from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadMemory, saveMemory } from '../memory/index.js';
import { logAgentInteraction } from '../memory/agent-history.js';
import { generateHandoff } from '../handoff/index.js';
import { redirectConsoleToStderr } from './logger.js';
import type { CurrentFocus, Decision } from '../../types/index.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { explainNode } from '../graph/explain.js';
import { queryGraph } from '../graph/query.js';
import { analyzeImpact } from '../graph/impact.js';
import { getProjectMindVersion } from '../../utils/version.js';

const execAsync = promisify(exec);

export function registerTools(server: McpServer, projectPath: string): void {
  // Ensure all our chalk logging goes to stderr instead of stdout
  redirectConsoleToStderr();

  server.tool(
    'pm_record_decision',
    'Record a new architectural decision to the project memory',
    {
      title: z.string().describe('Title of the decision'),
      rationale: z.string().describe('Detailed explanation of why this decision was made'),
      tags: z.array(z.string()).optional().describe('Optional tags for categorization (e.g. security, performance)'),
    },
    async ({ title, rationale, tags }) => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      const decision: Decision = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        title,
        description: '',
        rejected: [],
        source: 'manual',
        reason: rationale,
        tags: tags || [],
        confidence: 90, // Assume deliberate tool call is high confidence
        impactedFeatures: [],
        impactedComponents: [],
      };

      memory.decisions.push(decision);
      await saveMemory(projectPath, memory);
      await logAgentInteraction(projectPath, 'mcp-agent', 'Record Decision', `Recorded: ${title}`);

      return {
        content: [{ type: 'text', text: `Successfully recorded decision: ${title}` }],
      };
    }
  );

  server.tool(
    'pm_start_feature',
    'Start a new feature lifecycle and capture the intent',
    {
      name: z.string().describe('Name of the feature'),
      problem: z.string().describe('Why are we building this / What is the problem?'),
      modules: z.array(z.string()).optional().describe('Expected modules this will affect'),
    },
    async ({ name, problem, modules }) => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      const focus: CurrentFocus = {
        id: crypto.randomBytes(4).toString('hex'),
        feature: name,
        task: problem,
        status: 'in-progress',
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        expectedModules: modules || [],
        actualModules: [],
        subTasks: [],
        blockers: [],
        linkedCommits: [],
      };

      if (memory.focusHistory.active) {
        memory.focusHistory.active.completedAt = new Date().toISOString();
        memory.focusHistory.history.push(memory.focusHistory.active);
      }

      memory.focusHistory.active = focus;
      await saveMemory(projectPath, memory);
      await logAgentInteraction(projectPath, 'mcp-agent', 'Start Feature', `Started feature: ${name}`);
      await generateHandoff(projectPath, memory);

      return {
        content: [{ type: 'text', text: `Successfully started feature: ${name}. Handoff document generated.` }],
      };
    }
  );

  server.tool(
    'pm_complete_feature',
    'Mark the currently active feature as complete',
    {},
    async () => {
      const memory = await loadMemory(projectPath);
      if (!memory) throw new Error('Memory not initialized');

      if (!memory.focusHistory.active) {
        return {
          content: [{ type: 'text', text: 'No active feature to complete.' }],
          isError: true,
        };
      }

      const featureName = memory.focusHistory.active.feature;
      memory.focusHistory.active.completedAt = new Date().toISOString();
      memory.focusHistory.history.push(memory.focusHistory.active);
      memory.focusHistory.active = null;

      await saveMemory(projectPath, memory);
      await logAgentInteraction(projectPath, 'mcp-agent', 'Complete Feature', `Completed feature: ${featureName}`);
      await generateHandoff(projectPath, memory);

      return {
        content: [{ type: 'text', text: `Successfully completed feature: ${featureName}` }],
      };
    }
  );

  server.tool(
    'pm_update',
    'Run an incremental project scan to update the knowledge graph. Use this after making significant codebase changes.',
    {},
    async () => {
      try {
        // Since update logic is deeply integrated with the CLI, we invoke it via CLI execution
        // using the node process running the server. This ensures all Discovery, Graphing, and Handoff run.
        const cliPath = process.argv[1]; 
        await execAsync(`node "${cliPath}" update --quiet --project-dir "${projectPath}"`);
        
        return {
          content: [{ type: 'text', text: `Successfully updated project memory from current codebase evidence.` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Failed to update memory: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'pm_explain_node',
    'Provides a deep, structured explanation of a specific node (feature, component, workflow, file) including AST signatures and decisions',
    {
      topic: z.string().describe('The name or ID of the node to explain (e.g. "authentication", "AuthService")'),
    },
    async ({ topic }) => {
      const memory = await loadMemory(projectPath);
      if (!memory || !memory.knowledgeGraph) throw new Error('Memory or graph not initialized');

      const result = await explainNode(memory, projectPath, topic);

      if (!result) {
        return {
          content: [{ type: 'text', text: `Could not find any knowledge regarding "${topic}". Use the graph-summary resource to see available nodes.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'pm_query_graph',
    'Queries the knowledge graph to return an ego-graph (the target node + its direct neighbors and edges)',
    {
      node: z.string().describe('The name or ID of the node to query (e.g. "UserController")'),
      depth: z.number().min(1).max(2).optional().describe('Depth of traversal (default 1, max 2)'),
    },
    async ({ node, depth }) => {
      const memory = await loadMemory(projectPath);
      if (!memory || !memory.knowledgeGraph) throw new Error('Memory or graph not initialized');

      const queryResult = queryGraph(memory.knowledgeGraph, node, depth || 1);

      if (queryResult.matchedNodes.length === 0) {
        return {
          content: [{ type: 'text', text: `Could not find any nodes matching "${node}". Use the graph-summary resource to see available nodes.` }],
          isError: true,
        };
      }

      // Convert to a minimal subgraph representation
      const subgraph = {
        topic: queryResult.topic,
        nodes: [...queryResult.matchedNodes, ...queryResult.relatedNodes].map(n => ({
          id: n.id,
          type: n.type,
          label: n.label
        })),
        edges: queryResult.edges.map(e => ({
          source: e.source,
          target: e.target,
          relation: e.relation
        }))
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(subgraph, null, 2) }],
      };
    }
  );

  server.tool(
    'pm_query_impact',
    'Analyzes the impact of a potential change by performing backward traversal in the knowledge graph. Returns all features, workflows, decisions, and components that depend on the target node.',
    {
      target: z.string().describe('The name or ID of the node being modified (e.g. "AuthService", "src/auth.ts")'),
    },
    async ({ target }) => {
      const memory = await loadMemory(projectPath);
      if (!memory || !memory.knowledgeGraph) throw new Error('Memory or graph not initialized');

      const impactResult = analyzeImpact(memory.knowledgeGraph, target);

      if (impactResult.features.length === 0 && impactResult.components.length === 0 && impactResult.files.length === 0) {
        return {
          content: [{ type: 'text', text: `Could not determine impact for "${target}". It may be isolated or not exist in the graph.` }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(impactResult, null, 2) }],
      };
    }
  );

  server.tool(
    'pm_info',
    'Returns system health information about the Project-Mind server, memory freshness, and schema version',
    {},
    async () => {
      const memory = await loadMemory(projectPath);
      
      const info = {
        version: getProjectMindVersion(),
        projectPath,
        memoryInitialized: !!memory,
        lastUpdated: memory?.updatedAt || null,
        schemaVersion: memory?.version || null,
        scenario: memory?.scenario || null,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
      };
    }
  );
}
