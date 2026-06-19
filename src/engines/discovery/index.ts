// ============================================================================
// Discovery Engine — Orchestrator
// ============================================================================
// Coordinates all evidence collectors to build a complete picture of the
// project. Detects the project scenario (A/B/C/D) and runs the appropriate
// collection pipeline.
// ============================================================================

import type {
  DiscoveryResult,
  ProjectScenario,
  EvidenceSources,
  ProjectMindConfig,
} from '../../types/index.js';
import { collectGitEvidence } from './git-collector.js';
import { collectSourceEvidence } from './source-collector.js';
import { collectBuildEvidence } from './build-collector.js';
import { collectDocEvidence } from './doc-collector.js';
import { analyzeImports } from './import-analyzer.js';
import { detectArchitecture } from '../architecture/index.js';
import { detectWorkflows } from '../workflow/index.js';
import { reconstructTimeline } from '../timeline/index.js';
import { detectFeatures } from '../feature/index.js';
import { pluginRegistry } from '../plugin/registry.js';
import { AstService } from './ast/AstService.js';
import { extractSemantics } from './semantics.js';
import { mergeContributions } from '../plugin/merge.js';
import type { PluginContribution, PluginContext } from '../../types/plugin.js';
import type { SemanticEntity } from '../../types/index.js';
import { computeConfidence } from '../../utils/confidence.js';
import { fileExists } from '../../utils/fs.js';
import logger from '../../utils/logger.js';
import ora from 'ora';

/**
 * Runs the full discovery pipeline for a project.
 */
export async function runDiscovery(
  projectPath: string,
  config: ProjectMindConfig,
  cachedSemantics?: SemanticEntity[] | null,
  changedFiles?: string[] | null,
  deletedFiles?: string[] | null
): Promise<DiscoveryResult> {
  const startTime = Date.now();

  logger.section('Evidence Collection');

  // Step 1: Detect project scenario
  const scenario = await detectScenario(projectPath);
  logger.kv('Detected scenario', formatScenario(scenario));

  // Step 2: Collect evidence from all sources in parallel
  logger.step(1, 5, 'Scanning Git history...');
  const gitPromise = collectGitEvidence(projectPath, config.recentCommitCount);

  logger.step(2, 5, 'Analyzing source code...');
  const sourcePromise = collectSourceEvidence(projectPath, config);

  logger.step(3, 5, 'Detecting build systems...');
  const buildPromise = collectBuildEvidence(projectPath, config);

  logger.step(4, 5, 'Scanning documentation...');
  const docPromise = collectDocEvidence(projectPath);

  const [git, sourceCode, buildFiles, documentation] = await Promise.all([
    gitPromise, sourcePromise, buildPromise, docPromise,
  ]);

  logger.step(5, 5, 'Analyzing imports & dependencies...');
  sourceCode.importGraph = await analyzeImports(projectPath, sourceCode.fileCategories);

  const evidence: EvidenceSources = {
    git,
    sourceCode,
    buildFiles,
    documentation,
  };

  logger.step(6, 6, 'Extracting semantics (AST)...');
  const semantics = await extractSemantics(projectPath, sourceCode.fileCategories, cachedSemantics, changedFiles, deletedFiles);

  // Step 3: Run architecture detection
  logger.section('Architecture Analysis');
  const architecture = detectArchitecture(evidence, config.customArchitectureRules);

  // Step 4: Run v0.2 Engines
  logger.section('Project Intelligence (v0.2)');
  
  logger.step(1, 3, 'Detecting workflows...');
  const workflows = await detectWorkflows(projectPath, evidence, architecture);
  
  logger.step(2, 3, 'Reconstructing timeline...');
  const timeline = reconstructTimeline(evidence);
  
  logger.step(3, 3, 'Extracting features...');
  const features = detectFeatures(evidence, architecture);

  // 4. Load Plugins (Skipped in Safe Mode)
  if (!config.safeMode) {
    ora('Loading plugins...').start().succeed('Plugins loaded');
    const detectedFrameworks = evidence.buildFiles.frameworks.map(f => f.name.toLowerCase());
    await pluginRegistry.loadPlugins(projectPath, detectedFrameworks);
  } else {
    ora('Plugins disabled (Safe Mode)').start().succeed();
  }

  // 5. Execute Plugins
  logger.section('Plugin Execution');
  const plugins = pluginRegistry.getPlugins();
  
  const pluginContext: PluginContext = {
    projectPath,
    evidence,
    ast: AstService,
  };

  const contributions: PluginContribution[] = [];
  for (const plugin of plugins) {
    if (plugin.analyze && plugin.capabilities.some(c => ['architecture', 'workflow', 'feature'].includes(c))) {
      try {
        const contribution = await plugin.analyze(pluginContext);
        contributions.push(contribution);
      } catch (err: any) {
        logger.error(`Plugin ${plugin.name} failed during analyze: ${err.message}`);
      }
    }
  }

  // Merge plugin contributions into the core models
  mergeContributions({
    architecture,
    workflows,
    features,
    decisions: [], // Memory decisions are loaded elsewhere, but plugins might contribute some later
  }, contributions);

  // Step 6: Compute confidence scores
  const confidence = computeConfidence(evidence, architecture, []);

  const duration = Date.now() - startTime;

  // Report summary
  logger.section('Discovery Summary');
  logEvidenceSummary(evidence);
  logger.blank();
  logger.confidence('Overall confidence', confidence.overall);
  logger.confidence('Architecture', confidence.architecture);
  logger.confidence('Evidence', confidence.evidence);
  logger.kv('Evidence sources', `${confidence.evidenceSources}/${confidence.maxEvidenceSources}`);
  logger.kv('Duration', `${duration}ms`);

  return {
    scenario,
    evidence,
    architecture,
    confidence,
    workflows,
    timeline,
    features,
    semantics,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Scenario Detection
// ---------------------------------------------------------------------------

async function detectScenario(projectPath: string): Promise<ProjectScenario> {
  const hasProjectMind = await fileExists(`${projectPath}/.project-mind`);
  const hasGit = await fileExists(`${projectPath}/.git`);
  const hasSourceCode = await hasAnySourceFiles(projectPath);

  if (hasProjectMind && hasGit && hasSourceCode) return 'fully-tracked';
  if (hasGit && hasSourceCode) return 'mature';
  if (hasSourceCode) return 'existing';
  return 'brand-new';
}

async function hasAnySourceFiles(projectPath: string): Promise<boolean> {
  const fg = (await import('fast-glob')).default;
  const files = await fg('**/*.{js,ts,py,java,kt,go,rs,cs,rb,php,c,cpp,swift}', {
    cwd: projectPath,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
    onlyFiles: true,
    deep: 3,
    followSymbolicLinks: false
  });
  return files.length > 0;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatScenario(scenario: ProjectScenario): string {
  switch (scenario) {
    case 'brand-new': return 'A — Brand New Project';
    case 'existing': return 'B — Existing Project (no Git)';
    case 'mature': return 'C — Mature Project (with Git)';
    case 'fully-tracked': return 'D — Fully Tracked Project';
  }
}

function logEvidenceSummary(evidence: EvidenceSources): void {
  if (evidence.git?.isGitRepo) {
    logger.kv('Git commits', evidence.git.totalCommits);
    logger.kv('Authors', evidence.git.authors.length);
    logger.kv('Branches', evidence.git.branches.length);
  } else {
    logger.kv('Git', 'not available');
  }

  logger.kv('Source files', evidence.sourceCode.totalFiles);
  logger.kv('Lines of code', evidence.sourceCode.totalLines.toLocaleString());
  logger.kv('Languages', evidence.sourceCode.languages.map(l => l.name).join(', ') || 'none');
  logger.kv('Build systems', evidence.buildFiles.buildSystems.map(b => b.name).join(', ') || 'none');
  logger.kv('Frameworks', evidence.buildFiles.frameworks.map(f => f.name).join(', ') || 'none');
  logger.kv('Has README', evidence.documentation.hasReadme ? 'yes' : 'no');
  logger.kv('License', evidence.documentation.licenseType || 'not detected');
}
