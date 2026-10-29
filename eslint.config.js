import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['server/**/*.{js,cjs,mjs}', 'tests/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Architecture boundary rule: Activities must never import another activity's internal files
  {
    files: ['src/activities/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/activities/*/**', '!./**'],
              message: 'Cross-activity imports are strictly forbidden. Activities must remain fully isolated.',
            },
          ],
        },
      ],
    },
  },
  // Architecture boundary rule: Shared modules and platform code must never import activity implementations
  {
    files: [
      'src/arena/**/*.{js,jsx}',
      'src/components/**/*.{js,jsx}',
      'src/services/**/*.{js,jsx}',
      'src/hooks/**/*.{js,jsx}',
      'src/lib/**/*.{js,jsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/activities/**'],
              message: 'Shared platform modules and arena core must never import activity-specific implementations.',
            },
          ],
        },
      ],
    },
  },
])
