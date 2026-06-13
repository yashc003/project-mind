// ============================================================================
// Tests — Architecture Detection
// ============================================================================

import { describe, it, expect } from 'vitest';
import { detectArchitecture } from '../../src/engines/architecture/index.js';
import { createEmptyEvidence } from '../../src/engines/memory/schema.js';
import type { EvidenceSources, DirectoryNode } from '../../src/types/index.js';

describe('Architecture Detection', () => {
  it('returns empty architecture for empty evidence', () => {
    const evidence = createEmptyEvidence();
    const arch = detectArchitecture(evidence);

    expect(arch.pattern).toBeNull();
    expect(arch.layers).toEqual([]);
    expect(arch.components).toEqual([]);
    expect(arch.confidence).toBe(0);
  });

  it('detects MVC-like architecture from directory names', () => {
    const evidence = createEmptyEvidence();
    evidence.sourceCode.totalFiles = 30;
    evidence.sourceCode.directoryStructure = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          makeDir('controllers'),
          makeDir('services'),
          makeDir('models'),
          makeDir('views'),
          makeDir('utils'),
        ],
      },
    ];

    const arch = detectArchitecture(evidence);
    expect(arch.components.length).toBeGreaterThanOrEqual(4);
    expect(arch.layers.length).toBeGreaterThanOrEqual(3);
    expect(arch.confidence).toBeGreaterThan(0);
  });

  it('detects component-based architecture from React-like structure', () => {
    const evidence = createEmptyEvidence();
    evidence.sourceCode.totalFiles = 20;
    evidence.sourceCode.directoryStructure = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          makeDir('components'),
          makeDir('pages'),
          makeDir('utils'),
        ],
      },
    ];
    evidence.buildFiles.frameworks = [
      { name: 'react', version: '18.0', category: 'web', confidence: 95 },
    ];

    const arch = detectArchitecture(evidence);
    expect(arch.pattern).toBe('component-based');
    expect(arch.components.some(c => c.type === 'component')).toBe(true);
  });

  it('detects layered architecture from backend structure', () => {
    const evidence = createEmptyEvidence();
    evidence.sourceCode.totalFiles = 30;
    evidence.sourceCode.directoryStructure = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          makeDir('controllers'),
          makeDir('services'),
          makeDir('repositories'),
          makeDir('middleware'),
        ],
      },
    ];
    evidence.buildFiles.frameworks = [
      { name: '@nestjs/core', version: '10.0', category: 'api', confidence: 95 },
    ];

    const arch = detectArchitecture(evidence);
    expect(arch.pattern).toBe('layered');
  });

  it('assigns correct component types', () => {
    const evidence = createEmptyEvidence();
    evidence.sourceCode.directoryStructure = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          makeDir('controllers'),
          makeDir('services'),
          makeDir('models'),
          makeDir('middleware'),
          makeDir('tests'),
          makeDir('utils'),
        ],
      },
    ];

    const arch = detectArchitecture(evidence);
    const types = arch.components.map(c => c.type);
    expect(types).toContain('controller');
    expect(types).toContain('service');
    expect(types).toContain('model');
    expect(types).toContain('middleware');
    expect(types).toContain('test');
    expect(types).toContain('utility');
  });

  it('increases confidence with frameworks detected', () => {
    const evidenceWithFramework = createEmptyEvidence();
    evidenceWithFramework.sourceCode.totalFiles = 10;
    evidenceWithFramework.sourceCode.directoryStructure = [makeDir('src')];
    evidenceWithFramework.buildFiles.frameworks = [
      { name: 'express', version: '4.0', category: 'api', confidence: 95 },
    ];
    evidenceWithFramework.buildFiles.buildSystems = [
      { name: 'npm', configFile: 'package.json', language: 'JS' },
    ];

    const evidenceWithout = createEmptyEvidence();
    evidenceWithout.sourceCode.totalFiles = 10;
    evidenceWithout.sourceCode.directoryStructure = [makeDir('src')];

    const withFramework = detectArchitecture(evidenceWithFramework);
    const withoutFramework = detectArchitecture(evidenceWithout);

    expect(withFramework.confidence).toBeGreaterThan(withoutFramework.confidence);
  });
});

function makeDir(name: string): DirectoryNode {
  return {
    name,
    path: name,
    type: 'directory',
    children: [
      { name: 'index.ts', path: `${name}/index.ts`, type: 'file', language: 'TypeScript' },
    ],
  };
}
