import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCli, setupFixture, cleanupFixture, runCli } from './test-utils';
import { promises as fs } from 'node:fs';
import path from 'node:path';

describe('Feature Focus Tracking', () => {
  let fixturePath: string;
  let dotProjectMindPath: string;

  beforeAll(async () => {
    
    const setup = await setupFixture('express-app');
    fixturePath = setup.fixturePath;
    dotProjectMindPath = setup.dotProjectMindPath;
    await runCli('init -p .', fixturePath);
  }, 180000);

  afterAll(async () => {
    await cleanupFixture('express-app');
  }, 180000);

  it('should track intent and modules in focus', async () => {
    // 1. Start Feature
    await runCli('start-feature -f "Add Authentication" -p "Security"', fixturePath);
    
    // 2. Focus Status
    const focusContent = await fs.readFile(path.join(dotProjectMindPath, 'CURRENT_FOCUS.json'), 'utf-8');
    const focus = JSON.parse(focusContent);
    expect(focus.feature).toBe('Add Authentication');

    // 3. Create File
    await fs.writeFile(path.join(fixturePath, 'src', 'auth.js'), 'function login() {}');

    // 4. Update
    await runCli('update', fixturePath);

    // 5. Verify Graph has Focus and Feature Node, and actual modules
    const updatedFocusContent = await fs.readFile(path.join(dotProjectMindPath, 'CURRENT_FOCUS.json'), 'utf-8');
    const updatedFocus = JSON.parse(updatedFocusContent);
    // Ideally the AST or update mechanism detects auth.js as an actual module if it's tied.
    // If not, at minimum we verify the feature node exists in KNOWLEDGE_GRAPH
    const graphContent = await fs.readFile(path.join(dotProjectMindPath, 'derived', 'KNOWLEDGE_GRAPH.json'), 'utf-8');
    const graph = JSON.parse(graphContent);
    
    expect(graph.nodes.some((n: any) => n.label.includes('Add Authentication'))).toBe(true);
    // Also the file auth.js should be detected via semantics or focus
    expect(graph.nodes.some((n: any) => n.label.includes('auth.js'))).toBe(true);
  });
});
