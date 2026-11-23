import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'work', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The headless sim must stay renderer/DOM-free so it runs in Node.
    files: ['src/engine/sim/**/*.ts', 'src/engine/ai/**/*.ts', 'src/games/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', '**/render/**', '**/ui/**', '**/input/**'],
              message: 'sim/ai/games must not depend on rendering, UI or input.',
            },
          ],
        },
      ],
    },
  },
);
