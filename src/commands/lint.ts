// ============================================================================
// CLI Command: lint
// ============================================================================
// Evaluates governance policies, calculates metrics, and enforces architecture.
// Exits with code 1 if blocking policies fail without valid exceptions.
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import logger from '../utils/logger.js';
import { getProjectRoot, writeJson } from '../utils/fs.js';
import { loadMemory, loadConfig } from '../engines/memory/index.js';
import { evaluatePolicies } from '../engines/governance/evaluator.js';
import { calculateMetrics } from '../engines/governance/metrics.js';
import path from 'node:path';
import type { GovernanceReport } from '../types/index.js';

export const lintCommand = new Command('lint')
  .description('Enforce architectural governance policies')
  .option('-p, --project-dir <path>', 'Project directory (defaults to current)')
  .action(async (options) => {
    try {
      const projectPath = options.projectDir ? options.projectDir : await getProjectRoot();
      const memory = await loadMemory(projectPath);
      const config = await loadConfig(projectPath);

      if (!memory) {
        logger.error('Project memory not found. Run `project-mind init` first.');
        process.exit(1);
      }

      if (!config.policies || config.policies.length === 0) {
        logger.info('No governance policies defined. Run `project-mind init --governance` to scaffold defaults.');
        return;
      }

      logger.box('Running Architectural Linter');

      const spinner = ora('Evaluating policies...').start();
      const results = evaluatePolicies(memory, config);
      const metrics = calculateMetrics(memory, config, results);
      spinner.succeed('Evaluation complete');

      const report: GovernanceReport = {
        generatedAt: new Date().toISOString(),
        metrics,
        results,
        exceptions: config.exceptions || [],
      };

      // Output GOVERNANCE.json
      const reportPath = path.join(projectPath, '.project-mind', 'GOVERNANCE.json');
      await writeJson(reportPath, report);

      logger.blank();
      logger.info(`Architecture Score: ${metrics.architectureScore}/100`);
      logger.info(`Passed: ${metrics.passedPolicies} | Warnings: ${metrics.warningCount} | Errors: ${metrics.errorCount} | Active Debt: ${metrics.debtCount}`);
      logger.blank();

      let hasBlockingFailure = false;
      const now = new Date();

      for (const result of results) {
        if (result.status !== 'passed') {
          const policy = config.policies.find(p => p.id === result.policyId);
          if (!policy) continue;

          let isExcepted = true;
          for (const node of result.affectedNodes) {
            const hasActiveException = report.exceptions.some(
              ex => ex.policyId === policy.id && ex.targetId === node && new Date(ex.expires) >= now
            );
            if (!hasActiveException) {
              isExcepted = false;
              break;
            }
          }

          const prefix = isExcepted ? '[EXCEPTED]' : (policy.enforcement === 'blocking' ? '[BLOCKING]' : '[ADVISORY]');

          if (result.status === 'failed') {
            logger.error(`${prefix} ${policy.name}: ${result.message}`);
            if (!isExcepted && policy.enforcement === 'blocking') {
              hasBlockingFailure = true;
            }
          } else {
            logger.warn(`${prefix} ${policy.name}: ${result.message}`);
          }

          if (result.affectedNodes.length > 0) {
            logger.bullet(`Affected Nodes: ${result.affectedNodes.join(', ')}`);
          }
        }
      }

      // Check expiring tech debt
      for (const ex of report.exceptions) {
        const expiresAt = new Date(ex.expires);
        if (expiresAt < now) {
          logger.error(`[EXPIRED DEBT] Exception for ${ex.policyId} on ${ex.targetId} expired on ${ex.expires}.`);
          hasBlockingFailure = true; // Expired tech debt blocks the build
        } else {
          const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (daysLeft <= 7) {
            logger.warn(`[EXPIRING SOON] Exception for ${ex.policyId} on ${ex.targetId} expires in ${daysLeft} days.`);
          }
        }
      }

      logger.blank();
      
      if (hasBlockingFailure) {
        logger.error('Lint failed due to blocking governance violations or expired debt.');
        process.exit(1);
      } else {
        logger.success('Lint passed! Project architecture meets governance constraints.');
      }

    } catch (err) {
      logger.error(`Lint failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
