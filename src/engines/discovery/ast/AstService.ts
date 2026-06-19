import { promises as fs } from 'node:fs';
import * as ParserModule from 'web-tree-sitter';
const Parser = (ParserModule as any).default || (ParserModule as any).Parser || ParserModule;
import { AstLanguageRegistry, SupportedLanguage } from './AstLanguageRegistry.js';

import type { Tree, QueryMatch } from 'web-tree-sitter';

export interface ParseResult {
  tree: Tree;
  language: SupportedLanguage;
  content: string;
}

export class AstService {
  /**
   * Determines the tree-sitter language identifier based on the file extension.
   */
  static getLanguageForFile(filePath: string): SupportedLanguage | null {
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 'javascript';
    if (filePath.endsWith('.ts')) return 'typescript';
    if (filePath.endsWith('.tsx')) return 'tsx';
    if (filePath.endsWith('.py')) return 'python';
    if (filePath.endsWith('.java')) return 'java';
    if (filePath.endsWith('.php')) return 'php';
    return null;
  }

  /**
   * Reads a file, lazily loads its grammar, and returns the parsed AST tree.
   * If the language is unsupported or loading fails, returns null (allowing regex fallback).
   */
  static async parseFile(filePath: string): Promise<ParseResult | null> {
    const lang = this.getLanguageForFile(filePath);
    if (!lang) return null;

    try {
      const language = await AstLanguageRegistry.loadLanguage(lang);
      const content = await fs.readFile(filePath, 'utf-8');
      
      const parser = new Parser();
      parser.setLanguage(language);
      
      const tree = parser.parse(content);
      return { tree, language: lang, content };
    } catch (err) {
      console.error('AST parsing failed:', err);
      // Silently fail AST parsing to trigger Regex fallback in plugins
      return null;
    }
  }

  /**
   * Executes a Tree-sitter query against a specific tree and returns matched captures.
   */
  static executeQuery(tree: any, lang: SupportedLanguage, queryStr: string) {
    try {
      // In web-tree-sitter 0.20.8, tree does not expose tree.language directly
      // we must get the language object from the parser or registry
      const languageObj = AstLanguageRegistry.languages.get(lang);
      if (!languageObj) {
        throw new Error(`Language ${lang} not loaded.`);
      }
      const query = languageObj.query(queryStr);
      return query.matches(tree.rootNode);
    } catch (err) {
      return [];
    }
  }
}
