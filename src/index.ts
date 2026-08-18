/**
 * CLI entry point and main library exports for ppt-engraver / ppt-resolve.
 *
 * Usage:
 *   ppt-resolve <file.ppt.yaml>              → outputs onset stream JSON to stdout
 *   ppt-resolve <file.ppt.yaml> -o out.json  → writes onset stream JSON to file
 *   ppt-resolve <file.ppt.yaml> -m out.mid   → writes Standard MIDI File for audio playback
 *
 * Exit codes:
 *   0 — success
 *   1 — validation or resolution error
 */
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { resolveFile } from './resolver/resolve.js';
import { writeMidiFile } from './midi/writer.js';

// Re-export all library modules for programmatic consumption
export * from './schema/tapestry.js';
export * from './schema/onset.js';
export * from './solfege/pitch.js';
export * from './solfege/rhythm.js';
export * from './solfege/voicings.js';
export * from './solfege/augmentation.js';
export * from './parser/yaml-loader.js';
export * from './resolver/knot.js';
export * from './resolver/coil.js';
export * from './resolver/weave.js';
export * from './resolver/graph.js';
export * from './resolver/resolve.js';
export * from './midi/writer.js';
export * from './lilypond/pitch.js';
export * from './lilypond/compiler.js';
export * from './sidecar/map.js';
export * from './compiler/compile.js';
export * from './constants.js';


function main(): void {
  // Only run CLI when executed directly (or via tsx / bin)
  const isDirectRun = process.argv[1]?.includes('index') || process.argv[1]?.includes('ppt-resolve');
  if (!isDirectRun) return;

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      midi: { type: 'string', short: 'm' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(`ppt-resolve — PPT Tapestry → onset stream resolver (Phase 1)

Usage:
  ppt-resolve <file.ppt.yaml>              Resolve and print onset stream JSON
  ppt-resolve <file.ppt.yaml> -o <out.json> Write onset stream JSON to file
  ppt-resolve <file.ppt.yaml> -m <out.mid>  Export playable Standard MIDI File

Options:
  -o, --output <file>   Write JSON output to file instead of stdout
  -m, --midi <file>     Export playable MIDI file (.mid)
  -h, --help            Show this help message`);
    process.exit(positionals.length === 0 && !values.help ? 1 : 0);
  }

  const inputFile = positionals[0];

  try {
    const { onsets, warnings } = resolveFile(inputFile);

    // Print warnings to stderr
    for (const warning of warnings) {
      console.error(`⚠ ${warning}`);
    }

    // Write MIDI if requested
    if (values.midi) {
      writeMidiFile(onsets, values.midi);
      console.error(`✓ Wrote MIDI file with ${onsets.length} onsets to ${values.midi}`);
    }

    const json = JSON.stringify(onsets, null, 2);

    if (values.output) {
      writeFileSync(values.output, json + '\n', 'utf-8');
      console.error(`✓ Wrote ${onsets.length} onsets to ${values.output}`);
    } else if (!values.midi) {
      console.log(json);
    }
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}

main();

