import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { extractSemantics } from '../../src/engines/discovery/semantics.js';
import { AstService } from '../../src/engines/discovery/ast/AstService.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';

describe('AST Semantic Extraction Engine', () => {
  let tempDir: string;
  let testFile: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-mind-semantics-'));
    testFile = path.join(tempDir, 'user.controller.ts');
    
    await fs.writeFile(testFile, `
import { Controller } from '@nestjs/common';
import { UserService } from './user.service';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export type StringOrNumber = string | number;

@Controller('users')
export class UserController implements IController, Base {
  constructor(private readonly service: UserService) {}

  public async getUser(id: string): Promise<User> {
    return this.service.get(id);
  }
}

export interface IController {
  getUser(id: string): Promise<User>;
}

export function helperFunc(val: string): void {
  console.log(val);
}
    `);
    });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('extracts IMPORTS, IMPLEMENTS, and DECORATES relationships from AST', async () => {
    const fileCategories = { source: ['user.controller.ts'] } as any;
    const semantics = await extractSemantics(tempDir, fileCategories);
    
    // Should have extracted the file generic imports node
    const importsNode = semantics.find(s => s.id === 'file_imports_user.controller.ts');
    expect(importsNode).toBeDefined();
    expect(importsNode?.imports).toContain('module_@nestjs/common');
    expect(importsNode?.imports).toContain('module_./user.service');

    // Should have extracted the class and its decorators / implements
    const classNode = semantics.find(s => s.type === 'class' && s.name === 'UserController');
    if (!classNode) console.log(JSON.stringify(semantics, null, 2));
    expect(classNode).toBeDefined();
    expect(classNode?.decorates).toContain('decorator_Controller');
    
    // Testing IMPLEMENTS
    expect(classNode?.implements).toContain('interface_IController_user.controller.ts');
    expect(classNode?.implements).toContain('interface_Base_user.controller.ts');
  });

  it('extracts structured signatures, enums, type aliases, and export awareness', async () => {
    const fileCategories = { source: ['user.controller.ts'] } as any;
    const semantics = await extractSemantics(tempDir, fileCategories);

    // Test Class Signature
    const classNode = semantics.find(s => s.type === 'class' && s.name === 'UserController');
    expect(classNode).toBeDefined();
    expect(classNode?.isExported).toBe(true);
    expect(classNode?.source).toBe('ast');
    expect(classNode?.signatures).toBeDefined();
    
    const getUserMethod = classNode?.signatures?.find(s => s.name === 'getUser');
    expect(getUserMethod).toBeDefined();
    expect(getUserMethod?.kind).toBe('method');
    expect(getUserMethod?.parameters).toContain('(id: string)');
    expect(getUserMethod?.returnType).toBe('Promise<User>');
    expect(getUserMethod?.modifiers).toContain('public');
    expect(getUserMethod?.modifiers).toContain('async');

    // Test Interface
    const interfaceNode = semantics.find(s => s.type === 'interface' && s.name === 'IController');
    expect(interfaceNode).toBeDefined();
    expect(interfaceNode?.isExported).toBe(true);
    expect(interfaceNode?.signatures?.[0].name).toBe('getUser');

    // Test Enum
    const enumNode = semantics.find(s => s.type === 'enum' && s.name === 'UserRole');
    expect(enumNode).toBeDefined();
    expect(enumNode?.isExported).toBe(true);
    expect(enumNode?.signatures).toBeDefined();
    expect(enumNode?.signatures?.length).toBe(2);
    expect(enumNode?.signatures?.[0].kind).toBe('enum_member');
    expect(enumNode?.signatures?.[0].name).toBe('ADMIN');

    // Test Type Alias
    const typeNode = semantics.find(s => s.type === 'type_alias' && s.name === 'StringOrNumber');
    expect(typeNode).toBeDefined();
    expect(typeNode?.isExported).toBe(true);
    expect(typeNode?.signatures?.[0].kind).toBe('type_alias');

    // Test Function
    const funcNode = semantics.find(s => s.type === 'function' && s.name === 'helperFunc');
    expect(funcNode).toBeDefined();
    expect(funcNode?.isExported).toBe(true);
    expect(funcNode?.signatures?.[0].name).toBe('helperFunc');
    expect(funcNode?.signatures?.[0].parameters).toContain('(val: string)');
    expect(funcNode?.signatures?.[0].returnType).toBe('void');
  });
});
