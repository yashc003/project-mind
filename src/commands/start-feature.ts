// ============================================================================
// Command: start-feature
// ============================================================================

import { Command } from 'commander';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { loadMemory, saveMemory } from '../engines/memory/index.js';
import { logAgentInteraction } from '../engines/memory/agent-history.js';
import logger from '../utils/logger.js';
import type { CurrentFocus, Decision } from '../types/index.js';

export const startFeatureCommand = new Command('start-feature')
  .description('Start a new feature and capture intent')
  .option('-f, --feature <name>', 'Name of the feature')
  .option('-p, --problem <desc>', 'Why are we building this / What is the problem?')
  .option('-a, --alternatives <desc>', 'What alternatives were considered?')
  .option('-m, --modules <list>', 'Comma-separated list of expected modules')
  .action(async (options, command) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory) {
      logger.error('Project-Mind is not initialized. Run `project-mind init` first.');
      process.exit(1);
    }

    const agent = command.parent?.opts().agent || 'human';
    let feature = options.feature;
    let problem = options.problem;
    let alternatives = options.alternatives;
    let modulesStr = options.modules;

    // Interactive prompt if missing
    if (!feature || !problem) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const prompt = (query: string): Promise<string> =>
        new Promise((resolve) => rl.question(query, resolve));

      logger.section('Capturing Intent');
      
      if (!feature) feature = await prompt('Feature Name? ');
      if (!problem) problem = await prompt('Why are we building this / What is the problem? ');
      if (!alternatives) alternatives = await prompt('What alternatives were considered? (Optional) ');
      if (!modulesStr) modulesStr = await prompt('What core modules will this affect? (Comma-separated) ');

      rl.close();
    }

    const expectedModules = modulesStr ? modulesStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    // Create Focus
    const focus: CurrentFocus = {
      id: crypto.randomBytes(4).toString('hex'),
      feature,
      task: `Implement ${feature}`,
      status: 'planning',
      blockers: [],
      expectedModules,
      actualModules: [],
      subTasks: [],
      linkedCommits: [],
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    // Store previous focus in history if it exists
    if (memory.focusHistory.active) {
      memory.focusHistory.history.push(memory.focusHistory.active);
    }
    
    memory.focusHistory.active = focus;

    // Record decision
    const decision: Decision = {
      id: crypto.randomBytes(4).toString('hex'),
      title: `Start feature: ${feature}`,
      description: problem,
      rejected: alternatives ? [alternatives] : [],
      reason: 'Feature initiation',
      timestamp: new Date().toISOString(),
      source: 'manual',
      tags: ['feature-lifecycle'],
      confidence: 100,
      impactedFeatures: [feature],
      impactedComponents: expectedModules,
    };
    memory.decisions.push(decision);

    await saveMemory(projectPath, memory);
    await logAgentInteraction(projectPath, agent, 'start-feature', feature);

    logger.success(`Feature '${feature}' started. Intent captured.`);
    logger.info('CURRENT_FOCUS.json and DECISIONS.md have been updated.');
  });
