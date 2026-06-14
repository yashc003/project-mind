// ============================================================================
// Context Pack Generator Engine (Context Relevance Engine)
// ============================================================================

import type { ProjectMemory, GraphNode } from '../../types/index.js';
import type { BudgetAllocation } from '../../types/pack.js';
import { queryGraph, GraphNodeWithDepth } from '../graph/query.js';
import { pluginRegistry } from '../plugin/registry.js';
import { computeProgress, detectScopeDrift } from '../focus/index.js';
import type { PackContext } from '../../types/plugin.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export interface PackOptions {
  topic: string;
  isCurrent: boolean;
  level: 'compact' | 'full';
  scope?: string;
  budget?: number;
  explainBudget?: boolean;
}

export interface PackResult {
  content: string;
  allocations?: BudgetAllocation[];
}

export async function generateContextPack(projectPath: string, memory: ProjectMemory, options: PackOptions): Promise<PackResult> {
  if (!memory.knowledgeGraph) {
    throw new Error('Knowledge Graph is required to generate Context Packs. Run `project-mind update` first.');
  }

  await pluginRegistry.loadPlugins(projectPath);
  const plugins = pluginRegistry.getPlugins();

  const { topic, isCurrent, level, scope, explainBudget } = options;
  const budget = options.budget || (level === 'full' ? 10000 : 3000);

  let actualTopic = topic;
  if (isCurrent) {
    actualTopic = memory.focusHistory?.active?.feature || 'Project Overview';
  }

  let queryTerm = actualTopic;
  if (actualTopic.startsWith('component:')) queryTerm = actualTopic.split(':')[1];
  else if (actualTopic.startsWith('feature:')) queryTerm = actualTopic.split(':')[1];

  // 1 & 2. Resolve Scope and Build Scoped Subgraph
  let scopedNodes = memory.knowledgeGraph.nodes;
  let prunedCount = { decisions: 0, workflows: 0, architecture: 0, features: 0, other: 0 };
  
  if (scope) {
    // A node is in scope if its label includes the scope path, or if it's a structural component
    // that affects the scope. For simplicity, we filter by string inclusion in id/label or properties.
    const normalizedScope = scope.replace(/\\/g, '/').toLowerCase();
    
    scopedNodes = memory.knowledgeGraph.nodes.filter(n => {
      // Keep global things by default unless they are clearly tied to other scopes
      if (n.type === 'agent' || n.type === 'timeline') return true;
      
      const text = `${n.id} ${n.label} ${JSON.stringify(n.properties || {})}`.toLowerCase();
      const inScope = text.includes(normalizedScope);
      
      if (!inScope) {
        if (n.type === 'decision') prunedCount.decisions++;
        else if (n.type === 'workflow') prunedCount.workflows++;
        else if (n.type === 'component') prunedCount.architecture++;
        else if (n.type === 'feature') prunedCount.features++;
        else prunedCount.other++;
      }
      return inScope;
    });
  }

  // Create a temporary scoped graph
  const scopedGraph = {
    nodes: scopedNodes,
    edges: memory.knowledgeGraph.edges.filter(e => 
      scopedNodes.some(n => n.id === e.source) && scopedNodes.some(n => n.id === e.target)
    )
  };

  // 3. Calculate Graph Distance
  const queryResult = queryGraph(scopedGraph, queryTerm, 3);
  
  // 4. Classify Context Importance
  // Group nodes by Class and Depth
  type NodeGroup = { type: string, depth: number, nodes: GraphNodeWithDepth[] };
  const groups: Record<string, NodeGroup> = {
    'Critical_D0': { type: 'Critical', depth: 0, nodes: [] },
    'Critical_D1': { type: 'Critical', depth: 1, nodes: [] },
    'Important_D0': { type: 'Important', depth: 0, nodes: [] },
    'Important_D1': { type: 'Important', depth: 1, nodes: [] },
    'Reference_D0': { type: 'Reference', depth: 0, nodes: [] },
    'Reference_D1': { type: 'Reference', depth: 1, nodes: [] },
    'Any_D2+': { type: 'Reference', depth: 2, nodes: [] }
  };

  for (const nwd of queryResult.nodesWithDepth) {
    const t = nwd.node.type;
    let cls = 'Reference';
    if (t === 'decision') cls = 'Critical';
    else if (t === 'component' || t === 'feature' || t === 'workflow') cls = 'Important';

    const d = nwd.depth >= 2 ? '2+' : nwd.depth.toString();
    if (d === '2+') groups['Any_D2+'].nodes.push(nwd);
    else groups[`${cls}_D${d}`].nodes.push(nwd);
  }

  // 5. Reserve Minimum Critical Context
  // Estimate tokens: roughly 4 chars = 1 token
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  
  let reservedTokens = 0;
  let focusText = '';
  if (isCurrent && memory.focusHistory.active) {
    const active = memory.focusHistory.active;
    focusText += `## Current Active Task\n**Task:** ${active.task}\n**Status:** ${active.status}\n`;
    if (active.blockers.length > 0) focusText += `### Blockers\n` + active.blockers.map(b => `- ${b}\n`).join('');
    const drift = detectScopeDrift(memory);
    if (drift.hasDrift) focusText += `### Scope Drift ⚠\n` + drift.extraModules.map(m => `- ${m}\n`).join('');
    reservedTokens += estimateTokens(focusText);
  }

  // Add minimum for decisions (Summary level)
  const criticalDecisionsText = groups['Critical_D0'].nodes.map(n => `- **${n.node.label}**\n`).join('');
  reservedTokens += estimateTokens(criticalDecisionsText);

  // Add metadata header baseline tokens
  const headerTokens = 50; 
  reservedTokens += headerTokens;

  if (budget < reservedTokens) {
    throw new Error(`Budget too small. Minimum viable context requires ${reservedTokens} tokens. Suggested: project-mind pack --budget ${Math.ceil(reservedTokens * 1.2)}`);
  }

  // 6 & 7. Allocate Remaining Budget & Apply Progressive Degradation
  let remainingBudget = budget - reservedTokens;
  const allocations: BudgetAllocation[] = [];

  // Focus is critical
  allocations.push({
    section: 'Current Focus & Blockers',
    priority: 'Critical',
    detailLevel: 'full',
    estimatedTokens: estimateTokens(focusText)
  });

  const generateNodeText = async (nwd: GraphNodeWithDepth, level: 'full'|'summary'|'reference'): Promise<string> => {
    let out = '';
    if (level === 'reference') return `- [${nwd.node.type}] ${nwd.node.label}\n`;
    if (level === 'summary') {
      out = `- **${nwd.node.label}**`;
      if (nwd.node.type === 'decision' && nwd.node.properties?.reason) out += ` (Reason: ${nwd.node.properties.reason})`;
      return out + '\n';
    }
    // Full
    out = `- **${nwd.node.label}**\n`;
    if (nwd.node.properties) {
      for (const [k, v] of Object.entries(nwd.node.properties)) {
        if (typeof v === 'string' && v.length < 100) out += `  - ${k}: ${v}\n`;
      }
    }
    if (nwd.node.type === 'file') {
      try {
        const content = await fs.readFile(path.join(projectPath, nwd.node.label), 'utf-8');
        out += `\n\`\`\`\n${content.substring(0, 3000)}\n\`\`\`\n`; // safety cap
      } catch {}
    }
    return out;
  };

  const processGroup = async (groupName: string, priority: 'Critical'|'Important'|'Reference', nodes: GraphNodeWithDepth[]) => {
    if (nodes.length === 0) return '';
    
    // Test levels
    const refText = (await Promise.all(nodes.map(n => generateNodeText(n, 'reference')))).join('');
    const sumText = (await Promise.all(nodes.map(n => generateNodeText(n, 'summary')))).join('');
    let fullText = sumText; // fallback if files aren't evaluated
    if (priority === 'Critical' || priority === 'Important' || groupName.includes('Reference_D0')) {
       fullText = (await Promise.all(nodes.map(n => generateNodeText(n, 'full')))).join('');
    }

    const tFull = estimateTokens(fullText);
    const tSum = estimateTokens(sumText);
    const tRef = estimateTokens(refText);

    let selectedLevel: 'full' | 'summary' | 'reference' | 'dropped' = 'dropped';
    let finalText = '';
    let usedT = 0;

    if (priority === 'Critical') {
       if (remainingBudget >= tFull) { selectedLevel = 'full'; finalText = fullText; usedT = tFull; }
       else { selectedLevel = 'summary'; finalText = sumText; usedT = tSum; }
    } else {
       if (remainingBudget >= tFull) { selectedLevel = 'full'; finalText = fullText; usedT = tFull; }
       else if (remainingBudget >= tSum) { selectedLevel = 'summary'; finalText = sumText; usedT = tSum; }
       else if (remainingBudget >= tRef) { selectedLevel = 'reference'; finalText = refText; usedT = tRef; }
       else { selectedLevel = 'dropped'; }
    }

    remainingBudget -= usedT;
    
    allocations.push({
      section: groupName,
      priority,
      detailLevel: selectedLevel,
      estimatedTokens: usedT
    });

    return finalText ? `\n### ${groupName.replace('_', ' ')}\n` + finalText : '';
  };

  const priorityOrder = [
    { name: 'Critical_D0', prio: 'Critical' },
    { name: 'Critical_D1', prio: 'Critical' },
    { name: 'Important_D0', prio: 'Important' },
    { name: 'Important_D1', prio: 'Important' },
    { name: 'Reference_D0', prio: 'Reference' },
    { name: 'Reference_D1', prio: 'Reference' },
    { name: 'Any_D2+', prio: 'Reference' }
  ] as const;

  let bodyText = '';
  for (const step of priorityOrder) {
    bodyText += await processGroup(step.name, step.prio, groups[step.name].nodes);
  }

  // 8. Generate Markdown Pack
  let pack = '---\n';
  pack += `generatedAt: ${new Date().toISOString()}\n`;
  pack += `feature: ${actualTopic}\n`;
  pack += `knowledgeVersion: ${memory.version}\n`;
  pack += `focus: ${memory.focusHistory.active?.task || 'None'}\n`;
  pack += '---\n\n';

  if (scope && Object.values(prunedCount).some(v => v > 0)) {
    pack += `> [!WARNING]\n> **Scope pruning removed:**\n`;
    if (prunedCount.decisions) pack += `> - ${prunedCount.decisions} Decisions\n`;
    if (prunedCount.workflows) pack += `> - ${prunedCount.workflows} Workflows\n`;
    if (prunedCount.architecture) pack += `> - ${prunedCount.architecture} Architecture Nodes\n`;
    if (prunedCount.features) pack += `> - ${prunedCount.features} Features\n`;
    pack += '\n';
  }

  pack += `# Context Pack: ${actualTopic}\n\n`;
  pack += focusText;
  pack += bodyText;

  // Plugins
  const packContext: PackContext = { topic: actualTopic, isCurrent, level, memory };
  for (const plugin of plugins) {
    if (plugin.onPackGeneration && plugin.capabilities.includes('pack')) {
      try {
        const sections = await plugin.onPackGeneration(packContext);
        if (sections && sections.length > 0) {
          sections.forEach(sec => {
            const secText = `\n## ${sec.title}\n${sec.content}\n`;
            const tokens = estimateTokens(secText);
            if (remainingBudget >= tokens) {
              pack += secText;
              remainingBudget -= tokens;
              allocations.push({ section: `Plugin:${sec.title}`, priority: 'Reference', detailLevel: 'full', estimatedTokens: tokens });
            }
          });
        }
      } catch {}
    }
  }

  // 9. Verify Compliance and Save Allocation
  if (explainBudget) {
    const derivedDir = path.join(projectPath, '.project-mind', 'derived');
    await fs.mkdir(derivedDir, { recursive: true });
    await fs.writeFile(
      path.join(derivedDir, 'PACK_ALLOCATION.json'), 
      JSON.stringify({ budget, reservedTokens, usedTokens: budget - remainingBudget, allocations }, null, 2)
    );
  }

  return { content: pack.trim(), allocations };
}
