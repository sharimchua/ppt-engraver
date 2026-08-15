/**
 * CLI entry point for ppt-resolve.
 *
 * Usage:
 *   ppt-resolve <file.ppt.yaml>              → outputs onset stream JSON to stdout
 *   ppt-resolve <file.ppt.yaml> -o out.json  → writes onset stream JSON to file
 *
 * Exit codes:
 *   0 — success
 *   1 — validation or resolution error
 */
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { resolveFile } from './resolver/resolve.js';

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(`ppt-resolve — PPT Tapestry → onset stream resolver (Phase 1)

Usage:
  ppt-resolve <file.ppt.yaml>              Resolve and print onset stream JSON
  ppt-resolve <file.ppt.yaml> -o <out>     Resolve and write to file

Options:
  -o, --output <file>   Write output to file instead of stdout
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

    const json = JSON.stringify(onsets, null, 2);

    if (values.output) {
      writeFileSync(values.output, json + '\n', 'utf-8');
      console.error(`✓ Wrote ${onsets.length} onsets to ${values.output}`);
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
