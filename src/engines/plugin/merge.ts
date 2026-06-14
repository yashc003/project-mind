// ============================================================================
// Plugin Merge Engine
// ============================================================================

import type {
  ArchitectureModel,
  Workflow,
  Feature,
  Decision,
  GraphNode,
  GraphEdge,
} from '../../types/index.js';
import type { PluginContribution } from '../../types/plugin.js';
import logger from '../../utils/logger.js';

export interface MergeTarget {
  architecture: ArchitectureModel;
  workflows: Workflow[];
  features: Feature[];
  decisions: Decision[];
  graphNodes?: GraphNode[];
  graphEdges?: GraphEdge[];
}

/**
 * Merges an array of PluginContributions into the core system state.
 * Assumes contributions are ordered by Plugin Priority.
 */
export function mergeContributions(target: MergeTarget, contributions: PluginContribution[]): MergeTarget {
  for (const contribution of contributions) {
    logger.info(`Merging contribution from: ${contribution.source}`);

    // Merge Components into Architecture
    if (contribution.components && contribution.components.length > 0) {
      const allComponents = target.architecture.components || [];
      for (const newComp of contribution.components) {
        // Match by name OR if the existing component already claims one of these files
        const existingComp = allComponents.find(c => 
          c.name === newComp.name || 
          c.files.some(f => newComp.files.includes(f))
        );
        if (existingComp) {
          // Merge files
          for (const file of newComp.files) {
            if (!existingComp.files.includes(file)) {
              existingComp.files.push(file);
            }
          }
          // Merge endpoints
          if (newComp.endpoints && newComp.endpoints.length > 0) {
            existingComp.endpoints = existingComp.endpoints || [];
            for (const ep of newComp.endpoints) {
              if (!existingComp.endpoints.includes(ep)) {
                existingComp.endpoints.push(ep);
              }
            }
          }
          // Optionally upgrade confidence
          if (newComp.confidence > existingComp.confidence) {
            existingComp.confidence = newComp.confidence;
          }
        } else {
          allComponents.push(newComp);
        }
      }
      target.architecture.components = allComponents;
    }

    // Merge Workflows
    if (contribution.workflows && contribution.workflows.length > 0) {
      for (const newWf of contribution.workflows) {
        // If a plugin provides a rich workflow, remove any generic core workflows for the same file
        target.workflows = target.workflows.filter(
          w => !(w.entryPoint === newWf.entryPoint && w.name.includes('API Route') && !newWf.name.includes('API Route'))
        );

        if (!target.workflows.some(w => w.name === newWf.name && w.entryPoint === newWf.entryPoint)) {
          target.workflows.push(newWf);
        }
      }
    }

    // Merge Features
    if (contribution.features && contribution.features.length > 0) {
      for (const newFeature of contribution.features) {
        if (!target.features.some(f => f.name === newFeature.name)) {
          target.features.push(newFeature);
        }
      }
    }

    // Merge Decisions
    if (contribution.decisions && contribution.decisions.length > 0) {
      for (const newDecision of contribution.decisions) {
        // For decisions, we check description to avoid duplicates
        if (!target.decisions.some(d => d.description === newDecision.description)) {
          target.decisions.push(newDecision);
        }
      }
    }

    // Merge Custom Graph Nodes
    if (contribution.graphNodes && contribution.graphNodes.length > 0) {
      target.graphNodes = target.graphNodes || [];
      for (const newNode of contribution.graphNodes) {
        if (!target.graphNodes.some(n => n.id === newNode.id)) {
          target.graphNodes.push(newNode);
        }
      }
    }

    // Merge Custom Graph Edges
    if (contribution.graphEdges && contribution.graphEdges.length > 0) {
      target.graphEdges = target.graphEdges || [];
      for (const newEdge of contribution.graphEdges) {
        if (!target.graphEdges.some(e => e.source === newEdge.source && e.target === newEdge.target && e.relation === newEdge.relation)) {
          target.graphEdges.push(newEdge);
        }
      }
    }
  }

  return target;
}
