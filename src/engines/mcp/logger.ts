import logger from '../../utils/logger.js';

/**
 * When running as an MCP server over stdio, any output to stdout will corrupt
 * the JSON-RPC stream. This utility monkey-patches console.log to use
 * console.error instead, ensuring safe logging.
 */
export function redirectConsoleToStderr(): void {
  const originalLog = console.log;
  const originalInfo = console.info;

  console.log = (...args: any[]) => {
    console.error(...args);
  };

  console.info = (...args: any[]) => {
    console.error(...args);
  };

  // We don't touch console.error or console.warn as they already go to stderr
  
  // Also notify our custom logger to not write to stdout if it does
  // In our case, chalk will just write to stderr since we redirected console.log
}
