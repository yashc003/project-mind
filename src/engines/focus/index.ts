// ============================================================================
// Focus Engine
// ============================================================================

import type { ProjectMemory, CurrentFocus } from '../../types/index.js';
import crypto from 'node:crypto';

export function updateFocusStatus(memory: ProjectMemory, newStatus: CurrentFocus['status']) {
  if (memory.focusHistory.active) {
    memory.focusHistory.active.status = newStatus;
    memory.focusHistory.active.lastUpdated = new Date().toISOString();
  }
}

export function addBlocker(memory: ProjectMemory, reason: string) {
  if (memory.focusHistory.active) {
    memory.focusHistory.active.blockers.push(reason);
    memory.focusHistory.active.lastUpdated = new Date().toISOString();
  }
}

export function removeBlocker(memory: ProjectMemory, index: number) {
  if (memory.focusHistory.active && index >= 0 && index < memory.focusHistory.active.blockers.length) {
    memory.focusHistory.active.blockers.splice(index, 1);
    memory.focusHistory.active.lastUpdated = new Date().toISOString();
  }
}

export function addSubTask(memory: ProjectMemory, description: string) {
  if (memory.focusHistory.active) {
    memory.focusHistory.active.subTasks.push({
      id: crypto.randomBytes(4).toString('hex'),
      description,
      status: 'todo',
      createdAt: new Date().toISOString(),
    });
    memory.focusHistory.active.lastUpdated = new Date().toISOString();
  }
}

export function completeSubTask(memory: ProjectMemory, subTaskId: string): boolean {
  if (memory.focusHistory.active) {
    const task = memory.focusHistory.active.subTasks.find(t => t.id === subTaskId);
    if (task) {
      task.status = 'done';
      task.completedAt = new Date().toISOString();
      memory.focusHistory.active.lastUpdated = new Date().toISOString();
      return true;
    }
  }
  return false;
}

export function computeProgress(memory: ProjectMemory): { completed: number; total: number; percentage: number } {
  const active = memory.focusHistory.active;
  if (!active || active.subTasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
  
  const completed = active.subTasks.filter(t => t.status === 'done').length;
  const total = active.subTasks.length;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100)
  };
}

export function detectScopeDrift(memory: ProjectMemory): { hasDrift: boolean; extraModules: string[] } {
  const active = memory.focusHistory.active;
  if (!active) return { hasDrift: false, extraModules: [] };

  const expected = new Set(active.expectedModules.map(m => m.toLowerCase()));
  const extraModules: string[] = [];

  for (const actual of active.actualModules) {
    let matched = false;
    for (const exp of expected) {
      if (actual.toLowerCase().includes(exp)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      extraModules.push(actual);
    }
  }

  // Deduplicate and filter out non-source files (optional but good practice)
  const uniqueExtras = Array.from(new Set(extraModules));
  
  return {
    hasDrift: uniqueExtras.length > 0,
    extraModules: uniqueExtras,
  };
}

export function linkCommit(memory: ProjectMemory, hash: string) {
  if (memory.focusHistory.active && !memory.focusHistory.active.linkedCommits.includes(hash)) {
    memory.focusHistory.active.linkedCommits.push(hash);
    memory.focusHistory.active.lastUpdated = new Date().toISOString();
  }
}
