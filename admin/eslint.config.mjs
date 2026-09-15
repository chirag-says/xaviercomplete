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
  { ignores: ['.next/**', 'next-env.d.ts'] },
  {
    rules: {
      /*
       * Navigation in this portal is plain <a>, not next/link, on purpose.
       *
       * <Link> prefetches, and a prefetch pulls the target page's RSC payload
       * into the client router cache before anyone has clicked. In an
       * application where every page carries contact details, access grants or
       * an audit trail, that means confidential payloads sitting in memory for
       * pages the admin never opened, surviving a "back" they assume discarded
       * them. Every response here is `no-store` precisely to stop that at the
       * HTTP layer; <Link> would reintroduce it one layer up.
       *
       * A full page load also re-runs the session check server-side on every
       * navigation rather than trusting a cached payload — which is what we
       * need when disabling an admin has to take effect on their next click.
       *
       * The cost is a few hundred milliseconds per navigation, for half a dozen
       * people a few times a month. That is a good trade.
       */
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
