// ============================================================================
// Command: explain
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { explainNode } from '../engines/graph/explain.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const explainCommand = new Command('explain')
  .description('Explain a feature, workflow, or component and its current context')
  .argument('<topic>', 'The topic to explain (e.g., "authentication")')
  .action(async (topic) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory || !memory.knowledgeGraph) {
      logger.error('Project memory not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const result = await explainNode(memory, projectPath, topic);

    if (!result) {
      logger.error(`Could not find any knowledge regarding "${topic}".`);
      process.exit(1);
    }

    const { node, signatures, decisions, workflows, components, agents, pluginSections } = result;

    console.log(chalk.bold.magenta(`\n🧠 Explanation: ${node.label} (${node.type})\n`));

    // Signatures
    if (signatures.length > 0) {
      console.log(chalk.bold.green('AST Signatures:'));
      console.log(chalk.gray('```typescript'));
      signatures.forEach((sig) => {
        if (sig.raw) {
          console.log(sig.raw);
        } else {
          const modifiers = sig.modifiers ? sig.modifiers.join(' ') + ' ' : '';
          const params = sig.parameters ? sig.parameters.join(', ') : '';
          const returnType = sig.returnType ? `: ${sig.returnType}` : '';
          
          if (sig.kind === 'method' || sig.kind === 'function') {
            console.log(`${modifiers}${sig.name}(${params})${returnType}`);
          } else if (sig.kind === 'property') {
            console.log(`${modifiers}${sig.name}${returnType}`);
          } else {
            console.log(`${sig.name}`);
          }
        }
      });
      console.log(chalk.gray('```\n'));
    }

    // Decisions
    if (decisions.length > 0) {
      console.log(chalk.bold.cyan('Related Decisions:'));
      decisions.forEach(d => {
        console.log(`  • ${d.label}`);
        if (d.reason) console.log(chalk.gray(`    Reason: ${d.reason}`));
      });
      console.log();
    }

    // Workflows
    if (workflows.length > 0) {
      console.log(chalk.bold.cyan('Related Workflows:'));
      workflows.forEach(w => console.log(`  • ${w}`));
      console.log();
    }

    // Components
    if (components.length > 0) {
      console.log(chalk.bold.cyan('Affected Components:'));
      components.forEach(c => console.log(`  • ${c}`));
      console.log();
    }

    // Agents
    if (agents.length > 0) {
      console.log(chalk.bold.cyan('Recent Activity:'));
      agents.forEach(a => console.log(`  • Touched by ${a}`));
      console.log();
    }

    // Plugin Extensions
    if (pluginSections.length > 0) {
      pluginSections.forEach(sec => {
        console.log(chalk.bold.blue(`${sec.pluginName} Highlights:`));
        console.log(chalk.bold(`  ${sec.title}`));
        const lines = sec.content.split('\n');
        lines.forEach(l => console.log(`    ${l}`));
        console.log();
      });
    }
  });
