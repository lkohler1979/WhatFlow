import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/**
 * ESLint 9 flat config (raiz do monorepo).
 * Fica na raiz para ser descoberto tanto pelo script da API
 * (cwd=apps/api, busca para cima) quanto pelo lint-staged (cwd=raiz).
 * O frontend (apps/web) usa o lint do Angular e fica fora daqui.
 */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.angular/**',
      'apps/web/**',
      'apps/api/jest.config.js',
    ],
  },
  {
    files: ['apps/api/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './apps/api/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Augmentação de tipos do Express exige `declare global { namespace ... }`
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
