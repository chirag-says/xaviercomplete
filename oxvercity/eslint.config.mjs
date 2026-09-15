import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // `next-env.d.ts` is generated, regenerated on every build, and git-ignored.
  // Since Next 15 it carries a triple-slash reference to `.next/types/routes.d.ts`,
  // which `next/typescript` then flags — a lint error nobody can fix, appearing
  // only once a build has run. CI would fail on a file the repo does not own.
  { ignores: ['_extract/**', '.next/**', 'next-env.d.ts'] },
  {
    rules: {
      // Images are served as the export ships them (plain <img> with Framer's own
      // srcset and sizes) so the rendering stays identical; next/image would
      // change the markup and the crops.
      '@next/next/no-img-element': 'off',
      // Navigation is full page loads, like the exported site: the markup is
      // generated with plain anchors and the animation layer runs on load.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
