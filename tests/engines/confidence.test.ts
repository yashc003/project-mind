// ============================================================================
// Tests — Confidence Scoring
// ============================================================================

import { describe, it, expect } from 'vitest';
import { computeConfidence } from '../../src/utils/confidence.js';
import {
  createEmptyEvidence,
  createEmptyArchitecture,
} from '../../src/engines/memory/schema.js';
import type { EvidenceSources, ArchitectureModel, Decision } from '../../src/types/index.js';

describe('Confidence Scoring', () => {
  it('returns zero confidence for empty evidence', () => {
    const evidence = createEmptyEvidence();
    const architecture = createEmptyArchitecture();
    const scores = computeConfidence(evidence, architecture, []);

    expect(scores.overall).toBe(0);
    expect(scores.architecture).toBe(0);
    expect(scores.evidence).toBe(0);
    expect(scores.evidenceSources).toBe(0);
  });

  it('increases confidence when Git evidence is available', () => {
    const evidence = createEmptyEvidence();
    evidence.git = {
      isGitRepo: true,
      totalCommits: 50,
      authors: [{ name: 'Dev', email: 'dev@test.com', commitCount: 50 }],
      branches: ['main'],
      tags: ['v1.0'],
      currentBranch: 'main',
      remoteUrl: null,
      recentCommits: [],
      hotspots: [{ filePath: 'index.ts', changeCount: 10 }],
      firstCommitDate: '2025-01-01',
      latestCommitDate: '2026-01-01',
    };
    const architecture = createEmptyArchitecture();
    const scores = computeConfidence(evidence, architecture, []);

    expect(scores.evidence).toBeGreaterThan(0);
    expect(scores.evidenceSources).toBe(1);
  });

  it('increases confidence with more evidence sources', () => {
    const evidence = createEmptyEvidence();
    evidence.sourceCode.totalFiles = 10;
    evidence.sourceCode.languages = [
      { name: 'TypeScript', extensions: ['.ts'], fileCount: 10, lineCount: 1000, percentage: 100 },
    ];
    evidence.buildFiles.buildSystems = [
      { name: 'npm', configFile: 'package.json', language: 'JavaScript' },
    ];
    evidence.documentation.hasReadme = true;

    const architecture = createEmptyArchitecture();
    const scores = computeConfidence(evidence, architecture, []);

    expect(scores.evidenceSources).toBe(3); // source, build, docs
    expect(scores.overall).toBeGreaterThan(20);
  });

  it('accounts for decisions in confidence', () => {
    const evidence = createEmptyEvidence();
    const architecture = createEmptyArchitecture();
    const decisions: Decision[] = Array.from({ length: 5 }, (_, i) => ({
      id: `d${i}`,
      title: `Decision ${i}`,
      description: 'test',
      rejected: [],
      reason: 'test',
      timestamp: new Date().toISOString(),
      source: 'manual' as const,
      tags: [],
    }));

    const withDecisions = computeConfidence(evidence, architecture, decisions);
    const withoutDecisions = computeConfidence(evidence, architecture, []);

    expect(withDecisions.decisions).toBeGreaterThan(withoutDecisions.decisions);
  });

  it('caps overall confidence at 100', () => {
    const evidence = createEmptyEvidence();
    evidence.git = {
      isGitRepo: true,
      totalCommits: 1000,
      authors: [
        { name: 'A', email: 'a@test.com', commitCount: 500 },
        { name: 'B', email: 'b@test.com', commitCount: 500 },
      ],
      branches: ['main', 'dev'],
      tags: ['v1.0', 'v2.0'],
      currentBranch: 'main',
      remoteUrl: 'https://github.com/test',
      recentCommits: [],
      hotspots: [{ filePath: 'index.ts', changeCount: 100 }],
      firstCommitDate: '2020-01-01',
      latestCommitDate: '2026-01-01',
    };
    evidence.sourceCode.totalFiles = 100;
    evidence.sourceCode.languages = [
      { name: 'TS', extensions: ['.ts'], fileCount: 100, lineCount: 10000, percentage: 100 },
    ];
    evidence.sourceCode.entryPoints = ['src/index.ts'];
    evidence.sourceCode.directoryStructure = [{ name: 'src', path: 'src', type: 'directory' }];
    evidence.buildFiles.buildSystems = [{ name: 'npm', configFile: 'package.json', language: 'JS' }];
    evidence.buildFiles.dependencies = [{ name: 'express', version: '4.0', type: 'production', source: 'package.json' }];
    evidence.buildFiles.frameworks = [{ name: 'express', version: '4.0', category: 'api', confidence: 95 }];
    evidence.buildFiles.scripts = [{ name: 'build', command: 'tsc', source: 'package.json' }];
    evidence.documentation.hasReadme = true;
    evidence.documentation.readmeSummary = 'A great project';
    evidence.documentation.hasChangelog = true;
    evidence.documentation.hasContributing = true;

    const architecture: ArchitectureModel = {
      pattern: 'layered',
      layers: [
        { name: 'API', type: 'api', directories: ['routes'], fileCount: 10 },
        { name: 'Services', type: 'business-logic', directories: ['services'], fileCount: 10 },
        { name: 'Data', type: 'data-access', directories: ['models'], fileCount: 10 },
      ],
      components: Array.from({ length: 6 }, (_, i) => ({
        name: `comp${i}`,
        type: 'service' as const,
        directory: `dir${i}`,
        files: [],
        confidence: 90,
      })),
      componentDependencies: [],
      confidence: 95,
    };

    const scores = computeConfidence(evidence, architecture, []);
    expect(scores.overall).toBeLessThanOrEqual(100);
    expect(scores.overall).toBeGreaterThan(70);
  });
});
