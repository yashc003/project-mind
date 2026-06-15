import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI entry — includes shebang for direct execution
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node18',
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    shims: true,
    treeshake: true,
  },
  // Library entry — importable without shebang
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    target: 'node18',
    platform: 'node',
    shims: true,
    treeshake: true,
  },
  // Plugins entry — precompiled test plugins
  {
    entry: [
      'plugins/spring-boot/index.ts',
      'plugins/react/index.ts',
      'plugins/fastapi/index.ts',
      'plugins/nestjs/index.ts',
      'plugins/express/index.ts',
      'plugins/django/index.ts',
      'plugins/laravel/index.ts',
      'plugins/sveltekit/index.ts',
    ],
    outDir: 'dist/plugins',
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    target: 'node18',
    platform: 'node',
  }
]);
