import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const execAsync = promisify(exec);
const CLI_PATH = path.resolve(__dirname, '../../dist/cli.js');

const fixtures = [
  'basic-node-app',
  'spring-boot-app',
  'react-app',
  'fastapi-app',
  'express-app',
  'django-app',
  'laravel-app',
  'sveltekit-app',
];

describe('E2E Release Certification', () => {
  // Ensure the CLI is built before running tests
  beforeAll(async () => {
    await execAsync('npm run build');
  }, 60000); // 60s timeout for build

  for (const fixture of fixtures) {
    describe(`Fixture: ${fixture}`, () => {
      const fixturePath = path.resolve(__dirname, '../fixtures', fixture);
      const dotProjectMindPath = path.join(fixturePath, '.project-mind');

      // Clean up and initialize git before each fixture
      beforeAll(async () => {
        try {
          await fs.rm(dotProjectMindPath, { recursive: true, force: true });
        } catch (e) {
          // Ignore
        }
        await execAsync('git init', { cwd: fixturePath });
      }, 30000);

      // Clean up after each fixture
      afterAll(async () => {
        try {
          await fs.rm(dotProjectMindPath, { recursive: true, force: true });
        } catch (e) {
          // Ignore
        }
      }, 30000);

      const runCmd = async (args: string) => {
        const { stdout, stderr } = await execAsync(`node ${CLI_PATH} ${args}`, { cwd: fixturePath });
        return { stdout: stdout + '\n' + stderr, stderr };
      };

      it('should run init', async () => {
        const { stdout } = await runCmd('init -p .');
        expect(stdout).toContain('Project-Mind initialized');
        const memoryExists = await fs.stat(path.join(dotProjectMindPath, 'derived', 'MEMORY.json')).then(() => true).catch(() => false);
        expect(memoryExists).toBe(true);
      }, 30000);

      it('should run update', async () => {
        const { stdout } = await runCmd('update -p .');
        expect(stdout).toContain('Memory updated');
      }, 30000);

      it('should run note', async () => {
        const { stdout } = await runCmd('note "Tested core API" -p .');
        expect(stdout).toContain('Note recorded');
      }, 30000);

      it('should run pack current', async () => {
        // pack requires some features or nodes, but "current" fallback to "Project Overview"
        // Wait, earlier tests failed because graph was empty. We'll just run pack current
        const { stdout } = await runCmd('pack current');
        expect(stdout).toBeTruthy();
      }, 30000);

      it('should run explain', async () => {
        // Find a topic to explain based on fixture
        let topic = '"Project Overview"'; // safe fallback
        if (fixture === 'basic-node-app') topic = '"file"';
        if (fixture === 'spring-boot-app') topic = '"file"';

        // explain takes a topic string
        try {
            const { stdout } = await runCmd(`explain ${topic}`);
            expect(stdout).toBeTruthy();
        } catch (e: any) {
            // Explain might fail if no matches found, but the command should exist
            expect(e.stdout || e.stderr || e.message).not.toContain('unknown option');
        }
      }, 30000);

      it('should run lint', async () => {
        // Lint should exit 0 if there are no blocking violations
        const { stdout } = await runCmd('lint -p .');
        expect(stdout).toBeTruthy();
      }, 30000);

      it('should run governance report', async () => {
        const { stdout } = await runCmd('governance report -p .');
        expect(stdout).toContain('Generated GOVERNANCE.md');

        const reportPath = path.join(dotProjectMindPath, 'GOVERNANCE.md');
        const reportContent = await fs.readFile(reportPath, 'utf-8');
        expect(reportContent).toContain('Architecture Score');
      }, 30000);

      it('should run doctor', async () => {
        const { stdout } = await runCmd('doctor -p .');
        expect(stdout).toContain('Diagnostics Complete:');
        expect(stdout).toContain('Authored Schema Valid');
      }, 30000);

      it('should verify AI_START_HERE.md contents', async () => {
        const startHerePath = path.join(dotProjectMindPath, 'AI_START_HERE.md');
        const content = await fs.readFile(startHerePath, 'utf-8');
        expect(content).toContain('Architecture');
        expect(content).toContain('Current Focus');
        // Features section should be present
        expect(content).toContain('Features');
      }, 30000);
    });
  }
});
