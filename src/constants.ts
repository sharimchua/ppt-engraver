/**
 * V1 scope constants — fixed design decisions from §5.2 of the design document.
 * These are implementation constants, not configuration.
 */

/** Default pitch anchor when no Knot is specified anywhere in the Tapestry */
export const DEFAULT_DO = 'C4';

/** Default tempo (BPM) — unused in v1 but declared for schema completeness */
export const DEFAULT_TEMPO = 120;

/** Placeholder note duration for v1 (no duration semantics) */
export const DEFAULT_DURATION = 'quarter' as const;

/** Default cross-layer alignment mode */
export const DEFAULT_RESOLUTION_MODE = 'stretch' as const;

/** Layout modes supported in v1 */
export const SUPPORTED_LAYOUT_MODES = ['concatenate'] as const;
export type LayoutMode = typeof SUPPORTED_LAYOUT_MODES[number];

/** Layout modes explicitly rejected in v1 (not yet implemented) */
export const UNSUPPORTED_LAYOUT_MODES = ['equal-period', 'equal-beat', 'custom-map'] as const;

/**
 * Rhythm block-length names — maps solfège cadential chain tokens to onset counts.
 * These are named block lengths (not interval calculations).
 * Source: PPT Uniform Solfège spec, Rhythmic Grammar section.
 */
export const RHYTHM_BLOCK_LENGTHS: Record<string, number> = {
  Dox: 1,
  DoSo: 2,
  DoRe: 3,
  DoLa: 4,
  DoMi: 5,
  DoSi: 6,
  DoFi: 7,
  DoRa: 8,
  // Compound cadential chains:
  DoSoDiSo: 4,
  DoLaDiLa: 8,
  DoReDiRe: 6,
  DoReDiSo: 5,
  DoSoDiRe: 5,
} as const;
