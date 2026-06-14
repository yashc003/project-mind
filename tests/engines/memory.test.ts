// ============================================================================
// Tests — Memory Engine
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  initMemory,
  loadMemory,
  saveMemory,
  isInitialized,
  addDecision,
  addNote,
  addSessionRef,
  getNextSessionId,
  updateEvidence,
} from '../../src/engines/memory/index.js';
import { createEmptyEvidence, createEmptyArchitecture, createEmptyConfidence } from '../../src/engines/memory/schema.js';
import type { Decision, DeveloperNote, SessionReference } from '../../src/types/index.js';

const TEST_DIR = path.join(process.cwd(), 'tests', '.test-project-memory');

describe('Memory Engine', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('initMemory', () => {
    it('creates .project-mind directory structure', async () => {
      await initMemory(TEST_DIR, 'test-project');

      const pmDir = path.join(TEST_DIR, '.project-mind');
      const stat = await fs.stat(pmDir);
      expect(stat.isDirectory()).toBe(true);

      // Check files exist
      const memoryFile = path.join(pmDir, 'derived', 'MEMORY.json');
      const configFile = path.join(pmDir, 'authored', 'config.json');
      const sessionsDir = path.join(pmDir, 'derived', 'sessions');

      await expect(fs.access(memoryFile)).resolves.toBeUndefined();
      await expect(fs.access(configFile)).resolves.toBeUndefined();

      const sessionsStat = await fs.stat(sessionsDir);
      expect(sessionsStat.isDirectory()).toBe(true);
    });

    it('sets the project name', async () => {
      const memory = await initMemory(TEST_DIR, 'my-awesome-project');
      expect(memory.projectName).toBe('my-awesome-project');
    });

    it('defaults project name to directory name', async () => {
      const memory = await initMemory(TEST_DIR);
      expect(memory.projectName).toBe(path.basename(TEST_DIR));
    });
  });

  describe('loadMemory', () => {
    it('returns null when not initialized', async () => {
      const memory = await loadMemory(TEST_DIR);
      expect(memory).toBeNull();
    });

    it('loads previously saved memory', async () => {
      await initMemory(TEST_DIR, 'test-project');
      const memory = await loadMemory(TEST_DIR);
      expect(memory).not.toBeNull();
      expect(memory!.projectName).toBe('test-project');
    });
  });

  describe('saveMemory', () => {
    it('persists memory changes', async () => {
      const memory = await initMemory(TEST_DIR, 'test');
      memory.description = 'Updated description';
      await saveMemory(TEST_DIR, memory);

      const reloaded = await loadMemory(TEST_DIR);
      expect(reloaded!.description).toBe('Updated description');
    });
  });

  describe('isInitialized', () => {
    it('returns false for non-initialized directory', async () => {
      expect(await isInitialized(TEST_DIR)).toBe(false);
    });

    it('returns true after initialization', async () => {
      await initMemory(TEST_DIR);
      expect(await isInitialized(TEST_DIR)).toBe(true);
    });
  });

  describe('mutation helpers', () => {
    it('addDecision appends to decisions array', async () => {
      const memory = await initMemory(TEST_DIR);
      const decision: Decision = {
        id: 'test-1',
        title: 'Use TypeScript',
        description: 'Use TypeScript for type safety',
        rejected: ['JavaScript'],
        reason: 'Better DX',
        timestamp: new Date().toISOString(),
        source: 'manual',
        tags: ['language'],
      };
      addDecision(memory, decision);
      expect(memory.decisions).toHaveLength(1);
      expect(memory.decisions[0].title).toBe('Use TypeScript');
    });

    it('addNote appends to notes array', async () => {
      const memory = await initMemory(TEST_DIR);
      const note: DeveloperNote = {
        id: 'note-1',
        content: 'Remember to add logging',
        timestamp: new Date().toISOString(),
        tags: [],
      };
      addNote(memory, note);
      expect(memory.notes).toHaveLength(1);
    });

    it('addSessionRef tracks sessions', async () => {
      const memory = await initMemory(TEST_DIR);
      const ref: SessionReference = {
        id: 0,
        timestamp: new Date().toISOString(),
        type: 'init',
        summary: 'Initial setup',
      };
      addSessionRef(memory, ref);
      expect(memory.sessions).toHaveLength(1);
    });

    it('getNextSessionId returns correct next ID', async () => {
      const memory = await initMemory(TEST_DIR);
      expect(getNextSessionId(memory)).toBe(0);

      addSessionRef(memory, {
        id: 0,
        timestamp: new Date().toISOString(),
        type: 'init',
        summary: 'Init',
      });
      expect(getNextSessionId(memory)).toBe(1);
    });
  });

  describe('updateEvidence', () => {
    it('replaces evidence and updates scenario', async () => {
      const memory = await initMemory(TEST_DIR);
      const evidence = createEmptyEvidence();
      evidence.sourceCode.totalFiles = 42;
      const architecture = createEmptyArchitecture();
      const confidence = createEmptyConfidence();

      updateEvidence(memory, {
        scenario: 'existing',
        evidence,
        architecture,
        confidence,
        workflows: [],
        timeline: [],
        features: [],
        duration: 100,
      });

      expect(memory.evidence.sourceCode.totalFiles).toBe(42);
      expect(memory.scenario).toBe('existing');
    });
  });
});
