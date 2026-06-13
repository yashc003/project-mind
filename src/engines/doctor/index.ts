// ============================================================================
// Doctor Engine (v0.3)
// ============================================================================

import type { ProjectMemory } from '../../types/index.js';

export interface DiagnosticIssue {
  type: 'missing-intent' | 'orphaned-decision' | 'context-gap' | 'stale-focus';
  severity: 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
}

export function runDiagnostics(memory: ProjectMemory): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  // 1. Missing Intent (Features without decisions/lifecycle)
  if (memory.features) {
    for (const feature of memory.features) {
      const hasDecision = memory.decisions.some(d => d.impactedFeatures?.includes(feature.name));
      const focusHistoryActive = memory.focusHistory?.active?.feature === feature.name;
      const focusHistoryPast = memory.focusHistory?.history?.some(h => h.feature === feature.name) || false;

      if (!hasDecision && !focusHistoryActive && !focusHistoryPast) {
        issues.push({
          type: 'missing-intent',
          severity: 'medium',
          message: `Feature Detected: ${feature.name}. No Decision or Lifecycle Found.`,
          recommendation: `Run \`project-mind start-feature --feature ${feature.name}\``
        });
      }
    }
  }

  // 2. Orphaned Decisions
  for (const decision of memory.decisions) {
    if ((!decision.impactedFeatures || decision.impactedFeatures.length === 0) &&
        (!decision.impactedComponents || decision.impactedComponents.length === 0)) {
      issues.push({
        type: 'orphaned-decision',
        severity: 'low',
        message: `Decision "${decision.title}" is not linked to any feature or component.`,
        recommendation: `Review and link the decision, or let project-mind extract context automatically.`
      });
    }
  }

  // 3. Stale Focus
  const activeFocus = memory.focusHistory?.active;
  if (activeFocus && activeFocus.status === 'in-progress') {
    const lastUpdated = new Date(activeFocus.lastUpdated).getTime();
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    if (lastUpdated < twoWeeksAgo) {
      issues.push({
        type: 'stale-focus',
        severity: 'high',
        message: `Current focus "${activeFocus.feature}" has been in-progress for over 2 weeks.`,
        recommendation: `Run \`project-mind complete-feature\` or update its status.`
      });
    }
  }

  // 4. Context Gaps (Undocumented Architecture Layers)
  if (memory.architecture && memory.architecture.components) {
    const undocumentedCount = memory.architecture.components.filter(c => c.confidence < 50).length;
    if (undocumentedCount > 0) {
      issues.push({
        type: 'context-gap',
        severity: 'medium',
        message: `Found ${undocumentedCount} architectural components with low confidence (undocumented).`,
        recommendation: `Add a \`.project-mind.json\` to define custom customArchitectureRules, or run \`project-mind note\` to explain them.`
      });
    }
  }

  return issues;
}
