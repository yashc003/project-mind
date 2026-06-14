import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PluginRegistry } from '../../../src/engines/plugin/registry.js';
import { trustPlugin } from '../../../src/engines/plugin/trust.js';

describe('Plugin Registry Security', () => {
  let testDir: string;
  let pmDir: string;
  let pluginsJsonPath: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'project-mind-registry-test-' + Date.now());
    pmDir = path.join(testDir, '.project-mind');
    await fs.mkdir(pmDir, { recursive: true });
    pluginsJsonPath = path.join(pmDir, 'authored', 'plugins.json');
    await fs.mkdir(path.dirname(pluginsJsonPath), { recursive: true });
    
    // Isolate trust registry for this test
    process.env.PROJECT_MIND_TRUST_PATH = path.join(testDir, 'trust.json');
  });

  afterAll(async () => {
    delete process.env.PROJECT_MIND_TRUST_PATH;
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(async () => {
    try {
      await fs.rm(pluginsJsonPath, { force: true });
    } catch {}
  });

  it('should block local plugins that attempt path escaping (../)', async () => {
    // 1. Create a malicious plugins.json
    const maliciousConfig = {
      installed: [
        {
          name: "evil-plugin",
          version: "1.0.0",
          enabled: true,
          path: "../../../../../../etc/passwd"
        }
      ]
    };
    await fs.writeFile(pluginsJsonPath, JSON.stringify(maliciousConfig), 'utf-8');

    // 2. Exploit scenario: somehow the user trusted this path
    await trustPlugin("../../../../../../etc/passwd");

    const registry = new PluginRegistry();
    
    // Attempt to load
    await registry.loadPlugins(testDir);

    // Verify it failed to load
    expect(registry.getPlugins().length).toBe(0);
    
    // Verify the specific security violation error was caught
    const failed = registry.getFailedPlugins();
    expect(failed.length).toBe(1);
    expect(failed[0].name).toBe('evil-plugin');
    
    // Wait, the error is: Security Violation: Local plugin path escapes...
    // Let's verify the message contains "Security Violation"
    expect(failed[0].error).toContain('Security Violation');
  });

  it('should block local plugins that use absolute paths outside the project root', async () => {
    // 1. Create a malicious plugins.json
    const maliciousConfig = {
      installed: [
        {
          name: "evil-plugin-2",
          version: "1.0.0",
          enabled: true,
          path: "/tmp/evil.js"
        }
      ]
    };
    await fs.writeFile(pluginsJsonPath, JSON.stringify(maliciousConfig), 'utf-8');

    // Trust it first
    await trustPlugin("/tmp/evil.js");

    const registry = new PluginRegistry();
    await registry.loadPlugins(testDir);

    expect(registry.getPlugins().length).toBe(0);
    
    const failed = registry.getFailedPlugins();
    expect(failed.length).toBe(1);
    expect(failed[0].error).toContain('Security Violation');
  });
});
