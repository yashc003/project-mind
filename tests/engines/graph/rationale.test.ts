import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { extractRationale } from '../../../src/engines/graph/rationale.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}));

describe('Rationale Engine', () => {
  const projectPath = '/mock/project/path';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores files with unsupported extensions', async () => {
    const files = ['data.json', 'image.png', 'readme.md', 'binary.exe'];
    const result = await extractRationale(projectPath, files);
    
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('extracts NOTE and WHY tags from supported files', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(`
      function test() {
        // NOTE: This is a test note
        console.log('hi');
        /* WHY: Because we need to test block comments */
      }
    `);

    const result = await extractRationale(projectPath, ['test.ts']);
    
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(2);
    
    expect(result.nodes[0].properties?.rationaleType).toBe('NOTE');
    expect(result.nodes[0].properties?.fullText).toBe('This is a test note');
    
    expect(result.nodes[1].properties?.rationaleType).toBe('WHY');
    expect(result.nodes[1].properties?.fullText).toBe('Because we need to test block comments');
    
    expect(result.edges[0].source).toBe(result.nodes[0].id);
    expect(result.edges[0].target).toBe('file_test.ts');
  });

  it('truncates rationale strings exceeding the max length limit', async () => {
    const longString = 'a'.repeat(600);
    vi.mocked(fs.readFile).mockResolvedValueOnce(`
      // NOTE: ${longString}
    `);

    const result = await extractRationale(projectPath, ['long.js']);
    
    expect(result.nodes).toHaveLength(1);
    const fullText = result.nodes[0].properties?.fullText as string;
    
    // Default limit in rationale.ts is 500
    expect(fullText.length).toBe(503); // 500 + '...'
    expect(fullText.endsWith('...')).toBe(true);
  });

  it('handles unreadable files gracefully (fallback catch)', async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found or no permissions'));
    
    // Should not throw, but should return empty graph
    const result = await extractRationale(projectPath, ['missing.ts']);
    
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('handles files with no matching comments', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(`
      function test() {
        // Just a normal comment
        // TODO: Do something
        // FIXME: Fix this
      }
    `);

    const result = await extractRationale(projectPath, ['normal.ts']);
    
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});
