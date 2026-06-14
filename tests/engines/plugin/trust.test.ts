import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { trustPlugin, isPluginTrusted, untrustPlugin, getTrustedPlugins } from '../../../src/engines/plugin/trust.js';

describe('Plugin Trust Model & Fingerprinting', () => {
  let testDir: string;
  let trustFilePath: string;
  let mockPluginPath: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'project-mind-trust-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    trustFilePath = path.join(testDir, 'trust.json');
    process.env.PROJECT_MIND_TRUST_PATH = trustFilePath;

    mockPluginPath = path.join(testDir, 'mock-plugin.js');
  });

  afterAll(async () => {
    delete process.env.PROJECT_MIND_TRUST_PATH;
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(async () => {
    // Reset the trust registry
    try {
      await fs.rm(trustFilePath, { force: true });
    } catch {}
    
    // Reset the mock plugin
    await fs.writeFile(mockPluginPath, 'export default { name: "mock" };', 'utf-8');
  });

  it('should explicitly trust a plugin and store its fingerprint', async () => {
    // 1. Untrusted initially
    let trusted = await isPluginTrusted(mockPluginPath);
    expect(trusted).toBe(false);

    // 2. Trust it
    await trustPlugin(mockPluginPath);

    // 3. Verify it is now trusted
    trusted = await isPluginTrusted(mockPluginPath);
    expect(trusted).toBe(true);

    // 4. Verify fingerprint is stored
    const registry = await getTrustedPlugins();
    const info = registry[mockPluginPath];
    expect(info).toBeDefined();
    expect(info.trusted).toBe(true);
    expect(info.sha256).toBeDefined();

    // Verify actual hash matches
    const buffer = await fs.readFile(mockPluginPath);
    const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    expect(info.sha256).toBe(expectedHash);
  });

  it('should automatically revoke trust if a plugin is tampered with', async () => {
    // 1. Trust it
    await trustPlugin(mockPluginPath);
    let trusted = await isPluginTrusted(mockPluginPath);
    expect(trusted).toBe(true);

    // 2. Tamper with the file!
    await fs.writeFile(mockPluginPath, 'export default { name: "mock", evil: true };', 'utf-8');

    // 3. Verify trust is immediately revoked due to fingerprint mismatch
    trusted = await isPluginTrusted(mockPluginPath);
    expect(trusted).toBe(false);
  });

  it('should successfully untrust a plugin', async () => {
    await trustPlugin(mockPluginPath);
    expect(await isPluginTrusted(mockPluginPath)).toBe(true);

    await untrustPlugin(mockPluginPath);
    expect(await isPluginTrusted(mockPluginPath)).toBe(false);
  });
});
