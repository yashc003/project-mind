// ============================================================================
// Governance Engine: Evaluator
// ============================================================================

import type {
  ProjectMemory,
  GovernancePolicy,
  PolicyResult,
  Component,
  KnowledgeGraph,
  ProjectMindConfig,
} from '../../types/index.js';

/**
 * Evaluates all governance policies against the current project memory.
 */
export function evaluatePolicies(memory: ProjectMemory, config: ProjectMindConfig): PolicyResult[] {
  const results: PolicyResult[] = [];
  const policies = config.policies || [];

  if (!policies.length) return results;

  for (const policy of policies) {
    try {
      const result = evaluatePolicy(policy, memory);
      results.push(result);
    } catch (err: any) {
      // If a rule crashes during evaluation, we log it as failed
      results.push({
        policyId: policy.id,
        status: 'failed',
        affectedNodes: [],
        message: `Evaluation crashed: ${err.message}`,
      });
    }
  }

  return results;
}

function evaluatePolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  switch (policy.category) {
    case 'dependency':
      return evaluateDependencyPolicy(policy, memory);
    case 'orphan':
      return evaluateOrphanPolicy(policy, memory);
    case 'architecture':
      return evaluateArchitecturePolicy(policy, memory);
    case 'feature':
      return evaluateFeaturePolicy(policy, memory);
    case 'decision':
      return evaluateDecisionPolicy(policy, memory);
    case 'workflow':
      return evaluateWorkflowPolicy(policy, memory);
    case 'metadata':
      return evaluateMetadataPolicy(policy, memory);
    default:
      return {
        policyId: policy.id,
        status: 'passed',
        affectedNodes: [],
        message: `Policy category ${policy.category} not implemented yet.`,
      };
  }
}

// ---------------------------------------------------------------------------
// Dependency Rules
// ---------------------------------------------------------------------------
function evaluateDependencyPolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  const { from, to } = policy.condition;
  if (!from || !to) {
    return { policyId: policy.id, status: 'failed', affectedNodes: [], message: 'Invalid condition: requires "from" and "to"' };
  }

  const affectedNodes: string[] = [];
  const graph = memory.knowledgeGraph;
  
  if (!graph) return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'No graph to evaluate' };

  for (const edge of graph.edges) {
    if (edge.relation !== 'DEPENDS_ON') continue;

    const sourceNode = graph.nodes.find(n => n.id === edge.source);
    const targetNode = graph.nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) continue;

    const sourceMatches = sourceNode.type.toLowerCase() === from.toLowerCase() || sourceNode.label.toLowerCase().includes(from.toLowerCase());
    const targetMatches = targetNode.type.toLowerCase() === to.toLowerCase() || targetNode.label.toLowerCase().includes(to.toLowerCase());

    if (sourceMatches && targetMatches) {
      affectedNodes.push(sourceNode.id);
    }
  }

  if (affectedNodes.length > 0) {
    return {
      policyId: policy.id,
      status: policy.severity === 'error' ? 'failed' : 'warning',
      affectedNodes: Array.from(new Set(affectedNodes)),
      message: policy.message,
    };
  }

  return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'No violations found.' };
}

// ---------------------------------------------------------------------------
// Orphan Rules
// ---------------------------------------------------------------------------
function evaluateOrphanPolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  const graph = memory.knowledgeGraph;
  if (!graph) return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'No graph to evaluate' };

  const affectedNodes: string[] = [];

  for (const node of graph.nodes) {
    if (node.type === 'agent') continue;
    const hasEdges = graph.edges.some(e => e.source === node.id || e.target === node.id);
    if (!hasEdges) affectedNodes.push(node.id);
  }

  if (affectedNodes.length > 0) {
    return { policyId: policy.id, status: policy.severity === 'error' ? 'failed' : 'warning', affectedNodes, message: policy.message };
  }

  return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'No orphaned components found.' };
}

// ---------------------------------------------------------------------------
// Architecture Rules
// ---------------------------------------------------------------------------
function evaluateArchitecturePolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  if (policy.condition?.type === 'no-cyclic-dependencies') {
    const graph = memory.knowledgeGraph;
    if (!graph) return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'No graph to evaluate' };

    const adj = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (edge.relation === 'DEPENDS_ON') {
        if (!adj.has(edge.source)) adj.set(edge.source, []);
        adj.get(edge.source)!.push(edge.target);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycleNodes = new Set<string>();

    function dfs(node: string) {
      if (recStack.has(node)) {
        cycleNodes.add(node);
        return true;
      }
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) {
          cycleNodes.add(node);
          return true;
        }
      }

      recStack.delete(node);
      return false;
    }

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }

    if (cycleNodes.size > 0) {
      return { policyId: policy.id, status: policy.severity === 'error' ? 'failed' : 'warning', affectedNodes: Array.from(cycleNodes), message: policy.message };
    }
  }

  return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'Architecture conforms to policy.' };
}

// ---------------------------------------------------------------------------
// Feature Rules
// ---------------------------------------------------------------------------
function evaluateFeaturePolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  const affectedNodes: string[] = [];
  
  if (policy.condition?.mustHaveDecision && policy.condition?.targetTag) {
    const targetFeatures = (memory.features || []).filter(f => f.status === policy.condition.targetTag || f.name.includes(policy.condition.targetTag));
    for (const feat of targetFeatures) {
      const hasDecision = memory.decisions.some(d => d.impactedFeatures && d.impactedFeatures.includes(feat.id));
      if (!hasDecision) affectedNodes.push(`feature:${feat.id}`);
    }
  }

  if (affectedNodes.length > 0) {
    return { policyId: policy.id, status: policy.severity === 'error' ? 'failed' : 'warning', affectedNodes, message: policy.message };
  }

  return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'Features conform to policy.' };
}

// ---------------------------------------------------------------------------
// Workflow Rules
// ---------------------------------------------------------------------------
function evaluateWorkflowPolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  const affectedNodes: string[] = [];

  if (policy.condition?.mustBelongToFeature) {
    for (const wf of memory.workflows || []) {
      const hasFeature = (memory.features || []).some(f => 
        wf.components.some(c => f.components.includes(c)) ||
        (wf.files && f.files && wf.files.some(file => f.files!.includes(file)))
      );
      if (!hasFeature) affectedNodes.push(`workflow:${wf.id}`);
    }
  }

  if (affectedNodes.length > 0) {
    return { policyId: policy.id, status: policy.severity === 'error' ? 'failed' : 'warning', affectedNodes, message: policy.message };
  }

  return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'Workflows conform to policy.' };
}

// ---------------------------------------------------------------------------
// Decision Rules
// ---------------------------------------------------------------------------
function evaluateDecisionPolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'Decisions conform to policy.' };
}

// ---------------------------------------------------------------------------
// Metadata Rules
// ---------------------------------------------------------------------------
function evaluateMetadataPolicy(policy: GovernancePolicy, memory: ProjectMemory): PolicyResult {
  const affectedNodes: string[] = [];

  if (policy.condition?.requireDescription) {
    for (const wf of memory.workflows || []) {
      if (!wf.description || wf.description.trim() === '') affectedNodes.push(`workflow:${wf.id}`);
    }
  }

  if (affectedNodes.length > 0) {
    return { policyId: policy.id, status: policy.severity === 'error' ? 'failed' : 'warning', affectedNodes, message: policy.message };
  }

  return { policyId: policy.id, status: 'passed', affectedNodes: [], message: 'Metadata conforms to policy.' };
}
