// ============================================================================
// Command: pack
// ============================================================================

import { Command } from 'commander';
import path from 'node:path';
import { loadMemory } from '../engines/memory/index.js';
import { generateContextPack } from '../engines/pack/index.js';
import { writeText, ensureDir } from '../utils/fs.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export const packCommand = new Command('pack')
  .description('Generate a concentrated Context Pack for LLM onboarding')
  .argument('<topic>', 'The topic to pack, or "current" to auto-detect from active focus')
  .option('-c, --compact', 'Generate a compact pack (1-2k tokens)')
  .option('-f, --full', 'Generate a full depth pack including source code (5-10k tokens)')
  .option('--type <type>', 'Type of topic: "component", "feature", or "auto"', 'auto')
  .option('-s, --scope <path>', 'Filter pack geographically to a specific path')
  .option('-b, --budget <tokens>', 'Maximum tokens for the generated pack', parseInt)
  .option('--explain-budget', 'Explain token allocation and degradation logic')
  .action(async (topic, options) => {
    const projectPath = process.cwd();
    const memory = await loadMemory(projectPath);

    if (!memory) {
      logger.error('Project memory not initialized. Run `project-mind update` first.');
      process.exit(1);
    }

    const isCurrent = topic.toLowerCase() === 'current';
    const level = options.full ? 'full' : 'compact'; 

    logger.info(`Generating ${level} Context Relevance Pack for: ${isCurrent ? 'Current Focus' : topic}...`);
    if (options.scope) logger.info(`Scope boundary: ${options.scope}`);

    try {
      const result = await generateContextPack(projectPath, memory, { 
        topic: options.type !== 'auto' ? `${options.type}:${topic}` : topic, 
        isCurrent, 
        level,
        scope: options.scope,
        budget: options.budget,
        explainBudget: options.explainBudget
      });
      
      const packsDir = path.join(projectPath, '.project-mind', 'packs');
      await ensureDir(packsDir);

      let filename = isCurrent ? 'current.md' : `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
      const outPath = path.join(packsDir, filename);

      await writeText(outPath, result.content);

      logger.success(`Context Pack generated successfully!`);
      console.log(`\n  ${chalk.cyan(outPath)}\n`);
      
      if (options.explainBudget && result.allocations) {
        console.log(chalk.bold('\nBudget Allocation Report:'));
        let total = 0;
        for (const alloc of result.allocations) {
           console.log(`${alloc.section.padEnd(30)} | ${alloc.priority.padEnd(10)} | ${alloc.detailLevel.padEnd(10)} | ${alloc.estimatedTokens} tokens`);
           total += alloc.estimatedTokens;
        }
        console.log(`\nTotal Tokens Estimated: ${total}`);
      }

      console.log(chalk.gray(`\n  Paste the contents of this file into your LLM when switching context.`));
    } catch (error: any) {
      logger.error(`Failed to generate Context Pack: ${error.message}`);
      process.exit(1);
    }
  });
