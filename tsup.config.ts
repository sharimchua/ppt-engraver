import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/compile-cli.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});

