import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AstService } from '../../src/engines/discovery/ast/AstService.js';
import { AstLanguageRegistry } from '../../src/engines/discovery/ast/AstLanguageRegistry.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';

describe('AST Service & Language Registry', () => {
  let tempFile: string;

  beforeAll(async () => {
    // Create a temporary JS file
    tempFile = path.join(os.tmpdir(), 'test_ast_file.js');
    await fs.writeFile(tempFile, `
      const express = require('express');
      const app = express();
      
      app.get('/api/users', (req, res) => {
        res.send('users');
      });
    `);
  });

  afterAll(async () => {
    await fs.unlink(tempFile);
    AstLanguageRegistry.clear();
  });

  it('should lazily load the grammar and parse the file', async () => {
    const result = await AstService.parseFile(tempFile);
    expect(result).not.toBeNull();
    expect(result?.language).toBe('javascript');
    expect(result?.tree).toBeDefined();
  });

  it('should execute a tree-sitter query and find matches', async () => {
    const result = await AstService.parseFile(tempFile);
    expect(result).not.toBeNull();

    // Query to find app.get calls
    const queryStr = `
      (call_expression
        function: (member_expression
          object: (identifier) @obj (#eq? @obj "app")
          property: (property_identifier) @method (#eq? @method "get")
        )
      ) @call
    `;

    const matches = AstService.executeQuery(result!.tree, 'javascript', queryStr);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].captures.some(c => c.name === 'method' && c.node.text === 'get')).toBe(true);
  });

  it('should safely return null for unsupported files (Regex fallback trigger)', async () => {
    const tempTxt = path.join(os.tmpdir(), 'unsupported.txt');
    await fs.writeFile(tempTxt, 'hello world');
    const result = await AstService.parseFile(tempTxt);
    expect(result).toBeNull();
    await fs.unlink(tempTxt);
  });
});
