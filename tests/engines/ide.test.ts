import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkIDEIntegrations, installIDEIntegration, IDE_PROVIDERS } from '../../src/engines/ide/index.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('IDE Integration Engine', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-mind-ide-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should detect when an IDE rule file exists but is not integrated', async () => {
    // Mock Cursor existence
    await fs.writeFile(path.join(testDir, '.cursorrules'), 'Some existing rules\n');
    
    const statuses = await checkIDEIntegrations(testDir);
    const cursor = statuses.find(s => s.provider.id === 'cursor');
    
    expect(cursor).toBeDefined();
    expect(cursor?.isInstalled).toBe(true);
    expect(cursor?.isIntegrated).toBe(false);
  });

  it('should detect when an IDE config dir exists without rule file', async () => {
    await fs.mkdir(path.join(testDir, '.windsurf'));
    
    const statuses = await checkIDEIntegrations(testDir);
    const windsurf = statuses.find(s => s.provider.id === 'windsurf');
    
    expect(windsurf).toBeDefined();
    expect(windsurf?.isInstalled).toBe(true);
    expect(windsurf?.isIntegrated).toBe(false);
  });

  it('should correctly install integration into a new file', async () => {
    const provider = IDE_PROVIDERS.find(p => p.id === 'cursor')!;
    const success = await installIDEIntegration(testDir, provider);
    
    expect(success).toBe(true);
    
    const content = await fs.readFile(path.join(testDir, '.cursorrules'), 'utf-8');
    expect(content).toContain('# Project-Mind Integration');
    expect(content).toContain('project-mind update');
    
    // Check status again
    const statuses = await checkIDEIntegrations(testDir);
    const cursor = statuses.find(s => s.provider.id === 'cursor');
    expect(cursor?.isIntegrated).toBe(true);
  });

  it('should correctly append integration to an existing file without duplication', async () => {
    const rulePath = path.join(testDir, '.cursorrules');
    await fs.writeFile(rulePath, 'My custom rule\n');
    
    const provider = IDE_PROVIDERS.find(p => p.id === 'cursor')!;
    await installIDEIntegration(testDir, provider);
    
    let content = await fs.readFile(rulePath, 'utf-8');
    expect(content).toContain('My custom rule\n\n# Project-Mind Integration');
    
    // Try installing again
    await installIDEIntegration(testDir, provider);
    content = await fs.readFile(rulePath, 'utf-8');
    
    // Should only have one instance of the header
    const occurrences = content.split('# Project-Mind Integration').length - 1;
    expect(occurrences).toBe(1);
  });
});
