import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installHook } from '../../src/commands/install-hooks.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('Git Hooks Installation', () => {
  let testDir: string;
  let hooksDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-mind-hooks-test-'));
    hooksDir = path.join(testDir, '.git', 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should install a new hook successfully', async () => {
    const hookFile = path.join(hooksDir, 'post-commit');
    await installHook(hooksDir, hookFile, 'post-commit', true);

    const content = await fs.readFile(hookFile, 'utf-8');
    expect(content).toContain('# --- PROJECT-MIND HOOK START ---');
    expect(content).toContain('project-mind update --quiet');
    expect(content).toContain('&'); // Assert background execution
  });

  it('should append to an existing hook without overwriting', async () => {
    const hookFile = path.join(hooksDir, 'post-commit');
    await fs.writeFile(hookFile, '#!/bin/sh\necho "Existing Hook"\n');

    await installHook(hooksDir, hookFile, 'post-commit', true);

    const content = await fs.readFile(hookFile, 'utf-8');
    expect(content).toContain('echo "Existing Hook"');
    expect(content).toContain('# --- PROJECT-MIND HOOK START ---');
    expect(content).toContain('project-mind update --quiet');
  });
});
