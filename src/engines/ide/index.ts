// ============================================================================
// IDE Integration Engine
// ============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';

export interface IDEProvider {
  id: string;
  name: string;
  ruleFile: string;
  configDir?: string;
}

export const IDE_PROVIDERS: IDEProvider[] = [
  {
    id: 'cursor',
    name: 'Cursor',
    ruleFile: '.cursorrules',
    configDir: '.cursor',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    ruleFile: '.windsurfrules',
    configDir: '.windsurf',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    ruleFile: '.github/copilot-instructions.md',
    configDir: '.github',
  },
  {
    id: 'cline',
    name: 'Cline',
    ruleFile: '.clinerules',
  },
  {
    id: 'roo',
    name: 'Roo Code',
    ruleFile: '.roorules',
  },
  {
    id: 'trae',
    name: 'Trae',
    ruleFile: '.traerules',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    ruleFile: '.antigravityrules',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    ruleFile: 'CLAUDE.md',
  },
  {
    id: 'devin',
    name: 'Devin',
    ruleFile: '.devinrules',
  },
  {
    id: 'pearai',
    name: 'PearAI',
    ruleFile: '.pearairules',
  },
  {
    id: 'continue',
    name: 'Continue',
    ruleFile: '.prompts/project-mind.prompt',
    configDir: '.prompts',
  }
];

const INTEGRATION_SNIPPET = `
# Project-Mind Integration

Before making architectural changes or writing code:
1. Read \`.project-mind/AI_START_HERE.md\`
2. Read \`.project-mind/CURRENT_FOCUS.json\`
3. Review \`.project-mind/DECISIONS.md\`

If additional context is required:
- Run \`project-mind pack current\`
- Run \`project-mind explain <feature>\`
- Run \`project-mind query <topic>\`

Before completing significant work:
- Run \`project-mind update\`
- Run \`project-mind lint\`
`;

export interface IDEStatus {
  provider: IDEProvider;
  isInstalled: boolean;
  isIntegrated: boolean;
  filePath: string;
}

/**
 * Checks if a specific file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Checks if a directory exists.
 */
async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Checks the status of all supported IDE integrations.
 */
export async function checkIDEIntegrations(projectPath: string): Promise<IDEStatus[]> {
  const statuses: IDEStatus[] = [];

  for (const provider of IDE_PROVIDERS) {
    const filePath = path.join(projectPath, provider.ruleFile);
    const hasRuleFile = await fileExists(filePath);

    let hasConfigDir = false;
    if (provider.configDir) {
      hasConfigDir = await dirExists(path.join(projectPath, provider.configDir));
    }

    const isInstalled = hasRuleFile || hasConfigDir;
    let isIntegrated = false;

    if (hasRuleFile) {
      const content = await fs.readFile(filePath, 'utf-8');
      if (content.includes('# Project-Mind Integration') || content.includes('project-mind pack')) {
        isIntegrated = true;
      }
    }

    statuses.push({
      provider,
      isInstalled,
      isIntegrated,
      filePath
    });
  }

  return statuses;
}

/**
 * Returns a list of IDEs that are likely used in this project but NOT YET integrated.
 */
export async function detectAvailableIDEs(projectPath: string): Promise<IDEProvider[]> {
  const statuses = await checkIDEIntegrations(projectPath);
  return statuses
    .filter(s => s.isInstalled && !s.isIntegrated)
    .map(s => s.provider);
}

/**
 * Appends the Project-Mind integration snippet to the specified IDE's rule file.
 */
export async function installIDEIntegration(projectPath: string, provider: IDEProvider): Promise<boolean> {
  const statuses = await checkIDEIntegrations(projectPath);
  const status = statuses.find(s => s.provider.id === provider.id);

  if (!status) return false;

  // Already integrated, nothing to do
  if (status.isIntegrated) return true;

  // Ensure directory exists if the rule file is nested (e.g. .github/)
  const dirName = path.dirname(status.filePath);
  if (dirName !== projectPath) {
    await fs.mkdir(dirName, { recursive: true });
  }

  // Append or create the rule file
  let newContent = '';
  if (status.isInstalled && await fileExists(status.filePath)) {
    const currentContent = await fs.readFile(status.filePath, 'utf-8');
    newContent = currentContent.trimEnd() + '\n\n' + INTEGRATION_SNIPPET.trim() + '\n';
  } else {
    newContent = INTEGRATION_SNIPPET.trim() + '\n';
  }

  await fs.writeFile(status.filePath, newContent);
  return true;
}
