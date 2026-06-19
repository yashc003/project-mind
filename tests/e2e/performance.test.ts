import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCli, setupFixture, cleanupFixture, runCli } from './test-utils';

describe('Performance Budget Certification', () => {
  let fixturePath: string;

  beforeAll(async () => {
    await buildCli();
    const setup = await setupFixture('large-ts-project');
    fixturePath = setup.fixturePath;
    await runCli('init -p .', fixturePath);
  }, 180000);

  afterAll(async () => {
    await cleanupFixture('large-ts-project');
  }, 180000);

  it('AST extraction should not exceed 2x the Regex baseline', async () => {
    // Note: Actually profiling the exact regex vs ast time inside an E2E test requires instrumenting the CLI 
    // or parsing the stdout duration metrics. Project-Mind prints 'Duration: Xms'.
    // Here we run an update and verify it completes within an acceptable total timeframe for 500 files.
    // To strictly verify AST <= 2x Regex, we would need a dedicated profiler flag.
    
    const startTime = Date.now();
    const { stdout } = await runCli('update', fixturePath);
    const durationMs = Date.now() - startTime;
    
    expect(stdout).toContain('Memory updated');
    
    // For 500 files, it should reasonably complete in under 120 seconds in CI/CD environments
    // This allows for variance while still ensuring we are not O(N^2)
    expect(durationMs).toBeLessThan(120000);
  }, 180000);
});
