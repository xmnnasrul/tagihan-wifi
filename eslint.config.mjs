import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import { defineConfig, globalIgnores } from 'eslint/config';

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

export default defineConfig([
  ...compat.extends('next/core-web-vitals'),
  globalIgnores([
    '.next/**',
    '.next-dev/**',
    '.agents/skills/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);
