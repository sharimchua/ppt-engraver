/**
 * Top-level resolution orchestrator.
 * 
 * Provides the main public API for resolving Tapestry source
 * (either from a file or from a pre-parsed IR) into an onset stream.
 */
import type { OnsetStream } from '../schema/onset.js';
import type { Tapestry } from '../schema/tapestry.js';
import { loadTapestryFile, parseTapestryYaml } from '../parser/yaml-loader.js';
import { resolveTapestry, type ResolutionResult } from './graph.js';

/**
 * Resolves a .ppt.yaml file into an onset stream.
 * 
 * Full pipeline: file I/O → YAML parse → schema validation → resolution.
 * 
 * @param filePath - Path to the .ppt.yaml file
 * @returns Resolved onset stream + accumulated warnings
 */
export function resolveFile(filePath: string, selectedKnotId?: string): ResolutionResult {
  const { tapestry, warnings: loadWarnings } = loadTapestryFile(filePath);
  const { onsets, warnings: resolveWarnings, knot, availableKnots, selectedKnotId: resolvedKnotId } = resolveTapestry(tapestry, selectedKnotId);
  
  return {
    onsets,
    warnings: [...loadWarnings, ...resolveWarnings],
    knot,
    availableKnots,
    selectedKnotId: resolvedKnotId,
  };
}

/**
 * Resolves a YAML string into an onset stream.
 * 
 * Useful for testing and in-browser use (no file I/O).
 * 
 * @param yamlContent - Raw YAML string of a Tapestry
 * @param selectedKnotId - Optional ID of the knot to resolve
 * @returns Resolved onset stream + accumulated warnings
 */
export function resolveYaml(yamlContent: string, selectedKnotId?: string): ResolutionResult {
  const { tapestry, warnings: loadWarnings } = parseTapestryYaml(yamlContent);
  const { onsets, warnings: resolveWarnings, knot, availableKnots, selectedKnotId: resolvedKnotId } = resolveTapestry(tapestry, selectedKnotId);
  
  return {
    onsets,
    warnings: [...loadWarnings, ...resolveWarnings],
    knot,
    availableKnots,
    selectedKnotId: resolvedKnotId,
  };
}


// Re-export for convenience
export type { ResolutionResult } from './graph.js';
export type { OnsetStream, Onset } from '../schema/onset.js';
