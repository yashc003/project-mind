// ============================================================================
// Timeline Engine — Project Evolution
// ============================================================================
// Reconstructs the chronological history of the project by clustering Git
// commits into logical events and mapping milestones (tags/releases).
// ============================================================================

import type { EvidenceSources, TimelineEvent, TimelineEventType } from '../../types/index.js';

export function reconstructTimeline(evidence: EvidenceSources): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const git = evidence.git;

  if (!git) {
    return events;
  }

  // 1. Add initialization event
  if (git.firstCommitDate) {
    events.push({
      date: git.firstCommitDate,
      type: 'milestone',
      title: 'Project Initialized',
      description: 'First commit to the repository',
      files: [],
      confidence: 100,
    });
  }

  // 2. Map tags to release events
  for (const tag of git.tags) {
    // We don't have the exact date of tags in the current GitEvidence structure,
    // so we approximate it using latestCommitDate if it's recent, or skip.
    // In a full implementation, we'd query Git for the tag date.
    if (tag) {
      events.push({
        date: git.latestCommitDate || new Date().toISOString(),
        type: 'release',
        title: `Release ${tag}`,
        description: `Version ${tag} was tagged`,
        files: [],
        confidence: 90,
      });
    }
  }

  // 3. Cluster recent commits into feature/bugfix/refactor events
  if (git.recentCommits && git.recentCommits.length > 0) {
    // Simple clustering by day
    const clusters = new Map<string, typeof git.recentCommits>();

    for (const commit of git.recentCommits) {
      const day = commit.date.split('T')[0];
      if (!clusters.has(day)) clusters.set(day, []);
      clusters.get(day)!.push(commit);
    }

    for (const [day, commits] of clusters.entries()) {
      const type = determineDominantEventType(commits.map(c => c.message));
      const title = synthesizeTitle(commits.map(c => c.message), type);
      
      events.push({
        date: commits[0].date, // Use the time of the most recent commit in the cluster
        type,
        title,
        description: `${commits.length} commits by ${new Set(commits.map(c => c.author)).size} authors.`,
        files: [], // In full version, we'd list the modified files here
        confidence: 70,
      });
    }
  }

  // Sort chronologically (oldest first)
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Deduplicate dates for a cleaner timeline
  const uniqueEvents: TimelineEvent[] = [];
  const seenDates = new Set<string>();
  
  for (const event of events) {
    const day = event.date.split('T')[0];
    const key = `${day}-${event.type}-${event.title}`;
    if (!seenDates.has(key)) {
      seenDates.add(key);
      uniqueEvents.push(event);
    }
  }

  return uniqueEvents;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determineDominantEventType(messages: string[]): TimelineEventType {
  let featureCount = 0;
  let bugfixCount = 0;
  let refactorCount = 0;

  for (const msg of messages) {
    const lower = msg.toLowerCase();
    if (lower.includes('feat') || lower.includes('add') || lower.includes('implement')) featureCount++;
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('patch')) bugfixCount++;
    if (lower.includes('refactor') || lower.includes('clean') || lower.includes('chore')) refactorCount++;
  }

  if (featureCount >= bugfixCount && featureCount >= refactorCount) return 'feature';
  if (bugfixCount >= featureCount && bugfixCount >= refactorCount) return 'bugfix';
  return 'refactor';
}

function synthesizeTitle(messages: string[], type: TimelineEventType): string {
  if (messages.length === 1) {
    // Clean up convention prefixes like "feat: ", "fix(core): "
    return messages[0].replace(/^(feat|fix|refactor|chore|docs|test|style|perf)(\([^)]+\))?:\s*/i, '');
  }

  const count = messages.length;
  switch (type) {
    case 'feature': return `Added new features (${count} commits)`;
    case 'bugfix': return `Fixed bugs (${count} commits)`;
    case 'refactor': return `Code refactoring (${count} commits)`;
    default: return `Updates (${count} commits)`;
  }
}
