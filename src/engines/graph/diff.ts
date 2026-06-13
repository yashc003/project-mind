import type { ProjectMemory, DiffDelta, Component, ComponentDependency, Feature, Decision } from '../../types/index.js';

/**
 * Compares two ProjectMemory states and computes the structural delta.
 * Useful for providing AI agents with context on what changed since their last run.
 */
export function compareMemory(oldMem: ProjectMemory | null, newMem: ProjectMemory): DiffDelta {
  const delta: DiffDelta = {
    components: { added: [], removed: [], modified: [] },
    dependencies: { added: [], removed: [] },
    features: { started: [], completed: [] },
    decisions: { added: [] },
    hasChanges: false,
  };

  const newFeatures = newMem.features || [];
  const oldFeatures = oldMem?.features || [];

  if (!oldMem) {
    // If there is no previous memory, everything is considered newly added.
    delta.components.added = newMem.architecture.components;
    delta.dependencies.added = newMem.architecture.componentDependencies;
    delta.features.started = newFeatures.filter(f => f.status === 'active');
    delta.features.completed = newFeatures.filter(f => f.status === 'stale');
    delta.decisions.added = newMem.decisions;
    delta.hasChanges = true;
    return delta;
  }

  // --- 1. Components ---
  const oldComponents = new Map(oldMem.architecture.components.map(c => [c.name, c]));
  const newComponents = new Map(newMem.architecture.components.map(c => [c.name, c]));

  for (const newComp of newMem.architecture.components) {
    const oldComp = oldComponents.get(newComp.name);
    if (!oldComp) {
      delta.components.added.push(newComp);
    } else {
      // Check for modification (type change, directory change)
      if (newComp.type !== oldComp.type || newComp.directory !== oldComp.directory) {
        delta.components.modified.push(newComp);
      }
    }
  }

  for (const oldComp of oldMem.architecture.components) {
    if (!newComponents.has(oldComp.name)) {
      delta.components.removed.push(oldComp);
    }
  }

  // --- 2. Dependencies ---
  const depKey = (d: ComponentDependency) => `${d.from}->${d.to}:${d.type}`;
  const oldDeps = new Set(oldMem.architecture.componentDependencies.map(depKey));
  const newDeps = new Set(newMem.architecture.componentDependencies.map(depKey));

  for (const newDep of newMem.architecture.componentDependencies) {
    if (!oldDeps.has(depKey(newDep))) {
      delta.dependencies.added.push(newDep);
    }
  }

  for (const oldDep of oldMem.architecture.componentDependencies) {
    if (!newDeps.has(depKey(oldDep))) {
      delta.dependencies.removed.push(oldDep);
    }
  }

  // --- 3. Features ---
  const oldFeaturesMap = new Map(oldFeatures.map(f => [f.name, f]));

  for (const newF of newFeatures) {
    const oldF = oldFeaturesMap.get(newF.name);
    if (!oldF && newF.status === 'active') {
      delta.features.started.push(newF);
    } else if (oldF && oldF.status !== 'active' && newF.status === 'active') {
      delta.features.started.push(newF);
    } else if (oldF && oldF.status !== 'stale' && newF.status === 'stale') {
      delta.features.completed.push(newF);
    } else if (!oldF && newF.status === 'stale') {
      delta.features.completed.push(newF);
    }
  }

  // --- 4. Decisions ---
  const oldDecisions = new Set(oldMem.decisions.map(d => d.title));
  for (const d of newMem.decisions) {
    if (!oldDecisions.has(d.title)) {
      delta.decisions.added.push(d);
    }
  }

  // Determine if any changes occurred
  delta.hasChanges =
    delta.components.added.length > 0 ||
    delta.components.removed.length > 0 ||
    delta.components.modified.length > 0 ||
    delta.dependencies.added.length > 0 ||
    delta.dependencies.removed.length > 0 ||
    delta.features.started.length > 0 ||
    delta.features.completed.length > 0 ||
    delta.decisions.added.length > 0;

  return delta;
}
