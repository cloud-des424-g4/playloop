import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const services = ['identity', 'community', 'notifications', 'media'];

export default [
  { ignores: ['**/node_modules/', '**/dist/', '**/coverage/', '**/.aws-sam/', 'client/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  ...services.map((service) => ({
    files: [`services/${service}/**/*.js`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: services
            .filter((other) => other !== service)
            .flatMap((other) => [`**/${other}/src/**`, `@playloop/${other}`]),
        },
      ],
    },
  })),
  prettier,
];
