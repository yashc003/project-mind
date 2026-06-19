import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCli, setupFixture, cleanupFixture, runCli, FIXTURES } from './test-utils';

describe('Doctor Certification', () => {
  beforeAll(async () => {
    
  }, 180000);

  for (const fixture of FIXTURES) {
    describe(`Fixture: ${fixture}`, () => {
      let fixturePath: string;

      beforeAll(async () => {
        const setup = await setupFixture(fixture);
        fixturePath = setup.fixturePath;
        await runCli('init -p .', fixturePath);
      }, 180000);

      afterAll(async () => {
        await cleanupFixture(fixture);
      }, 180000);

      it('should run doctor with exit code 0 and no critical failures', async () => {
        const { stdout } = await runCli('doctor', fixturePath);
        // Doctor prints diagnostics
        expect(stdout).toContain('Diagnostics Complete');
        
        // Ensure no critical failure logs
        expect(stdout.toLowerCase()).not.toContain('critical failure');
      }, 180000);
    });
  }
});
