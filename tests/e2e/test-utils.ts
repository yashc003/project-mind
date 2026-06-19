import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../dist/cli.js');

export const FIXTURES = [
  'basic-node-app',
  'nestjs-app',
  'spring-boot-app',
  'react-app',
  'fastapi-app',
  'express-app',
  'django-app',
  'laravel-app',
  'sveltekit-app',
];

export async function buildCli() {
  await execAsync('npm run build');
}

export async function setupFixture(fixture: string) {
  const fixturePath = path.resolve(__dirname, '../fixtures', fixture);
  const dotProjectMindPath = path.join(fixturePath, '.project-mind');
  
  try {
    await fs.rm(dotProjectMindPath, { recursive: true, force: true });
    await fs.unlink(path.join(fixturePath, '.project-mind.json'));
  } catch (e) {
    // Ignore
  }
  
  // Re-init git
  try {
    await fs.rm(path.join(fixturePath, '.git'), { recursive: true, force: true });
  } catch (e) {
    // Ignore
  }
  await execAsync('git init', { cwd: fixturePath });
  await execAsync('git config core.autocrlf false', { cwd: fixturePath });
  await execAsync('git config user.name "Test User"', { cwd: fixturePath });
  await execAsync('git config user.email "test@example.com"', { cwd: fixturePath });
  // Initial commit so project-mind has a clean state to diff against
  await execAsync('git add . && git commit --allow-empty -m "Init"', { cwd: fixturePath });
  
  return { fixturePath, dotProjectMindPath };
}

export async function cleanupFixture(fixture: string) {
  const fixturePath = path.resolve(__dirname, '../fixtures', fixture);
  const dotProjectMindPath = path.join(fixturePath, '.project-mind');
  try {
    await fs.rm(dotProjectMindPath, { recursive: true, force: true });
    await fs.unlink(path.join(fixturePath, '.project-mind.json'));
    await fs.rm(path.join(fixturePath, '.git'), { recursive: true, force: true });
  } catch (e) {
    // Ignore
  }
}

export async function runCli(args: string, fixturePath: string) {
  try {
    const { stdout, stderr } = await execAsync(`node ${CLI_PATH} ${args}`, { cwd: fixturePath });
    return { stdout: stdout + '\n' + stderr, stderr };
  } catch (err: any) {
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    throw err;
  }
}

export async function getGraph(dotProjectMindPath: string) {
  const content = await fs.readFile(path.join(dotProjectMindPath, 'derived', 'KNOWLEDGE_GRAPH.json'), 'utf-8');
  return JSON.parse(content);
}

export async function hasNodeLabel(graph: any, label: string) {
  return graph.nodes.some((n: any) => n.label === label);
}

export async function hasNodeType(graph: any, type: string) {
  return graph.nodes.some((n: any) => n.type === type);
}

export async function hasProperty(graph: any, prop: string, value: string) {
  return graph.nodes.some((n: any) => n.properties && n.properties[prop] === value);
}
