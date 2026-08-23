import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';

/**
 * Deliberately narrow: this config exists for one rule.
 *
 * `rules-of-hooks` catches a failure mode nothing else here can see. Hooks
 * placed below an early return run only on some renders, and React aborts with
 * "rendered more hooks than during the previous render" — which reaches the
 * user as a blank "this page couldn't load". Types pass, the build passes, and
 * the page returns 200. Only running the component catches it, and there is
 * one such bug per screen that nobody thought to render in a test.
 *
 * `exhaustive-deps` is a warning: it is usually right, but not always, and a
 * failing build over a deliberate omission would train everyone to ignore it.
 */
export default [
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'ios/**', 'public/**'] },
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
