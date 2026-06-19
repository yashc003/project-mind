import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { generateGraphViewer } from '../../../src/engines/graph/visualizer.js';
import type { KnowledgeGraph } from '../../../src/types/index.js';

vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: vi.fn(),
  writeText: vi.fn()
}));

import { ensureDir, writeText } from '../../../src/utils/fs.js';

describe('Visualizer Engine', () => {
  const projectPath = '/mock/project/path';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates HTML and embeds stringified graph data safely', async () => {
    const graph: KnowledgeGraph = {
      nodes: [{ id: '1', label: 'Node 1', type: 'file', properties: { test: '123' } }],
      edges: [{ source: '1', target: '2', relation: 'DEP', provenance: 'TEST', confidence: 1 }]
    };

    vi.spyOn(fs.promises, 'readdir').mockResolvedValueOnce([] as any);

    const htmlPath = await generateGraphViewer(graph, projectPath);

    expect(htmlPath).toContain('GRAPH_VIEWER_');
    expect(htmlPath).toContain('.html');
    
    expect(ensureDir).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalled();
    
    const htmlContent = vi.mocked(writeText).mock.calls[0][1] as string;
    
    // Check if the graph data is injected
    expect(htmlContent).toContain('id":"1"');
    expect(htmlContent).toContain('label":"Node 1"');
    
    // Check that standard d3 libraries and the Ego Graph logic are present
    expect(htmlContent).toContain('d3.forceSimulation');
    expect(htmlContent).toContain('renderEgoGraph');
  });

  it('cleans up older viewer html files to prevent clutter', async () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [] };
    
    // Mock readdir to return some old visualizer files
    vi.spyOn(fs.promises, 'readdir').mockResolvedValueOnce([
      'GRAPH_VIEWER_12345.html',
      'GRAPH_VIEWER_67890.html',
      'other_file.txt'
    ] as any);
    const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

    await generateGraphViewer(graph, projectPath);
    
    // Unlink should be called twice, once for each old GRAPH_VIEWER file
    expect(unlinkSpy).toHaveBeenCalledTimes(2);
    expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('GRAPH_VIEWER_12345.html'));
    expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('GRAPH_VIEWER_67890.html'));
    
    // Should NOT delete other files
    expect(unlinkSpy).not.toHaveBeenCalledWith(expect.stringContaining('other_file.txt'));
  });

  it('gracefully handles cleanup errors (e.g., file locked or missing)', async () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [] };
    
    vi.spyOn(fs.promises, 'readdir').mockResolvedValueOnce([
      'GRAPH_VIEWER_12345.html'
    ] as any);
    
    vi.spyOn(fs.promises, 'unlink').mockRejectedValueOnce(new Error('File is locked'));

    // Should not throw an error, it should catch and ignore cleanup failure
    await expect(generateGraphViewer(graph, projectPath)).resolves.toBeDefined();
  });

  it('handles empty graphs without failing', async () => {
    const graph: KnowledgeGraph = { nodes: [], edges: [] };
    vi.spyOn(fs.promises, 'readdir').mockResolvedValueOnce([] as any);

    const htmlPath = await generateGraphViewer(graph, projectPath);
    expect(htmlPath).toBeDefined();

    const htmlContent = vi.mocked(writeText).mock.calls[0][1] as string;
    expect(htmlContent).toContain('"nodes":[]');
    expect(htmlContent).toContain('"edges":[]');
  });
});
