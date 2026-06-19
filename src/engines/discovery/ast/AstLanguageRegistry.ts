import path from 'node:path';
import fs from 'node:fs';
import * as ParserModule from 'web-tree-sitter';
const Parser = (ParserModule as any).default || (ParserModule as any).Parser || ParserModule;

import type { Language } from 'web-tree-sitter';

export type SupportedLanguage = 'javascript' | 'typescript' | 'tsx' | 'python' | 'java' | 'php';

export class AstLanguageRegistry {
  private static initialized = false;
  static languages = new Map<SupportedLanguage, Language>();

  /**
   * Initializes the base web-tree-sitter engine.
   */
  static async init(): Promise<void> {
    if (!this.initialized) {
      // @ts-ignore
      await Parser.init();
      this.initialized = true;
    }
  }

  /**
   * Gets the local file path to the WASM grammar file.
   * Assumes tree-sitter-wasms is installed in node_modules.
   */
  private static async getWasmPath(lang: SupportedLanguage): Promise<string> {
    // We use require.resolve to find the exact location of the WASM file within our node_modules
    // regardless of where the user runs the CLI.
    try {
      // In ESM built with tsup, require might need to be created if not present
      const req = typeof require !== 'undefined' ? require : (await import('node:module')).createRequire(import.meta.url);
      return req.resolve(`tree-sitter-wasms/out/tree-sitter-${lang}.wasm`);
    } catch (err) {
      // Fallback in case require.resolve fails (e.g., during some strange bundling setups)
      return path.join(__dirname, '..', 'node_modules', 'tree-sitter-wasms', 'out', `tree-sitter-${lang}.wasm`);
    }
  }

  /**
   * Lazily loads a grammar for a specific language if it hasn't been loaded yet.
   */
  static async loadLanguage(lang: SupportedLanguage): Promise<Language> {
    await this.init();

    if (this.languages.has(lang)) {
      return this.languages.get(lang)!;
    }

    let wasmPath = await this.getWasmPath(lang);
    if (process.platform === 'win32') {
      wasmPath = wasmPath.replace(/\\/g, '/');
    }
    try {
      const language = await (Parser as any).Language.load(wasmPath);
      this.languages.set(lang, language);
      return language;
    } catch (err: any) {
      console.error(err);
      throw new Error(`Failed to load AST grammar for ${lang} at ${wasmPath}: ${err?.message || err}`);
    }
  }

  /**
   * Clears all loaded grammars to free memory.
   */
  static clear(): void {
    this.languages.clear();
  }
}
