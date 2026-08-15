/**
 * YAML parser/loader: reads .ppt.yaml files and validates against the Tapestry schema.
 */
import { readFileSync } from 'node:fs';
import { load as loadYaml } from 'js-yaml';
import { TapestrySchema, type Tapestry } from '../schema/tapestry.js';

export interface LoadResult {
  /** The validated Tapestry IR */
  tapestry: Tapestry;
  /** Non-fatal warnings emitted during loading */
  warnings: string[];
}

/**
 * Loads and validates a .ppt.yaml file.
 * 
 * @param filePath - Path to the .ppt.yaml file
 * @returns Validated Tapestry IR with any warnings
 * @throws Error if the file cannot be read or fails validation
 */
export function loadTapestryFile(filePath: string): LoadResult {
  const warnings: string[] = [];
  
  // Read file
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read file: ${filePath} — ${(err as Error).message}`);
  }
  
  // Parse YAML
  let parsed: unknown;
  try {
    parsed = loadYaml(raw);
  } catch (err) {
    throw new Error(`Invalid YAML in ${filePath} — ${(err as Error).message}`);
  }
  
  // Validate against schema
  const result = TapestrySchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Schema validation failed for ${filePath}:\n${issues}`);
  }
  
  return { tapestry: result.data, warnings };
}

/**
 * Parses a YAML string directly (useful for testing without file I/O).
 * 
 * @param yamlContent - Raw YAML string
 * @returns Validated Tapestry IR with any warnings
 */
export function parseTapestryYaml(yamlContent: string): LoadResult {
  const warnings: string[] = [];
  
  const parsed = loadYaml(yamlContent);
  const result = TapestrySchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Schema validation failed:\n${issues}`);
  }
  
  return { tapestry: result.data, warnings };
}
