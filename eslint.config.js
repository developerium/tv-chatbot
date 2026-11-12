import eslint from '@eslint/js'
import perfectionist from 'eslint-plugin-perfectionist'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import unicorn from 'eslint-plugin-unicorn'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['coverage/', 'dist/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true },
    },
    plugins: { perfectionist, unicorn },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      'perfectionist/sort-array-includes': 'error',
      'perfectionist/sort-arrays': [
        'error',
        // Only arrays made entirely of string literals.
        {
          useConfigurationIf: {
            matchesAstSelector:
              'ArrayExpression[elements.length>1]:not(:has(> :not(Literal[value=/.*/])))',
          },
        },
      ],
      'perfectionist/sort-imports': 'error',
      'perfectionist/sort-named-imports': 'error',
      'perfectionist/sort-sets': 'error',
      'unicorn/name-replacements': 'error',
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettierRecommended,
)
