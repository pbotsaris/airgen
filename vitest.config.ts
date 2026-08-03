import {defineConfig} from 'vitest/config';

// Registers each workspace as a Vitest project so `npx vitest` (or
// `npm run test:ui`) works from the repo root — each project brings its own
// config (packages/ui/vitest.config.ts sets the jsdom environment). airgen's
// own suite is node:test, not Vitest; it stays behind root `npm test`.
export default defineConfig({
  test: {
    projects: ['packages/ui'],
  },
});
