import { AstService } from './ast/AstService.js';
import type { SemanticEntity, FileCategories, SemanticSignature } from '../../types/index.js';
import path from 'node:path';

function isExported(node: any) {
  return node.parent?.type === 'export_statement';
}

function extractClassSignatures(classNode: any): SemanticSignature[] {
  const signatures: SemanticSignature[] = [];
  const body = classNode.childForFieldName('body');
  if (!body) return signatures;

  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (child.type === 'method_definition' || child.type === 'public_field_definition') {
      const nameNode = child.childForFieldName('name');
      const paramsNode = child.childForFieldName('parameters');
      const returnTypeNode = child.childForFieldName('return_type') || child.childForFieldName('type');
      
      const isPrivate = child.text.includes('private ') || (nameNode?.text || '').startsWith('#');
      if (isPrivate) continue;

      const block = child.children.find((c: any) => c.type === 'statement_block');
      const raw = block ? child.text.replace(block.text, '').trim() : child.text;

      const modifiers = child.children
        .filter((c: any) => c.type === 'accessibility_modifier' || c.type === 'static' || c.type === 'async')
        .map((c: any) => c.text);

        let returnType = returnTypeNode?.text || undefined;
        if (returnType && returnType.startsWith(':')) {
          returnType = returnType.substring(1).trim();
        }

        signatures.push({
          name: nameNode?.text || 'unknown',
          kind: child.type === 'method_definition' ? 'method' : 'property',
          parameters: paramsNode ? [paramsNode.text] : undefined,
          returnType,
          modifiers: modifiers.length > 0 ? modifiers : undefined,
          raw
        });
    }
  }
  return signatures;
}

function extractInterfaceSignatures(bodyNode: any): SemanticSignature[] {
  const signatures: SemanticSignature[] = [];
  if (!bodyNode) return signatures;
  for (let i = 0; i < bodyNode.childCount; i++) {
    const child = bodyNode.child(i);
    if (child.type === 'method_signature' || child.type === 'property_signature') {
      const nameNode = child.childForFieldName('name');
      const paramsNode = child.childForFieldName('parameters');
      const returnTypeNode = child.childForFieldName('type') || child.childForFieldName('return_type');

        let returnType = returnTypeNode?.text || undefined;
        if (returnType && returnType.startsWith(':')) {
          returnType = returnType.substring(1).trim();
        }

        signatures.push({
          name: nameNode?.text || 'unknown',
          kind: child.type === 'method_signature' ? 'method' : 'property',
          parameters: paramsNode ? [paramsNode.text] : undefined,
          returnType,
          raw: child.text.trim()
        });
    }
  }
  return signatures;
}

export async function extractSemantics(
  projectPath: string,
  fileCategories: FileCategories,
  cachedSemantics?: SemanticEntity[] | null,
  changedFiles?: string[] | null,
  deletedFiles?: string[] | null
): Promise<SemanticEntity[]> {
  const semantics: SemanticEntity[] = [];
  const sourceFiles = [...(fileCategories.source || [])].filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx'));

  // Incremental Fast Path
  let filesToParse = sourceFiles;
  if (cachedSemantics && changedFiles && deletedFiles) {
    const deletedSet = new Set(deletedFiles);
    
    // Retain cached semantics for files that were NOT changed and NOT deleted
    for (const cached of cachedSemantics) {
      if (!changedFiles.includes(cached.file) && !deletedSet.has(cached.file)) {
        semantics.push(cached);
      }
    }

    // Only parse files that ACTUALLY changed
    filesToParse = sourceFiles.filter(f => changedFiles.includes(f));
  }

  for (const file of filesToParse) {
    const absolutePath = path.join(projectPath, file);
    const astResult = await AstService.parseFile(absolutePath);
    if (!astResult) continue;

    const language = astResult.language === 'typescript' ? 'typescript' : 
                     astResult.language === 'tsx' ? 'tsx' : 'javascript';

    // 1. Classes
    try {
      const classQuery = `(class_declaration) @class`;
      const matches = AstService.executeQuery(astResult.tree, astResult.language, classQuery);
      for (const match of matches) {
        const classNode = match.captures[0].node;
        const name = classNode.childForFieldName('name')?.text || '';
        if (!name) continue;

        const decorates: string[] = [];
        const implementsIds: string[] = [];
        const extendsIds: string[] = [];

        const searchNode = classNode.parent?.type === 'export_statement' ? classNode.parent : classNode;

        for (let i = 0; i < searchNode.childCount; i++) {
          const child = searchNode.child(i);
          if (child && child.type === 'decorator') {
            const decText = child.text.replace('@', '').split('(')[0];
            if (decText) decorates.push(`decorator_${decText}`);
          }
        }

        for (let i = 0; i < classNode.childCount; i++) {
          const child = classNode.child(i);
          if (child && child.type === 'class_heritage') {
            if (child.text.startsWith('implements')) {
              const ids = child.text.replace('implements', '').split(',').map((s: string) => s.trim());
              ids.forEach((id: string) => implementsIds.push(`interface_${id}_${file}`));
            } else if (child.text.startsWith('extends')) {
              const ids = child.text.replace('extends', '').split(',').map((s: string) => s.trim());
              ids.forEach((id: string) => extendsIds.push(`class_${id}_${file}`));
            }
          }
        }

        const signatures = extractClassSignatures(classNode);

        semantics.push({
          id: `class_${name}_${file}`,
          name,
          type: 'class',
          file,
          language,
          confidence: 0.95,
          source: 'ast',
          isExported: isExported(classNode),
          decorates: decorates.length > 0 ? decorates : undefined,
          extends: extendsIds.length > 0 ? extendsIds : undefined,
          implements: implementsIds.length > 0 ? implementsIds : undefined,
          signatures: signatures.length > 0 ? signatures : undefined
        });
      }
    } catch (e) {}

    // 2. Interfaces
    try {
      if (astResult.language === 'typescript' || astResult.language === 'tsx') {
        const ifaceQuery = `(interface_declaration) @interface`;
        const matches = AstService.executeQuery(astResult.tree, astResult.language, ifaceQuery);
        for (const match of matches) {
          const node = match.captures[0].node;
          const name = node.childForFieldName('name')?.text || '';
          if (name) {
            const body = node.childForFieldName('body');
            const signatures = extractInterfaceSignatures(body);

            semantics.push({
              id: `interface_${name}_${file}`,
              name,
              type: 'interface',
              file,
              language,
              confidence: 0.95,
              source: 'ast',
              isExported: isExported(node),
              signatures: signatures.length > 0 ? signatures : undefined
            });
          }
        }
      }
    } catch (e) {}

    // 3. Functions
    try {
      const funcQuery = `(function_declaration) @func`;
      const matches = AstService.executeQuery(astResult.tree, astResult.language, funcQuery);
      for (const match of matches) {
        const node = match.captures[0].node;
        const nameNode = node.childForFieldName('name');
        if (!nameNode) continue;
        const name = nameNode.text;
        
        const paramsNode = node.childForFieldName('parameters');
        const returnTypeNode = node.childForFieldName('return_type');
        const block = node.children.find((c: any) => c.type === 'statement_block');
        const raw = block ? node.text.replace(block.text, '').trim() : node.text;

        const isHook = name.startsWith('use') && name.length > 3 && name[3] === name[3].toUpperCase();
        
        let returnType = returnTypeNode?.text || undefined;
        if (returnType && returnType.startsWith(':')) {
          returnType = returnType.substring(1).trim();
        }

        const sigs: SemanticSignature[] = [{
          name,
          kind: 'function',
          parameters: paramsNode ? [paramsNode.text] : undefined,
          returnType,
          raw
        }];

        semantics.push({
          id: `${isHook ? 'hook' : 'function'}_${name}_${file}`,
          name,
          type: isHook ? 'hook' : 'function',
          file,
          language,
          confidence: 0.9,
          source: 'ast',
          isExported: isExported(node),
          signatures: sigs
        });
      }
    } catch (e) {}

    // 4. Enums
    try {
      if (astResult.language === 'typescript' || astResult.language === 'tsx') {
        const enumQuery = `(enum_declaration) @enum`;
        const matches = AstService.executeQuery(astResult.tree, astResult.language, enumQuery);
        for (const match of matches) {
          const node = match.captures[0].node;
          const name = node.childForFieldName('name')?.text || '';
          if (name) {
            const body = node.childForFieldName('body');
            const signatures: SemanticSignature[] = [];
            if (body) {
              for (let i = 0; i < body.childCount; i++) {
                const child = body.child(i);
                if (child && (child.type === 'enum_assignment' || child.type === 'property_identifier')) {
                   signatures.push({
                     name: child.text.split('=')[0].trim(),
                     kind: 'enum_member',
                     raw: child.text.trim()
                   });
                }
              }
            }

            semantics.push({
              id: `enum_${name}_${file}`,
              name,
              type: 'enum',
              file,
              language,
              confidence: 0.95,
              source: 'ast',
              isExported: isExported(node),
              signatures: signatures.length > 0 ? signatures : undefined
            });
          }
        }
      }
    } catch (e) {}

    // 5. Type Aliases
    try {
      if (astResult.language === 'typescript' || astResult.language === 'tsx') {
        const typeQuery = `(type_alias_declaration) @type_alias`;
        const matches = AstService.executeQuery(astResult.tree, astResult.language, typeQuery);
        for (const match of matches) {
          const node = match.captures[0].node;
          const name = node.childForFieldName('name')?.text || '';
          if (name) {
            const sigs: SemanticSignature[] = [{
               name,
               kind: 'type_alias',
               raw: node.text.trim()
            }];
            semantics.push({
              id: `type_alias_${name}_${file}`,
              name,
              type: 'type_alias',
              file,
              language,
              confidence: 0.95,
              source: 'ast',
              isExported: isExported(node),
              signatures: sigs
            });
          }
        }
      }
    } catch (e) {}

    // 6. IMPORTS
    try {
      const importQuery = `(import_statement source: (string) @import_src)`;
      const matches = AstService.executeQuery(astResult.tree, astResult.language, importQuery);
      const imports: string[] = [];
      for (const match of matches) {
        match.captures.forEach(c => {
          if (c.name === 'import_src') {
            const src = c.node.text.replace(/['"]/g, '');
            imports.push(`module_${src}`);
          }
        });
      }
      if (imports.length > 0) {
        semantics.push({
          id: `file_imports_${file}`,
          name: `${file} Imports`,
          type: 'generic',
          file,
          language,
          confidence: 0.9,
          source: 'ast',
          imports
        });
      }
    } catch (e) {}
  }

  return semantics;
}
