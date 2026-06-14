import { describe, it, expect } from 'vitest';
import { generateContextPack } from '../../src/engines/pack/index.js';
import type { ProjectMemory } from '../../src/types/index.js';

describe('Context Relevance Engine', () => {
  const mockMemory: ProjectMemory = {
    version: '1.0.0',
    config: {},
    focusHistory: {
      active: {
        task: 'Implement Auth',
        feature: 'Authentication',
        status: 'in-progress',
        subTasks: [],
        blockers: ['Need API keys'],
        expectedModules: ['src/auth.ts'],
        actualModules: [],
        linkedCommits: [],
        lastUpdated: new Date().toISOString()
      },
      history: []
    },
    features: [],
    decisions: [],
    architecture: { components: [], layers: [] },
    workflows: [],
    knowledgeGraph: {
      nodes: [
        { id: 'f1', type: 'feature', label: 'Authentication', properties: {} },
        { id: 'd1', type: 'decision', label: 'Use JWT', properties: { reason: 'Stateless' } },
        { id: 'c1', type: 'component', label: 'Auth Service', properties: {} },
        { id: 'file1', type: 'file', label: 'src/auth.ts', properties: {} },
        { id: 'file2', type: 'file', label: 'src/backend/db.ts', properties: {} }
      ],
      edges: [
        { source: 'f1', target: 'd1', type: 'has_decision' },
        { source: 'f1', target: 'c1', type: 'has_component' },
        { source: 'c1', target: 'file1', type: 'implemented_in' },
        { source: 'c1', target: 'file2', type: 'depends_on' }
      ]
    }
  };

  it('generates a pack within budget', async () => {
    const res = await generateContextPack('.', mockMemory, { topic: 'current', isCurrent: true, level: 'compact', budget: 5000 });
    expect(res.content).toContain('Context Pack: Authentication');
    expect(res.content).toContain('Current Active Task');
  });

  it('throws if budget is too small for minimum viable context', async () => {
    await expect(generateContextPack('.', mockMemory, { topic: 'current', isCurrent: true, level: 'compact', budget: 10 }))
      .rejects.toThrow(/Budget too small/);
  });

  it('prunes scope properly', async () => {
    const res = await generateContextPack('.', mockMemory, { topic: 'current', isCurrent: true, level: 'compact', scope: 'src/auth' });
    expect(res.content).toContain('Scope pruning removed:');
  });
});
