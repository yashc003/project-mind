// ============================================================================
// Logger — Chalk-based terminal output with consistent formatting
// ============================================================================

import chalk from 'chalk';

const PREFIX = chalk.hex('#7C3AED').bold('⬡ project-mind');

export const logger = {
  /** Informational message */
  info(message: string): void {
    console.log(`${PREFIX} ${chalk.blue('ℹ')} ${message}`);
  },

  /** Success message with green checkmark */
  success(message: string): void {
    console.log(`${PREFIX} ${chalk.green('✓')} ${message}`);
  },

  /** Warning message with yellow indicator */
  warn(message: string): void {
    console.log(`${PREFIX} ${chalk.yellow('⚠')} ${chalk.yellow(message)}`);
  },

  /** Error message with red indicator */
  error(message: string): void {
    console.log(`${PREFIX} ${chalk.red('✗')} ${chalk.red(message)}`);
  },

  /** Numbered step indicator for multi-step operations */
  step(stepNum: number, total: number, message: string): void {
    const counter = chalk.dim(`[${stepNum}/${total}]`);
    console.log(`${PREFIX} ${counter} ${message}`);
  },

  /** Dimmed debug message (only shown in verbose mode) */
  debug(message: string): void {
    if (process.env.PROJECT_MIND_DEBUG === '1') {
      console.log(`${PREFIX} ${chalk.dim(`› ${message}`)}`);
    }
  },

  /** Blank line */
  blank(): void {
    console.log();
  },

  /** Section header */
  section(title: string): void {
    console.log();
    console.log(`${PREFIX} ${chalk.bold.underline(title)}`);
  },

  /** Key-value pair display */
  kv(key: string, value: string | number): void {
    console.log(`  ${chalk.dim(key + ':')} ${chalk.white(String(value))}`);
  },

  /** Bulleted list item */
  bullet(message: string): void {
    console.log(`  ${chalk.dim('•')} ${message}`);
  },

  /** Boxed highlight for important messages */
  box(message: string): void {
    const border = chalk.hex('#7C3AED');
    const lines = message.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length));
    const pad = (s: string) => s + ' '.repeat(maxLen - s.length);

    console.log();
    console.log(`  ${border('┌' + '─'.repeat(maxLen + 2) + '┐')}`);
    for (const line of lines) {
      console.log(`  ${border('│')} ${pad(line)} ${border('│')}`);
    }
    console.log(`  ${border('└' + '─'.repeat(maxLen + 2) + '┘')}`);
    console.log();
  },

  /** Confidence score display with color coding */
  confidence(label: string, score: number): void {
    const pct = `${score}%`;
    let coloredPct: string;
    if (score >= 80) {
      coloredPct = chalk.green(pct);
    } else if (score >= 50) {
      coloredPct = chalk.yellow(pct);
    } else {
      coloredPct = chalk.red(pct);
    }
    console.log(`  ${chalk.dim(label + ':')} ${coloredPct}`);
  },
};

export default logger;
