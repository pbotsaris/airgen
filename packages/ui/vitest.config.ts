import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // globals gives React Testing Library its automatic per-test cleanup.
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
