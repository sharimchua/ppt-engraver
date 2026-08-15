/**
 * CLI entry point for ppt-compile (Phase 2).
 *
 * Usage:
 *   ppt-compile <file.ppt.yaml>                    → writes <file>.notation.ly + <file>.ppt-map.json
 *   ppt-compile <file.ppt.yaml> -o score.ly        → writes custom .ly + companion .ppt-map.json
 *   ppt-compile <file.ppt.yaml> --render           → additionally renders PDF via local lilypond if available
 *
 * Exit codes:
 *   0 — success
 *   1 — validation or compilation error
 */
import { parseArgs } from 'node:util';
import { compileFile } from './compiler/compile.js';

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      map: { type: 'string' },
      render: { type: 'boolean', short: 'r' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(`ppt-compile — PPT Tapestry → LilyPond compiler (Phase 2)

Usage:
  ppt-compile <file.ppt.yaml>                 Compile to .notation.ly and .ppt-map.json
  ppt-compile <file.ppt.yaml> -o <out.ly>     Specify custom LilyPond output path
  ppt-compile <file.ppt.yaml> --render        Also render PDF if lilypond is installed

Options:
  -o, --output <file>   Output .ly path (default: <base>.notation.ly)
  --map <file>          Output sidecar JSON path (default: <base>.ppt-map.json)
  -r, --render          Invoke local lilypond binary to render PDF
  -h, --help            Show this help message`);
    process.exit(positionals.length === 0 && !values.help ? 1 : 0);
  }

  const inputFile = positionals[0];

  try {
    const baseName = inputFile.replace(/(\.ppt)?\.ya?ml$/, '');
    const outLy = values.output ?? `${baseName}.notation.ly`;
    const outMap = values.map ?? `${baseName}.ppt-map.json`;

    const result = compileFile(inputFile, {
      outLyPath: outLy,
      outMapPath: outMap,
      renderPdf: values.render,
    });

    for (const warning of result.warnings) {
      console.error(`⚠ ${warning}`);
    }

    console.error(`✓ Emitted LilyPond notation: ${outLy}`);
    console.error(`✓ Emitted sidecar map:       ${outMap}`);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
