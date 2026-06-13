// ============================================================================
// Project-Mind CLI Entry Point
// ============================================================================
// This is the executable entry point invoked from the command line.
// It creates the Commander program and parses argv.
// ============================================================================

import { createProgram } from './index.js';
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    // Commander throws on --help and --version (exitOverride)
    if (err instanceof Error && 'exitCode' in err) {
      const exitCode = (err as { exitCode: number }).exitCode;
      if (exitCode === 0) {
        process.exit(0);
      }
    }
    // Other errors are already handled by individual commands
    process.exit(1);
  }
}

main();
