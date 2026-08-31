import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Each suite boots its own Postgres (PGlite) and replays every migration,
    // so the first assertion in a file is not the fast path.
    testTimeout: 120_000,
    hookTimeout: 180_000,
    // PGlite instances are memory-hungry; running files in sequence keeps the
    // suite predictable on a laptop.
    fileParallelism: false,
  },
});
