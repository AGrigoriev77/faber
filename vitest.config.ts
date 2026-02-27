import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/cli.ts', 'src/fp/result.ts', 'src/commands/extension/index.ts'],
      thresholds: {
        branches: 90,
        lines: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
})
