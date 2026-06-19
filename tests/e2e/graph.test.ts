import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCli, setupFixture, cleanupFixture, runCli, getGraph } from './test-utils';

describe('Framework-Specific Graph Assertions', () => {
  beforeAll(async () => {
    
  }, 180000);

  describe('NestJS', () => {
    let fixturePath: string, dotProjectMindPath: string;
    beforeAll(async () => { ({ fixturePath, dotProjectMindPath } = await setupFixture('nestjs-app')); await runCli('init -p .', fixturePath); }, 180000);
    afterAll(async () => { await cleanupFixture('nestjs-app'); });
    
    it('should detect controllers and services', async () => {
      const graph = await getGraph(dotProjectMindPath);
      expect(graph.nodes.some((n: any) => n.type === 'component' && n.label === 'app.controller')).toBe(true);
      expect(graph.nodes.some((n: any) => n.type === 'component' && n.label === 'app.service')).toBe(true);
    });
  });

  describe('Express', () => {
    let fixturePath: string, dotProjectMindPath: string;
    beforeAll(async () => { ({ fixturePath, dotProjectMindPath } = await setupFixture('express-app')); await runCli('init -p .', fixturePath); }, 180000);
    afterAll(async () => { await cleanupFixture('express-app'); });
    
    it('should detect express controllers and workflows', async () => {
      const graph = await getGraph(dotProjectMindPath);
      // Wait, the plugin logic checks for files containing "controller", we should ensure it has a controller node
      expect(graph.nodes.some((n: any) => n.type === 'component' && n.properties?.type === 'controller')).toBe(true);
      // Should extract API routes
      expect(graph.nodes.some((n: any) => n.label.includes('GET /users') || n.label.includes('getUsers'))).toBe(true);
    });
  });

  describe('Spring Boot', () => {
    let fixturePath: string, dotProjectMindPath: string;
    beforeAll(async () => { ({ fixturePath, dotProjectMindPath } = await setupFixture('spring-boot-app')); await runCli('init -p .', fixturePath); }, 180000);
    afterAll(async () => { await cleanupFixture('spring-boot-app'); });
    
    it('should detect @RestController endpoints', async () => {
      const graph = await getGraph(dotProjectMindPath);
      expect(graph.nodes.some((n: any) => n.type === 'component' && n.properties?.type === 'controller')).toBe(true);
    });
  });

  describe('React', () => {
    let fixturePath: string, dotProjectMindPath: string;
    beforeAll(async () => { ({ fixturePath, dotProjectMindPath } = await setupFixture('react-app')); await runCli('init -p .', fixturePath); }, 180000);
    afterAll(async () => { await cleanupFixture('react-app'); });
    
    it('should detect React components', async () => {
      const graph = await getGraph(dotProjectMindPath);
      expect(graph.nodes.some((n: any) => n.type === 'component' && n.label === 'App')).toBe(true);
    });
  });
});
