const eslintPluginImport = require('eslint-plugin-import');
const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: [
      '**/.venv/**',
      '**/dist/**',
      '**/public/**',
      '**/node_modules/**',
      '**/jscharting/**',
      '**/src/static/gantt/**',
    ],

    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: eslintPluginImport,
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
        },
      ],
    },
  },
];
