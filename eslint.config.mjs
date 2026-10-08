import { fixupConfigRules } from '@eslint/compat';
import js from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import { configs, plugins } from 'eslint-config-airbnb-extended';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = [
  globalIgnores(['.next/**', 'src/generated/**', 'next-env.d.ts']),
  { name: 'js/config', ...js.configs.recommended },
  plugins.stylistic,
  plugins.importX,
  ...configs.base.recommended,
  plugins.react,
  plugins.reactA11y,
  plugins.reactHooks,
  plugins.next,
  ...configs.next.recommended,
  plugins.typescriptEslint,
  ...configs.base.typescript,
  ...configs.next.typescript,
  {
    name: 'project/tooling-files',
    files: ['*.config.{mjs,ts}', '**/*.test.ts', 'prisma/**'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  {
    name: 'project/node-test-modules',
    files: ['**/*.test.ts', 'src/lib/feeds/**/*.ts'],
    rules: {
      'import-x/extensions': ['error', 'ignorePackages', { ts: 'always' }],
    },
  },
  {
    name: 'project/typescript-components',
    rules: {
      'react/require-default-props': ['error', { functions: 'defaultArguments' }],
    },
  },
  {
    name: 'project/placeholder-links',
    rules: {
      'jsx-a11y/anchor-is-valid': ['error', { aspects: ['noHref', 'preferButton'] }],
    },
  },
  prettier,
];

// Airbnb's plugins still call context APIs that ESLint 10 removed.
export default fixupConfigRules(eslintConfig);
