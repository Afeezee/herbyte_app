import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    // TS sources (api/, server/, scripts/) are type-checked by `tsc --noEmit`;
    // ESLint isn't set up with a TS parser here on purpose to keep the toolchain
    // slim.
    ignores: [
      'dist',
      '.vercel',
      'drizzle',
      'base44',
      'node_modules',
      'migration-data',
      'api/**',
      'server/**',
      'scripts/**',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // We don't use PropTypes — TypeScript would be the right answer for a
      // greenfield project, but the migration keeps the frontend in JSX
      // unchanged. Turning this off matches the way this codebase is written.
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'off',
      'react/no-unescaped-entities': 'off',
      // shadcn/ui components use these custom DOM attributes for styling
      'react/no-unknown-property': [
        'error',
        { ignore: ['cmdk-input-wrapper', 'toast-close'] },
      ],
      'no-empty-pattern': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
