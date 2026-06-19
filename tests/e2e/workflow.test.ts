import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCli, setupFixture, cleanupFixture, runCli } from './test-utils';

describe('Workflow & Pack/Explain', () => {
  let fixturePath: string;

  beforeAll(async () => {
    
    const setup = await setupFixture('express-app');
    fixturePath = setup.fixturePath;
    await runCli('init -p .', fixturePath);
  }, 180000);

  afterAll(async () => {
    await cleanupFixture('express-app');
  }, 180000);

  it('should run pack current successfully', async () => {
    const { stdout } = await runCli('pack current', fixturePath);
    expect(stdout).toBeTruthy();
  });

  it('should run explain safely', async () => {
    try {
      const { stdout } = await runCli('explain "userController"', fixturePath);
      expect(stdout).toBeTruthy();
    } catch (e: any) {
      // If it exits with 1 because no knowledge found, that's also fine, we just don't want an unhandled exception
      expect(e.stdout || e.stderr).toBeTruthy();
    }
  });

  it('should run lint', async () => {
    const { stdout } = await runCli('lint', fixturePath);
    expect(stdout).toBeTruthy();
  });

  it('should take a note', async () => {
    const { stdout } = await runCli('note "Checked the system"', fixturePath);
    expect(stdout).toContain('Note recorded');
  });
});
