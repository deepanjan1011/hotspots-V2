import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  // Extra ignores on top of Next.js defaults.
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/out/**', '**/build/**'],
  },
  // Next.js flat config (includes TS + React + Next rules + ignores)
  ...nextCoreWebVitals,

  // Project-specific relaxations: keep lint usable without refactoring vendored UI.
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      // These rules are very strict and flag patterns used in bundled UI components.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',

      // Common in marketing copy / UI; enforce at review-time, not lint-time.
      'react/no-unescaped-entities': 'off',

      // Keep as warning (still shows up) but don't block builds.
      '@next/next/no-img-element': 'warn',
    },
  },
];

export default config;

