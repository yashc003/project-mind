// ============================================================================
// Command: snapshot
// ============================================================================

import { Command } from 'commander';
import { loadMemory } from '../engines/memory/index.js';
import { pluginRegistry } from '../engines/plugin/registry.js';
import { computeProgress, detectScopeDrift } from '../engines/focus/index.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const snapshotCommand = new Command('snapshot')
  .description('View a high-level snapshot of project knowledge (like git status)')
  .action(async () => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory) {
      logger.error('Project memory not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    console.log(chalk.bold.magenta('\n📸 Project State Snapshot\n'));

    // Focus
    const active = memory.focusHistory.active;
    if (active) {
      const progress = computeProgress(memory);
      const drift = detectScopeDrift(memory);
      
      console.log(chalk.bold('Current Focus:'));
      console.log(`  Feature:  ${chalk.cyan(active.feature)}`);
      console.log(`  Status:   ${active.status}`);
      console.log(`  Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
      if (active.blockers.length > 0) {
        console.log(`  Blockers: ${chalk.red(active.blockers.length)}`);
      }
      if (drift.hasDrift) {
        console.log(`  Scope:    ${chalk.yellow('⚠ Drift Detected')}`);
      } else {
        console.log(`  Scope:    ${chalk.green('✅ On Track')}`);
      }
      console.log();
    } else {
      console.log(chalk.bold('Current Focus:'));
      console.log(`  ${chalk.cyan('None')}\n`);
    }

    // Features
    const totalFeatures = memory.features?.length || 0;
    const activeFeatures = memory.features?.filter(f => f.status === 'active').length || 0;
    const staleFeatures = memory.features?.filter(f => f.status === 'stale').length || 0;
    
    console.log(chalk.bold('Features:'));
    console.log(`  Active:  ${chalk.green(activeFeatures)}`);
    if (staleFeatures > 0) console.log(`  Stale: ${chalk.yellow(staleFeatures)}`);
    console.log(`  Total:   ${totalFeatures}\n`);

    // Decisions
    const totalDecisions = memory.decisions.length;
    console.log(chalk.bold('Decisions:'));
    console.log(`  Recorded: ${chalk.yellow(totalDecisions)}\n`);

    // Agents
    if (memory.knowledgeGraph) {
      const agents = memory.knowledgeGraph.nodes.filter(n => n.type === 'agent');
      if (agents.length > 0) {
        console.log(chalk.bold('Recent Agents:'));
        agents.forEach(a => console.log(`  • ${chalk.blueBright(a.label)}`));
        console.log();
      }
    }

    // Knowledge Score
    const score = Math.round(memory.confidence.overall);
    let scoreColor = chalk.green;
    if (score < 70) scoreColor = chalk.yellow;
    if (score < 40) scoreColor = chalk.red;
    
    console.log(chalk.bold('Knowledge Score:'));
    console.log(`  ${scoreColor(`${score}%`)}\n`);

    // --- Plugin Extensions ---
    await pluginRegistry.loadPlugins(projectPath);
    const plugins = pluginRegistry.getPlugins();

    for (const plugin of plugins) {
      if (plugin.onSnapshot && plugin.capabilities.includes('snapshot')) {
        try {
          const sections = await plugin.onSnapshot(memory);
          if (sections && sections.length > 0) {
            console.log(chalk.bold.blue(`${plugin.name} Insights:`));
            sections.forEach(sec => {
              console.log(chalk.bold(`  ${sec.title}:`));
              const lines = sec.content.split('\n');
              lines.forEach(l => console.log(`    ${l}`));
            });
            console.log();
          }
        } catch (err: any) {
          logger.error(`Plugin ${plugin.name} failed during onSnapshot: ${err.message}`);
        }
      }
    }
  });
