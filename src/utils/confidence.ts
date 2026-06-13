// ============================================================================
// Confidence Scoring Utilities
// ============================================================================
// Calculates confidence scores based on evidence availability and quality.
// Each evidence source contributes a weighted portion to the overall score.
// ============================================================================

import type {
  EvidenceSources,
  ArchitectureModel,
  ConfidenceScores,
  Decision,
} from '../types/index.js';

/** Weights for each evidence source (must sum to 1.0) */
const EVIDENCE_WEIGHTS = {
  git: 0.30,
  sourceCode: 0.30,
  buildFiles: 0.20,
  documentation: 0.20,
};

/**
 * Computes aggregate confidence scores from all available evidence.
 */
export function computeConfidence(
  evidence: EvidenceSources,
  architecture: ArchitectureModel,
  decisions: Decision[],
): ConfidenceScores {
  const evidenceScore = computeEvidenceConfidence(evidence);
  const architectureScore = architecture.confidence;
  const decisionsScore = computeDecisionsConfidence(decisions);

  // Count available evidence sources
  let sourcesAvailable = 0;
  if (evidence.git?.isGitRepo) sourcesAvailable++;
  if (evidence.sourceCode.totalFiles > 0) sourcesAvailable++;
  if (evidence.buildFiles.buildSystems.length > 0) sourcesAvailable++;
  if (evidence.documentation.hasReadme || evidence.documentation.documentationFiles.length > 0) {
    sourcesAvailable++;
  }

  // Overall is weighted average of all sub-scores
  const overall = Math.round(
    evidenceScore * 0.35 +
    architectureScore * 0.35 +
    decisionsScore * 0.10 +
    (sourcesAvailable / 4) * 100 * 0.20
  );

  return {
    overall: clamp(overall, 0, 100),
    architecture: clamp(architectureScore, 0, 100),
    evidence: clamp(evidenceScore, 0, 100),
    workflows: 0, // Not computed in v0.1
    decisions: clamp(decisionsScore, 0, 100),
    evidenceSources: sourcesAvailable,
    maxEvidenceSources: 4,
  };
}

/**
 * Computes confidence from evidence completeness.
 */
function computeEvidenceConfidence(evidence: EvidenceSources): number {
  let score = 0;

  // Git evidence
  if (evidence.git?.isGitRepo) {
    let gitScore = 40; // Base score for having Git
    if (evidence.git.totalCommits > 10) gitScore += 20;
    if (evidence.git.totalCommits > 50) gitScore += 15;
    if (evidence.git.authors.length > 1) gitScore += 10;
    if (evidence.git.tags.length > 0) gitScore += 10;
    if (evidence.git.hotspots.length > 0) gitScore += 5;
    score += Math.min(gitScore, 100) * EVIDENCE_WEIGHTS.git;
  }

  // Source code evidence
  if (evidence.sourceCode.totalFiles > 0) {
    let srcScore = 30;
    if (evidence.sourceCode.totalFiles > 5) srcScore += 20;
    if (evidence.sourceCode.totalFiles > 20) srcScore += 15;
    if (evidence.sourceCode.languages.length > 0) srcScore += 15;
    if (evidence.sourceCode.entryPoints.length > 0) srcScore += 10;
    if (evidence.sourceCode.directoryStructure.length > 0) srcScore += 10;
    score += Math.min(srcScore, 100) * EVIDENCE_WEIGHTS.sourceCode;
  }

  // Build file evidence
  if (evidence.buildFiles.buildSystems.length > 0) {
    let buildScore = 40;
    if (evidence.buildFiles.dependencies.length > 0) buildScore += 25;
    if (evidence.buildFiles.frameworks.length > 0) buildScore += 20;
    if (evidence.buildFiles.scripts.length > 0) buildScore += 15;
    score += Math.min(buildScore, 100) * EVIDENCE_WEIGHTS.buildFiles;
  }

  // Documentation evidence
  if (evidence.documentation.hasReadme) {
    let docScore = 50;
    if (evidence.documentation.readmeSummary) docScore += 15;
    if (evidence.documentation.hasChangelog) docScore += 15;
    if (evidence.documentation.hasContributing) docScore += 10;
    if (evidence.documentation.hasApiDocs) docScore += 10;
    score += Math.min(docScore, 100) * EVIDENCE_WEIGHTS.documentation;
  }

  return Math.round(score);
}

/**
 * Computes confidence based on decision tracking.
 */
function computeDecisionsConfidence(decisions: Decision[]): number {
  if (decisions.length === 0) return 0;
  if (decisions.length >= 5) return 90;
  if (decisions.length >= 3) return 70;
  if (decisions.length >= 1) return 40;
  return 0;
}

/**
 * Clamps a number between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
