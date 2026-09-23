import { resolveMetricGrammar } from '../solfege/rhythm.js';

export interface AbcMeterInfo {
  /** ABC time signature string for M: header, e.g. "3/4", "4/4", "6/8" */
  meterString: string;
  /** Length of one measure in quarter-note beats (1.0 = quarter note) */
  beatsPerMeasure: number;
}

/**
 * Derives both the ABC time signature string (e.g. "3/4", "4/4", "6/8")
 * and the measure duration in quarter-note beats.
 *
 * Supports:
 * - Standard time signature strings: "3/4", "4/4", "6/8", "2/4", "5/4", "7/8"
 * - Fraction pairs: [3, 4], [6, 8]
 * - PPT Solfège metric pulse specifications: "DoRe" (3/4), "DoSo" (2/4), "DoLa" (4/4),
 *   "DoMi" (5/4), "DoSi" (6/8), "DoReDiRe" (6/8), "DoReDiSo" (5/4), ["Dox", "Re", "So"] (3/4)
 */
export function deriveAbcMeter(meter?: unknown): AbcMeterInfo {
  if (!meter) {
    return { meterString: '4/4', beatsPerMeasure: 4.0 };
  }

  // 1. Array of two numbers: [3, 4], [6, 8]
  if (Array.isArray(meter) && meter.length === 2 && !isNaN(Number(meter[0])) && !isNaN(Number(meter[1]))) {
    const num = Number(meter[0]);
    const den = Number(meter[1]);
    const beats = den > 0 ? (num / den) * 4.0 : 4.0;
    return { meterString: `${num}/${den}`, beatsPerMeasure: beats };
  }

  // 2. Direct fraction string: "3/4", "6/8", "5/4", "7/8", "2/4"
  if (typeof meter === 'string') {
    const trimmed = meter.trim();
    const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) {
      const num = parseInt(fracMatch[1], 10);
      const den = parseInt(fracMatch[2], 10);
      const beats = den > 0 ? (num / den) * 4.0 : 4.0;
      return { meterString: trimmed, beatsPerMeasure: beats };
    }
  }

  // 3. PPT Solfège pulse grammar (e.g. "DoRe", "DoSo", "DoLa", "DoMi", "DoSi", "DoReDiRe", ["Dox", "Re", "So"])
  try {
    const grammar = resolveMetricGrammar(meter as any);
    if (grammar && grammar.timeSignature) {
      const fracMatch = grammar.timeSignature.match(/^(\d+)\/(\d+)$/);
      let beats = grammar.totalBeats;
      if (fracMatch) {
        const num = parseInt(fracMatch[1], 10);
        const den = parseInt(fracMatch[2], 10);
        if (den > 0) beats = (num / den) * 4.0;
      }
      return { meterString: grammar.timeSignature, beatsPerMeasure: beats };
    }
  } catch {
    // fallback
  }

  // 4. Space/comma separated list of tokens or numbers
  if (typeof meter === 'string') {
    const tokens = meter.trim().split(/[\s,]+/).filter(Boolean);
    if (tokens.length > 1) {
      return { meterString: `${tokens.length}/4`, beatsPerMeasure: tokens.length };
    }
  }

  if (Array.isArray(meter) && meter.length > 0) {
    return { meterString: `${meter.length}/4`, beatsPerMeasure: meter.length };
  }

  return { meterString: '4/4', beatsPerMeasure: 4.0 };
}

/**
 * Parses a meter or pulse specification (e.g. "4/4", "3/4", "6/8", "DoRe", [4, 4], ["Dox", "Re", "So"])
 * into beats per measure in quarter-note beats (1.0 = quarter note).
 */
export function parseMeterToBeats(meter?: unknown): number {
  return deriveAbcMeter(meter).beatsPerMeasure;
}

/**
 * Converts a note duration in quarter-note beats to an ABC duration suffix,
 * assuming the default unit note length is L: 1/8.
 * 
 * In L: 1/8:
 * - 0.5 beat (eighth note) = 1 unit -> ""
 * - 1.0 beat (quarter note) = 2 units -> "2"
 * - 2.0 beats (half note) = 4 units -> "4"
 * - 3.0 beats (dotted half) = 6 units -> "6"
 * - 4.0 beats (whole note) = 8 units -> "8"
 * - 0.25 beat (sixteenth note) = 0.5 unit -> "/2"
 * - 0.125 beat (32nd note) = 0.25 unit -> "/4"
 * - 1.5 beats (dotted quarter) = 3 units -> "3"
 * - 0.75 beat (dotted eighth) = 1.5 units -> "3/2"
 * - 1/3 beat (triplet eighth) = 2/3 units -> "2/3"
 * - 2/3 beat (triplet quarter) = 4/3 units -> "4/3"
 * 
 * @param durationBeats - Duration in quarter beats
 * @param unitDenominator - Unit note length denominator (default: 8 for 1/8)
 */
export function beatsToAbcDuration(durationBeats: number, unitDenominator = 8): string {
  if (durationBeats <= 0) return '';

  // Multiply beats by (unitDenominator / 4)
  const multiplier = unitDenominator / 4;
  const units = durationBeats * multiplier;

  // Check integer
  const rounded = Math.round(units);
  if (Math.abs(units - rounded) < 1e-4) {
    if (rounded === 1) return '';
    return String(rounded);
  }

  // Check common fractions: denominator in [2, 3, 4, 6, 8, 12, 16]
  const candidateDens = [2, 3, 4, 6, 8, 12, 16];
  for (const den of candidateDens) {
    const num = Math.round(units * den);
    if (Math.abs(units - num / den) < 1e-3) {
      if (num === 1) {
        return `/${den}`;
      }
      // Simplify fraction
      const g = gcd(num, den);
      const sNum = num / g;
      const sDen = den / g;
      if (sDen === 1) {
        return sNum === 1 ? '' : String(sNum);
      }
      if (sNum === 1) {
        return `/${sDen}`;
      }
      return `${sNum}/${sDen}`;
    }
  }

  // Fallback: rounded to 2 decimal places as string fraction or int
  const intVal = Math.round(units);
  return intVal === 1 ? '' : String(intVal);
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}
