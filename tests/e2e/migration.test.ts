import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCli, setupFixture, cleanupFixture, runCli } from './test-utils';
import { promises as fs } from 'node:fs';
import path from 'node:path';

describe('Migration Engine', () => {
  let fixturePath: string;
  let dotProjectMindPath: string;

  beforeAll(async () => {
    
    fixturePath = path.resolve(__dirname, '../fixtures/.tmp/legacy-v1-memory');
    await fs.rm(fixturePath, { recursive: true, force: true }).catch(() => {});
    dotProjectMindPath = path.join(fixturePath, '.project-mind');
    
    await fs.mkdir(dotProjectMindPath, { recursive: true });
    await fs.writeFile(path.join(dotProjectMindPath, 'MEMORY.json'), JSON.stringify({
      version: '1.0.0',
      features: [ { id: 'feat_OldFeature', title: 'Old Feature' } ]
    }));
    await fs.writeFile(path.join(fixturePath, 'index.js'), '// mock file\n');
  }, 180000);

  afterAll(async () => {
    await cleanupFixture('legacy-v1-memory');
  }, 180000);

  it('should migrate v1 MEMORY.json to GRAPH_VERSION=2.0', async () => {
    // Touch a file to bypass "no changes detected" cache
    await fs.writeFile(path.join(fixturePath, 'index.js'), '// modified\n', { flag: 'a' });

    // Run update, which triggers migration
    let stdout = '';
    try {
      const res = await runCli('update', fixturePath);
      stdout = res.stdout;
    } catch (e: any) {
      console.error('CLI STDOUT:', e.stdout);
      console.error('CLI STDERR:', e.stderr);
      throw e;
    }
    
    // The graph engine or migration should have migrated it
    const graphContent = await fs.readFile(path.join(dotProjectMindPath, 'derived', 'KNOWLEDGE_GRAPH.json'), 'utf-8');
    const graph = JSON.parse(graphContent);
    
    expect(graph.version).toBe('2.0');
    expect(graph.nodes.some((n: any) => n.label === 'Old Feature' || n.label === 'feat_OldFeature')).toBe(true);
  }, 180000);
});
