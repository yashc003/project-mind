import { describe, it, expect } from 'vitest';
import { evaluatePolicies } from '../../src/engines/governance/evaluator.js';
import { createEmptyMemory } from '../../src/engines/memory/schema.js';
import type { GovernancePolicy, ProjectMindConfig, ProjectMemory } from '../../src/types/index.js';

describe('Governance Evaluator', () => {
  it('returns empty array when no policies exist', () => {
    const memory = createEmptyMemory('Test');
    const config: ProjectMindConfig = { version: '1.0.0' } as any;
    
    const results = evaluatePolicies(memory, config);
    expect(results).toEqual([]);
  });

  describe('Dependency Policies', () => {
    it('detects violations in DEPENDS_ON relations', () => {
      const memory = createEmptyMemory('Test');
      memory.knowledgeGraph = {
        nodes: [
          { id: '1', type: 'component', label: 'src/ui/Button.tsx' },
          { id: '2', type: 'component', label: 'src/db/query.ts' },
        ],
        edges: [
          { source: '1', target: '2', relation: 'DEPENDS_ON' }
        ]
      };

      const config: ProjectMindConfig = {
        version: '1.0.0',
        policies: [
          {
            id: 'ui-no-db',
            name: 'UI must not access DB',
            category: 'dependency',
            severity: 'error',
            enforcement: 'blocking',
            condition: { from: 'ui', to: 'db' },
            message: 'UI components must not directly import DB queries.'
          }
        ]
      } as any;

      const results = evaluatePolicies(memory, config);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].affectedNodes).toContain('1');
    });

    it('passes when no violations exist', () => {
      const memory = createEmptyMemory('Test');
      memory.knowledgeGraph = {
        nodes: [
          { id: '1', type: 'component', label: 'src/ui/Button.tsx' },
          { id: '2', type: 'component', label: 'src/api/client.ts' },
        ],
        edges: [
          { source: '1', target: '2', relation: 'DEPENDS_ON' }
        ]
      };

      const config: ProjectMindConfig = {
        version: '1.0.0',
        policies: [
          {
            id: 'ui-no-db',
            name: 'UI must not access DB',
            category: 'dependency',
            severity: 'error',
            enforcement: 'blocking',
            condition: { from: 'ui', to: 'db' },
            message: 'UI components must not directly import DB queries.'
          }
        ]
      } as any;

      const results = evaluatePolicies(memory, config);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('passed');
      expect(results[0].affectedNodes).toHaveLength(0);
    });
  });

  describe('Architecture Policies', () => {
    it('detects cyclic dependencies', () => {
      const memory = createEmptyMemory('Test');
      memory.knowledgeGraph = {
        nodes: [
          { id: 'A', type: 'component', label: 'A' },
          { id: 'B', type: 'component', label: 'B' },
          { id: 'C', type: 'component', label: 'C' },
        ],
        edges: [
          { source: 'A', target: 'B', relation: 'DEPENDS_ON' },
          { source: 'B', target: 'C', relation: 'DEPENDS_ON' },
          { source: 'C', target: 'A', relation: 'DEPENDS_ON' },
        ]
      };

      const config: ProjectMindConfig = {
        version: '1.0.0',
        policies: [
          {
            id: 'no-cycles',
            name: 'No Cyclic Dependencies',
            category: 'architecture',
            severity: 'error',
            enforcement: 'blocking',
            condition: { type: 'no-cyclic-dependencies' },
            message: 'Cyclic dependencies detected.'
          }
        ]
      } as any;

      const results = evaluatePolicies(memory, config);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].affectedNodes).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    });
  });

  describe('Orphan Policies', () => {
    it('detects orphaned components', () => {
      const memory = createEmptyMemory('Test');
      memory.knowledgeGraph = {
        nodes: [
          { id: '1', type: 'component', label: 'Connected' },
          { id: '2', type: 'component', label: 'Orphan' },
          { id: 'agent-1', type: 'agent', label: 'AI' } // Agents shouldn't count as orphans
        ],
        edges: [
          { source: '1', target: '1', relation: 'DEPENDS_ON' } // Self edge just to show it's connected
        ]
      };

      const config: ProjectMindConfig = {
        version: '1.0.0',
        policies: [
          {
            id: 'no-orphans',
            name: 'No Orphans',
            category: 'orphan',
            severity: 'warning',
            enforcement: 'advisory',
            condition: {},
            message: 'Orphaned components found.'
          }
        ]
      } as any;

      const results = evaluatePolicies(memory, config);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('warning');
      expect(results[0].affectedNodes).toContain('2');
      expect(results[0].affectedNodes).not.toContain('1');
      expect(results[0].affectedNodes).not.toContain('agent-1');
    });
  });

  describe('Metadata Policies', () => {
    it('requires description for workflows', () => {
      const memory = createEmptyMemory('Test');
      memory.workflows = [
        { id: '1', name: 'Valid Workflow', description: 'This is valid', type: 'generic', components: [], files: [], confidence: 100 },
        { id: '2', name: 'Invalid Workflow', description: '', type: 'generic', components: [], files: [], confidence: 100 }
      ];

      const config: ProjectMindConfig = {
        version: '1.0.0',
        policies: [
          {
            id: 'wf-desc',
            name: 'Workflows Must Have Description',
            category: 'metadata',
            severity: 'error',
            enforcement: 'blocking',
            condition: { requireDescription: true },
            message: 'Workflow is missing description.'
          }
        ]
      } as any;

      const results = evaluatePolicies(memory, config);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].affectedNodes).toContain('workflow:2');
    });
  });
});
