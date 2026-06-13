// ============================================================================
// CLI Command: governance
// ============================================================================
// Generates the GOVERNANCE.md report from the GOVERNANCE.json artifact.
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import logger from '../utils/logger.js';
import { getProjectRoot } from '../utils/fs.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { GovernanceReport } from '../types/index.js';

export const governanceCommand = new Command('governance')
  .description('Manage project governance and reporting');

governanceCommand
  .command('report')
  .description('Generate human-readable GOVERNANCE.md report')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    try {
      const projectPath = options.projectDir ? options.projectDir : await getProjectRoot();
      const reportPath = path.join(projectPath, '.project-mind', 'GOVERNANCE.json');

      const spinner = ora('Generating governance report...').start();

      let reportContent: string;
      try {
        reportContent = await fs.readFile(reportPath, 'utf-8');
      } catch (e) {
        spinner.fail('No GOVERNANCE.json found. Run `project-mind lint` first.');
        process.exit(1);
      }

      const report: GovernanceReport = JSON.parse(reportContent);
      const outPath = path.join(projectPath, '.project-mind', 'GOVERNANCE.md');

      const md = [
        `# Project Governance Report`,
        `*Generated: ${new Date(report.generatedAt).toLocaleString()}*`,
        ``,
        `## Architecture Score: ${report.metrics.architectureScore}/100`,
        ``,
        `| Metric | Count |`,
        `|--------|-------|`,
        `| Total Policies | ${report.metrics.totalPolicies} |`,
        `| Passed | ${report.metrics.passedPolicies} |`,
        `| Warnings | ${report.metrics.warningCount} |`,
        `| Errors | ${report.metrics.errorCount} |`,
        `| Active Debt | ${report.metrics.debtCount} |`,
        ``,
        `## Policy Violations`,
        ``
      ];

      const violations = report.results.filter(r => r.status !== 'passed');
      if (violations.length === 0) {
        md.push(`*No violations found!*`);
      } else {
        for (const v of violations) {
          md.push(`### [${v.status.toUpperCase()}] ${v.policyId}`);
          md.push(`> ${v.message}`);
          if (v.affectedNodes.length > 0) {
            md.push(``);
            md.push(`**Affected Nodes:**`);
            for (const n of v.affectedNodes) {
              md.push(`- \`${n}\``);
            }
          }
          md.push(``);
        }
      }

      md.push(`## Technical Debt (Exceptions)`);
      md.push(``);
      if (report.exceptions.length === 0) {
        md.push(`*No active exceptions.*`);
      } else {
        const now = new Date();
        for (const ex of report.exceptions) {
          const expiresAt = new Date(ex.expires);
          const isExpired = expiresAt < now;
          const statusStr = isExpired ? '**EXPIRED**' : `Expires: ${ex.expires}`;
          md.push(`- **${ex.policyId}** on \`${ex.targetId}\` | ${statusStr}`);
          md.push(`  - Reason: *${ex.reason}*`);
        }
      }

      await fs.writeFile(outPath, md.join('\n'), 'utf-8');
      spinner.succeed(`Generated GOVERNANCE.md at ${outPath}`);

    } catch (err) {
      logger.error(`Report generation failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
