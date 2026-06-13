// ============================================================================
// Context Extraction Engine (v0.3)
// ============================================================================

import crypto from 'node:crypto';
import type { Decision, DeveloperNote, ProjectMemory } from '../../types/index.js';

export interface ExtractionResult {
  decisions: Decision[];
  notes: DeveloperNote[];
}

export function extractContext(markdown: string, memory: ProjectMemory): ExtractionResult {
  const decisions: Decision[] = [];
  const notes: DeveloperNote[] = [];

  const lines = markdown.split('\n');
  
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;

    // --- Decision Extraction ---
    // High confidence
    if (/(?:we decided to|decided on|chose to|let's use) (.+) instead of (.+)/i.test(text)) {
      const match = text.match(/(?:we decided to|decided on|chose to|let's use) (.+) instead of (.+)/i);
      if (match) {
        decisions.push(createDecision(match[1], `Extracted: ${match[1]}`, text, [match[2]], 90, memory));
      }
    }
    else if (/(?:decision:|decided:)\s*(.+)/i.test(text)) {
      const match = text.match(/(?:decision:|decided:)\s*(.+)/i);
      if (match) {
        decisions.push(createDecision(match[1], `Extracted Decision`, text, [], 95, memory));
      }
    }
    // Low confidence (false positive mitigation)
    else if (/(?:maybe we should|what if we|could use) (.+)/i.test(text)) {
      const match = text.match(/(?:maybe we should|what if we|could use) (.+)/i);
      if (match) {
        decisions.push(createDecision(match[1], `Potential Idea: ${match[1]}`, text, [], 30, memory));
      }
    }
    else if (/use (.+) because (.+)/i.test(text)) {
      const match = text.match(/use (.+) because (.+)/i);
      if (match) {
        decisions.push(createDecision(match[1], `Use ${match[1]}`, match[2], [], 75, memory));
      }
    }

    // --- Note Extraction ---
    if (/(?:note:|important:|remember to)\s*(.+)/i.test(text)) {
      const match = text.match(/(?:note:|important:|remember to)\s*(.+)/i);
      if (match) {
        notes.push({
          id: crypto.randomBytes(4).toString('hex'),
          content: match[1],
          timestamp: new Date().toISOString(),
          tags: ['extracted'],
        });
      }
    }
  }

  // Filter out low confidence decisions (below 50%)
  const confidentDecisions = decisions.filter(d => d.confidence >= 50);

  return { decisions: confidentDecisions, notes };
}

function createDecision(
  title: string, 
  reason: string, 
  description: string, 
  rejected: string[], 
  confidence: number,
  memory: ProjectMemory
): Decision {
  const activeFeature = memory.focusHistory.active?.feature;
  const impactedFeatures = new Set<string>();
  const impactedComponents = new Set<string>();

  if (activeFeature) impactedFeatures.add(activeFeature);

  // Search for keywords matching existing features or architecture components
  const searchStr = `${title} ${description} ${reason} ${rejected.join(' ')}`.toLowerCase();

  memory.features?.forEach(f => {
    if (searchStr.includes(f.name.toLowerCase())) {
      impactedFeatures.add(f.name);
    }
  });

  memory.architecture.components.forEach(c => {
    if (searchStr.includes(c.name.toLowerCase())) {
      impactedComponents.add(c.name);
    }
  });

  return {
    id: crypto.randomBytes(4).toString('hex'),
    title: title.trim(),
    description: description.trim(),
    rejected: rejected.map(r => r.trim()),
    reason: reason.trim(),
    timestamp: new Date().toISOString(),
    source: 'conversation',
    tags: ['extracted'],
    confidence,
    impactedFeatures: Array.from(impactedFeatures),
    impactedComponents: Array.from(impactedComponents),
  };
}
