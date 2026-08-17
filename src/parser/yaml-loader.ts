/**
 * YAML parser/loader: reads .ppt.yaml files and validates against the Tapestry schema.
 */
import { readFileSync } from 'node:fs';
import { load as loadYaml } from 'js-yaml';
import type { ZodError, ZodIssue } from 'zod';
import { TapestrySchema, type Tapestry } from '../schema/tapestry.js';

export interface LoadResult {
  /** The validated Tapestry IR */
  tapestry: Tapestry;
  /** Non-fatal warnings emitted during loading */
  warnings: string[];
}

/**
 * Formats a single path segment array into readable dot/bracket notation.
 * e.g. ['tapestry', 'weaves', 'song', 'children', 0, 'coil', 'melody', 2]
 * -> "tapestry.weaves.song.children[0].coil.melody[2]"
 */
export function formatIssuePath(path: (string | number)[]): string {
  if (path.length === 0) return 'root';
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    return acc ? `${acc}.${segment}` : String(segment);
  }, '');
}

/**
 * Recursively extracts and formats human-readable error messages from Zod issues.
 */
export function extractIssueMessages(issues: ZodIssue[]): string[] {
  const messages: string[] = [];

  for (const issue of issues) {
    const pathStr = formatIssuePath(issue.path);

    if (issue.code === 'invalid_union') {
      // Find deeper/more specific errors from union branches
      const innerIssues: ZodIssue[] = [];
      for (const unionError of issue.unionErrors) {
        innerIssues.push(...unionError.issues);
      }

      // Filter to issues that have a deeper path than the union container itself
      const specificIssues = innerIssues.filter(i => i.path.length > issue.path.length);
      if (specificIssues.length > 0) {
        messages.push(...extractIssueMessages(specificIssues));
      } else {
        // Collect messages from all branches
        const uniqueMessages = Array.from(new Set(innerIssues.map(i => i.message)));
        messages.push(
          `• ${pathStr}: Invalid structure or value. Expected valid union choice (${uniqueMessages.join(' OR ')})`
        );
      }
    } else if (issue.code === 'invalid_type') {
      if (issue.received === 'undefined') {
        messages.push(`• ${pathStr}: Missing required property (expected ${issue.expected})`);
      } else {
        messages.push(`• ${pathStr}: Expected ${issue.expected}, but received ${issue.received}`);
      }
    } else if (issue.code === 'invalid_enum_value') {
      const allowed = issue.options.map(o => `"${o}"`).join(', ');
      messages.push(
        `• ${pathStr}: Invalid value "${issue.received}". Allowed values: ${allowed}`
      );
    } else if (issue.code === 'unrecognized_keys') {
      const keys = issue.keys.map(k => `"${k}"`).join(', ');
      messages.push(`• ${pathStr}: Unrecognized property ${keys}`);
    } else if (issue.code === 'too_small') {
      messages.push(
        `• ${pathStr}: Cannot be empty (must contain at least ${issue.minimum} item${issue.minimum === 1 ? '' : 's'})`
      );
    } else {
      messages.push(`• ${pathStr}: ${issue.message}`);
    }
  }

  // Deduplicate while preserving order
  return Array.from(new Set(messages));
}

/**
 * Formats a ZodError into a clear, multi-line error report.
 */
export function formatSchemaValidationErrors(error: ZodError, filePath?: string): string {
  const fileHeader = filePath
    ? `Failed to validate Tapestry file "${filePath}":`
    : 'Schema validation failed:';
  const issueMessages = extractIssueMessages(error.issues);
  
  return `${fileHeader}\n\n` + issueMessages.map(msg => `  ${msg}`).join('\n');
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
    throw new Error(formatSchemaValidationErrors(result.error, filePath));
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
    throw new Error(formatSchemaValidationErrors(result.error));
  }
  
  return { tapestry: result.data, warnings };
}
