// ============================================================================
// Tests — Schema Factories
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  createEmptyMemory,
  createEmptyEvidence,
  createEmptyArchitecture,
  createEmptyConfidence,
  createSession,
  validateMemoryVersion,
  getMemoryFilePaths,
  SCHEMA_VERSION,
  DEFAULT_CONFIG,
} from '../../src/engines/memory/schema.js';

describe('Schema Factories', () => {
  describe('createEmptyMemory', () => {
    it('creates a valid memory object with the given project name', () => {
      const memory = createEmptyMemory('test-project');
      expect(memory.projectName).toBe('test-project');
      expect(memory.version).toBe(SCHEMA_VERSION);
      expect(memory.scenario).toBe('brand-new');
      expect(memory.decisions).toEqual([]);
      expect(memory.notes).toEqual([]);
      expect(memory.sessions).toEqual([]);
      expect(memory.focusHistory).toEqual({ active: null, history: [] });
    });

    it('sets timestamps', () => {
      const before = new Date().toISOString();
      const memory = createEmptyMemory('test');
      const after = new Date().toISOString();
      expect(memory.createdAt >= before).toBe(true);
      expect(memory.createdAt <= after).toBe(true);
      expect(memory.updatedAt).toBe(memory.createdAt);
    });
  });

  describe('createEmptyEvidence', () => {
    it('creates evidence with null git and empty collections', () => {
      const evidence = createEmptyEvidence();
      expect(evidence.git).toBeNull();
      expect(evidence.sourceCode.totalFiles).toBe(0);
      expect(evidence.buildFiles.buildSystems).toEqual([]);
      expect(evidence.documentation.hasReadme).toBe(false);
    });
  });

  describe('createEmptyArchitecture', () => {
    it('creates architecture with null pattern and zero confidence', () => {
      const arch = createEmptyArchitecture();
      expect(arch.pattern).toBeNull();
      expect(arch.layers).toEqual([]);
      expect(arch.components).toEqual([]);
      expect(arch.confidence).toBe(0);
    });
  });

  describe('createEmptyConfidence', () => {
    it('creates all-zero confidence scores', () => {
      const conf = createEmptyConfidence();
      expect(conf.overall).toBe(0);
      expect(conf.architecture).toBe(0);
      expect(conf.evidence).toBe(0);
      expect(conf.maxEvidenceSources).toBe(4);
    });
  });

  describe('createSession', () => {
    it('creates a session with the given parameters', () => {
      const session = createSession(1, 'init', 'Test session');
      expect(session.id).toBe(1);
      expect(session.type).toBe('init');
      expect(session.summary).toBe('Test session');
      expect(session.changes).toEqual([]);
      expect(session.notes).toBeNull();
    });

    it('includes changes and notes when provided', () => {
      const changes = [{ file: 'test.ts', action: 'created' as const }];
      const session = createSession(2, 'update', 'Update', changes, 'Some notes', 500);
      expect(session.changes).toEqual(changes);
      expect(session.notes).toBe('Some notes');
      expect(session.duration).toBe(500);
    });
  });

  describe('validateMemoryVersion', () => {
    it('returns true for matching version', () => {
      const memory = createEmptyMemory('test');
      expect(validateMemoryVersion(memory)).toBe(true);
    });

    it('returns false for mismatched version', () => {
      const memory = createEmptyMemory('test');
      memory.version = '99.99.99';
      expect(validateMemoryVersion(memory)).toBe(false);
    });
  });

  describe('getMemoryFilePaths', () => {
    it('returns all expected file paths', () => {
      const paths = getMemoryFilePaths('/project');
      expect(paths.root).toBe('/project/.project-mind');
      expect(paths.memory).toBe('/project/.project-mind/derived/MEMORY.json');
      expect(paths.architecture).toBe('/project/.project-mind/derived/ARCHITECTURE.json');
      expect(paths.aiStartHere).toBe('/project/.project-mind/AI_START_HERE.md');
      expect(paths.sessions).toBe('/project/.project-mind/derived/sessions');
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('has reasonable defaults', () => {
      expect(DEFAULT_CONFIG.ignoreDirs).toContain('node_modules');
      expect(DEFAULT_CONFIG.ignoreDirs).toContain('.git');
      expect(DEFAULT_CONFIG.maxDepth).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.maxFileSizeBytes).toBeGreaterThan(0);
    });
  });
});
