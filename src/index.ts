// ============================================================================
// Project-Mind — Main Program Setup
// ============================================================================
// Configures the Commander program with all subcommands and global options.
// This is the programmatic entry point (importable as a library).
// ============================================================================

import { Command } from 'commander';
import { getProjectMindVersion } from './utils/version.js';
import { initCommand } from './commands/init.js';
import { updateCommand } from './commands/update.js';
import { noteCommand } from './commands/note.js';
import { handoffCommand } from './commands/handoff.js';
import { installHooksCommand } from './commands/install-hooks.js';
import { startFeatureCommand } from './commands/start-feature.js';
import { completeFeatureCommand } from './commands/complete-feature.js';
import { focusCommand } from './commands/focus.js';
import { importContextCommand } from './commands/import-context.js';
import { doctorCommand } from './commands/doctor.js';
import { queryCommand } from './commands/query.js';
import { impactCommand } from './commands/impact.js';
import { graphCommand } from './commands/graph.js';
import { packCommand } from './commands/pack.js';
import { explainCommand } from './commands/explain.js';
import { whyCommand } from './commands/why.js';
import { snapshotCommand } from './commands/snapshot.js';
import { recommendCommand } from './commands/recommend.js';
import { pluginCommand } from './commands/plugin.js';
import { lintCommand } from './commands/lint.js';
import { governanceCommand } from './commands/governance.js';
import { repairCommand } from './commands/repair.js';
import { diffCommand } from './commands/diff.js';
import { installIdeCommand } from './commands/install-ide.js';
import { mcpCommand } from './commands/mcp.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('project-mind')
    .version(getProjectMindVersion())
    .description(
      'Project-Mind — Autonomous Project Intelligence & AI Context Persistence\n\n' +
      'Preserve, reconstruct, and transfer project understanding between\n' +
      'humans and AI agents. Git stores code — Project-Mind stores understanding.'
    )
    .option('--agent <name>', 'Name of the AI agent executing the command', 'human');

  // Register subcommands
  program.addCommand(initCommand);
  program.addCommand(updateCommand);
  program.addCommand(noteCommand);
  program.addCommand(handoffCommand);
  program.addCommand(installHooksCommand);
  program.addCommand(startFeatureCommand);
  program.addCommand(completeFeatureCommand);
  program.addCommand(focusCommand);
  program.addCommand(importContextCommand);
  program.addCommand(doctorCommand);
  program.addCommand(queryCommand);
  program.addCommand(impactCommand);
  program.addCommand(graphCommand);
  program.addCommand(packCommand);
  program.addCommand(explainCommand);
  program.addCommand(whyCommand);
  program.addCommand(snapshotCommand);
  program.addCommand(recommendCommand);
  program.addCommand(pluginCommand);
  program.addCommand(lintCommand);
  program.addCommand(governanceCommand);
  program.addCommand(repairCommand);
  program.addCommand(diffCommand);
  program.addCommand(installIdeCommand);
  program.addCommand(mcpCommand);

  // Global error handling
  program.exitOverride();
  program.configureOutput({
    writeErr: (str) => {
      if (!str.includes('error: missing required argument')) {
        process.stderr.write(str);
      }
    },
  });

  return program;
}

// Export types for library usage
export type { ProjectMemory, ProjectMindConfig } from './types/index.js';
export { loadMemory, loadConfig } from './engines/memory/index.js';
export { SCHEMA_VERSION } from './engines/memory/schema.js';
