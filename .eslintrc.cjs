module.exports = {
  root: true,
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'mobile/.expo/',
    'mobile/node_modules/',
  ],
  env: { es2021: true, node: true, browser: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module', project: false },
  plugins: ['@typescript-eslint', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
  overrides: [
    {
      files: ['server/**/*.ts'],
      env: { node: true },
    },
    {
      files: ['mobile/**/*.tsx', 'mobile/**/*.ts'],
      env: { browser: true, node: false },
    },
  ],
};
