import { describe, it, expect } from 'vitest';
import { migrateMemory } from '../../src/engines/memory/migration.js';
import { SCHEMA_VERSION } from '../../src/engines/memory/schema.js';

describe('Migration Engine', () => {
  it('migrates an empty memory object to the current schema', () => {
    const rawMemory: any = {
      version: '0.1.0',
      projectName: 'Legacy Project',
    };

    const memory = migrateMemory(rawMemory);

    expect(memory.version).toBe(SCHEMA_VERSION);
    expect(memory.workflows).toEqual([]);
    expect(memory.timeline).toEqual([]);
    expect(memory.features).toEqual([]);
    expect(memory.focusHistory).toBeDefined();
    expect(memory.focusHistory.active).toBeNull();
    expect(memory.focusHistory.history).toEqual([]);
  });

  it('migrates v0.2 currentTask to focusHistory active', () => {
    const rawMemory: any = {
      version: '0.2.0',
      currentTask: {
        module: 'Auth',
        description: 'Implement login',
        status: 'in-progress',
        blockers: ['API down'],
        expectedModules: ['src/auth'],
      },
    };

    const memory = migrateMemory(rawMemory);

    expect(memory.currentTask).toBeUndefined();
    expect(memory.focusHistory.active).not.toBeNull();
    expect(memory.focusHistory.active?.feature).toBe('Auth');
    expect(memory.focusHistory.active?.task).toBe('Implement login');
    expect(memory.focusHistory.active?.status).toBe('in-progress');
    expect(memory.focusHistory.active?.blockers).toEqual(['API down']);
    expect(memory.focusHistory.active?.expectedModules).toEqual(['src/auth']);
    expect(memory.focusHistory.history).toEqual([]);
  });

  it('migrates completed currentTask to focusHistory history', () => {
    const rawMemory: any = {
      version: '0.2.0',
      currentTask: {
        module: 'Auth',
        description: 'Implement login',
        status: 'completed',
        blockers: [],
        expectedModules: [],
      },
    };

    const memory = migrateMemory(rawMemory);

    expect(memory.currentTask).toBeUndefined();
    expect(memory.focusHistory.active).toBeNull();
    expect(memory.focusHistory.history).toHaveLength(1);
    expect(memory.focusHistory.history[0].status).toBe('completed');
  });

  it('leaves already migrated memory intact', () => {
    const rawMemory: any = {
      version: SCHEMA_VERSION,
      workflows: [{ id: '1' }],
      timeline: [{ date: '2026' }],
      features: [{ id: '1' }],
      focusHistory: {
        active: null,
        history: [],
      },
    };

    const memory = migrateMemory(rawMemory);

    expect(memory.version).toBe(SCHEMA_VERSION);
    expect(memory.workflows).toHaveLength(1);
    expect(memory.timeline).toHaveLength(1);
    expect(memory.features).toHaveLength(1);
  });
});
