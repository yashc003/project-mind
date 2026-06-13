// ============================================================================
// Governance Engine: Metrics
// ============================================================================

import type { ProjectMemory, PolicyResult, GovernanceMetrics, ProjectMindConfig } from '../../types/index.js';

/**
 * Calculates the governance metrics and architecture score.
 * Scoring Base: 100
 * - Warning: -2
 * - Error: -10
 * - Expired Exception: -15
 */
export function calculateMetrics(
  memory: ProjectMemory,
  config: ProjectMindConfig,
  results: PolicyResult[]
): GovernanceMetrics {
  let score = 100;
  let passedCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let debtCount = 0;

  const policies = config.policies || [];
  const exceptions = config.exceptions || [];

  // Check exceptions for expirations
  const now = new Date();
  for (const ex of exceptions) {
    if (new Date(ex.expires) < now) {
      score -= 15;
    }
    debtCount++;
  }

  for (const result of results) {
    if (result.status === 'passed') {
      passedCount++;
    } else if (result.status === 'warning') {
      warningCount++;
      // A policy might affect multiple nodes, but we score per policy failure
      score -= 2;
    } else if (result.status === 'failed') {
      errorCount++;
      // Find if all affected nodes have an active exception
      let allExcepted = true;
      if (result.affectedNodes.length === 0) allExcepted = false;

      for (const node of result.affectedNodes) {
        const hasActiveException = exceptions.some(
          ex => ex.policyId === result.policyId && ex.targetId === node && new Date(ex.expires) >= now
        );
        if (!hasActiveException) {
          allExcepted = false;
          break;
        }
      }

      if (!allExcepted) {
        // Find the policy to check if it's actually an error or a warned failure
        const policy = policies.find(p => p.id === result.policyId);
        if (policy?.severity === 'error') {
          score -= 10;
        } else {
          score -= 2;
        }
      } else {
        // Technically this failure is currently excused by an exception
        // We'll treat it as a warning penalty instead of a full error penalty
        score -= 2; 
      }
    }
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return {
    architectureScore: score,
    totalPolicies: policies.length,
    passedPolicies: passedCount,
    warningCount,
    errorCount,
    debtCount,
  };
}
