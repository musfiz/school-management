import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    ignores: ['**/*.config.ts', '**/*.config.js', 'next-env.d.ts'],
  },
];