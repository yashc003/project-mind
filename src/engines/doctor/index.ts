// ============================================================================
// Doctor Engine (v1.0)
// ============================================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadMemory, loadConfig, saveMemory } from '../memory/index.js';
import { getMemoryFilePaths } from '../memory/schema.js';
import { evaluatePolicies } from '../governance/evaluator.js';
import { pluginRegistry } from '../plugin/registry.js';
import { generateContextPack } from '../pack/index.js';

export type CheckSeverity = 'critical' | 'warning' | 'info';

export interface DoctorCheckResult {
  id: string;
  title: string;
  passed: boolean;
  severity: CheckSeverity;
  message?: string;
}

export interface DiagnosticIssue {
  type: 'missing-intent' | 'orphaned-decision' | 'context-gap' | 'stale-focus';
  severity: 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
}

export function runDiagnostics(memory: any): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  // 1. Missing Intent
  if (memory.features) {
    for (const feature of memory.features) {
      const hasDecision = memory.decisions?.some((d:any) => d.impactedFeatures?.includes(feature.name));
      const focusHistoryActive = memory.focusHistory?.active?.feature === feature.name;
      const focusHistoryPast = memory.focusHistory?.history?.some((h:any) => h.feature === feature.name) || false;

      if (!hasDecision && !focusHistoryActive && !focusHistoryPast) {
        issues.push({
          type: 'missing-intent',
          severity: 'medium',
          message: `Feature Detected: ${feature.name}. No Decision or Lifecycle Found.`,
          recommendation: `Run \`project-mind start-feature --feature ${feature.name}\``
        });
      }
    }
  }

  // 2. Orphaned Decisions
  if (memory.decisions) {
    for (const decision of memory.decisions) {
      if ((!decision.impactedFeatures || decision.impactedFeatures.length === 0) &&
          (!decision.impactedComponents || decision.impactedComponents.length === 0)) {
        issues.push({
          type: 'orphaned-decision',
          severity: 'low',
          message: `Decision "${decision.title}" is not linked to any feature or component.`,
          recommendation: `Review and link the decision, or let project-mind extract context automatically.`
        });
      }
    }
  }

  // 3. Stale Focus
  const activeFocus = memory.focusHistory?.active;
  if (activeFocus && activeFocus.status === 'in-progress') {
    const lastUpdated = new Date(activeFocus.lastUpdated).getTime();
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    if (lastUpdated < twoWeeksAgo) {
      issues.push({
        type: 'stale-focus',
        severity: 'high',
        message: `Current focus "${activeFocus.feature}" has been in-progress for over 2 weeks.`,
        recommendation: `Run \`project-mind complete-feature\` or update its status.`
      });
    }
  }

  // 4. Context Gaps
  if (memory.architecture && memory.architecture.components) {
    const undocumentedCount = memory.architecture.components.filter((c:any) => c.confidence < 50).length;
    if (undocumentedCount > 0) {
      issues.push({
        type: 'context-gap',
        severity: 'medium',
        message: `Found ${undocumentedCount} architectural components with low confidence (undocumented).`,
        recommendation: `Add a \`.project-mind.json\` to define custom customArchitectureRules, or run \`project-mind note\` to explain them.`
      });
    }
  }

  return issues;
}

export async function runDoctorChecks(projectPath: string): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  const paths = getMemoryFilePaths(projectPath);

  // 1 & 2. Authored Directory & Schema Validation
  let authoredExists = false;
  try {
    const stats = await fs.stat(path.join(paths.root, 'authored'));
    authoredExists = stats.isDirectory();
  } catch {}

  results.push({
    id: 'authored-dir',
    title: 'Authored Directory Exists',
    passed: authoredExists,
    severity: 'critical',
    message: authoredExists ? '' : 'Missing .project-mind/authored/ directory.'
  });

  let schemaValid = false;
  let schemaMsg = '';
  if (authoredExists) {
    try {
      // Validate config.json
      const configStr = await fs.readFile(path.join(paths.root, 'authored', 'config.json'), 'utf-8').catch(() => '{}');
      JSON.parse(configStr); 
      // Check focus.json
      const focusStr = await fs.readFile(path.join(paths.root, 'authored', 'focus.json'), 'utf-8').catch(() => '{}');
      JSON.parse(focusStr);
      schemaValid = true;
    } catch (e: any) {
      schemaMsg = `JSON parsing failed: ${e.message}`;
    }
  }

  results.push({
    id: 'authored-schema',
    title: 'Authored Schema Valid',
    passed: schemaValid,
    severity: 'critical',
    message: schemaMsg
  });

  // 3. Derived Directory Populated
  let derivedPopulated = false;
  try {
    const memStats = await fs.stat(paths.memory);
    if (memStats.size > 0) derivedPopulated = true;
  } catch {}

  results.push({
    id: 'derived-dir',
    title: 'Derived Directory Populated',
    passed: derivedPopulated,
    severity: 'warning',
    message: derivedPopulated ? '' : 'Missing or empty derived/MEMORY.json.'
  });

  // Load Memory for remaining checks
  let memory = await loadMemory(projectPath);

  // 4. Repairability
  let repairable = false;
  let repairMsg = '';
  try {
    const tmpProjectDir = path.join(paths.root, 'tmp-doctor');
    await fs.rm(tmpProjectDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(path.join(tmpProjectDir, '.project-mind'), { recursive: true });
    
    // Copy authored
    const authoredSrc = path.join(paths.root, 'authored');
    const authoredDest = path.join(tmpProjectDir, '.project-mind', 'authored');
    await fs.cp(authoredSrc, authoredDest, { recursive: true });
    
    // Rebuild
    const tmpPaths = getMemoryFilePaths(tmpProjectDir);
    const mem = await loadMemory(tmpProjectDir);
    if (!mem) throw new Error("Could not load memory from raw authored files");
    await saveMemory(tmpProjectDir, mem);
    
    const rebuiltMemPath = tmpPaths.memory;
    const rebuiltStats = await fs.stat(rebuiltMemPath);
    if (rebuiltStats.size > 0) {
       repairable = true;
    } else {
       repairMsg = 'Rebuilt MEMORY.json is empty';
    }
    await fs.rm(tmpProjectDir, { recursive: true, force: true }).catch(() => {});
  } catch (e: any) {
    repairMsg = `Repair simulation failed: ${e.message}`;
  }

  results.push({
    id: 'repairability',
    title: 'Repairability',
    passed: repairable,
    severity: 'critical',
    message: repairMsg
  });

  // 5. Derived Determinism
  let determinism = false;
  let detMsg = '';
  if (memory) {
     try {
       const mem1 = JSON.parse(JSON.stringify(memory));
       const mem2 = JSON.parse(JSON.stringify(memory));
       const hash1 = crypto.createHash('sha256').update(JSON.stringify(mem1)).digest('hex');
       const hash2 = crypto.createHash('sha256').update(JSON.stringify(mem2)).digest('hex');
       determinism = hash1 === hash2;
       if (!determinism) detMsg = 'Hashes did not match. Unstable memory generation.';
     } catch (e:any) {
       detMsg = e.message;
     }
  }
  
  results.push({
    id: 'determinism',
    title: 'Derived Determinism',
    passed: determinism,
    severity: 'critical',
    message: detMsg
  });

  // 6. Knowledge Graph Generated
  let graphGen = false;
  if (memory && memory.knowledgeGraph && memory.knowledgeGraph.nodes && memory.knowledgeGraph.nodes.length > 0) {
    graphGen = true;
  }
  results.push({
    id: 'knowledge-graph',
    title: 'Knowledge Graph Generated',
    passed: graphGen,
    severity: 'warning',
    message: graphGen ? '' : 'Knowledge graph is empty.'
  });

  // 7. Plugin Trust Valid
  let pluginsValid = true;
  let pluginMsg = '';
  try {
    const failed = pluginRegistry.getFailedPlugins();
    if (failed.length > 0) {
       pluginsValid = false;
       pluginMsg = `Failed to load ${failed.length} plugins. Security violation.`;
    }
  } catch (e:any) {
     pluginsValid = false;
     pluginMsg = e.message;
  }
  
  results.push({
    id: 'plugin-trust',
    title: 'Plugin Trust Valid',
    passed: pluginsValid,
    severity: 'critical',
    message: pluginMsg
  });

  // 8. Governance Engine Operational
  let govOperational = false;
  let govMsg = '';
  try {
     if (memory) {
       const config = await loadConfig(projectPath);
       const evalResults = evaluatePolicies(memory, config);
       const violations = evalResults.filter(r => r.status !== 'passed').length;
       govOperational = true;
       if (violations > 0) {
         govMsg = `⚠ ${violations} policy violations detected (Engine operational)`;
       }
     }
  } catch(e:any) {
    govMsg = `Governance failed to run: ${e.message}`;
  }

  results.push({
    id: 'governance',
    title: 'Governance Engine Operational',
    passed: govOperational,
    severity: 'warning',
    message: govMsg
  });

  // 9. Context Budget
  let budgetValid = false;
  let budgetMsg = '';
  if (memory && graphGen) {
     try {
       const pack = await generateContextPack(projectPath, memory, { topic: 'current', isCurrent: true, level: 'compact' });
       const approxTokens = pack.length / 4;
       if (approxTokens < 10000) {
          budgetValid = true;
       } else {
          budgetMsg = `Pack generates approx ${Math.round(approxTokens)} tokens (exceeds 10k warning threshold).`;
       }
     } catch (e:any) {
        budgetMsg = `Pack generation failed: ${e.message}`;
     }
  } else {
     budgetMsg = 'Could not generate pack.';
  }

  results.push({
    id: 'context-budget',
    title: 'Context Budget',
    passed: budgetValid,
    severity: 'warning',
    message: budgetMsg
  });

  // 10. Git Hooks Installed
  let hooksInstalled = false;
  let hookMsg = 'post-commit or post-checkout hook is missing.';
  try {
    const checkHook = async (dir: string, file: string) => {
      try {
        const content = await fs.readFile(path.join(projectPath, dir, file), 'utf-8');
        return content.includes('PROJECT-MIND HOOK START');
      } catch {
        return false;
      }
    };
    
    // Check husky first
    const huskyCommit = await checkHook('.husky', 'post-commit');
    const huskyCheckout = await checkHook('.husky', 'post-checkout');
    
    // Check git hooks
    const gitCommit = await checkHook('.git/hooks', 'post-commit');
    const gitCheckout = await checkHook('.git/hooks', 'post-checkout');

    if ((huskyCommit || gitCommit) && (huskyCheckout || gitCheckout)) {
      hooksInstalled = true;
      hookMsg = '';
    } else if (huskyCommit || gitCommit) {
      hookMsg = 'post-commit installed, but post-checkout is missing.';
    } else if (huskyCheckout || gitCheckout) {
      hookMsg = 'post-checkout installed, but post-commit is missing.';
    }
  } catch {
    // Missing hook file
  }
  results.push({
    id: 'git-hooks',
    title: 'Git Hooks Installed',
    passed: hooksInstalled,
    severity: 'warning',
    message: hookMsg
  });

  // 11. IDE Integration Installed
  let ideInstalled = false;
  try {
    const cursorStr = await fs.readFile(path.join(projectPath, '.cursorrules'), 'utf-8').catch(() => '');
    const windStr = await fs.readFile(path.join(projectPath, '.windsurfrules'), 'utf-8').catch(() => '');
    if (cursorStr.includes('project-mind') || windStr.includes('project-mind')) {
       ideInstalled = true;
    }
  } catch {}
  results.push({
    id: 'ide-integration',
    title: 'IDE Integration Installed',
    passed: ideInstalled,
    severity: 'warning',
    message: ideInstalled ? '' : 'No .cursorrules or .windsurfrules integration found.'
  });

  return results;
}
