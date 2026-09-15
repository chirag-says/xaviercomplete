import { Fragment, type CSSProperties } from 'react';
import { Variant } from '@/components/layout/Variant';
import { PAGE_HASHES } from '@/lib/breakpoints';
import { tokens } from '@/lib/tokens';
import type { contactPage } from '@/data/pages/contact';

/**
 * The round social buttons under "Follow Us" on the contact page
 * (`framer-jmRrq`). Framer sizes them 38px on desktop and 30px otherwise; the
 * desktop copy of the banner carries both sizes as breakpoint variants while
 * the phone copy only has the small one.
 */

type Social = (typeof contactPage.socials)[number];

const CONTAINERS = ['framer-wsud1e-container', 'framer-e5neze-container', 'framer-j2d0f3-container', 'framer-16zu03t-container'];
const VARIANT = {
  primary: { cls: 'framer-v-lu7sx7', name: 'Primary' },
  small: { cls: 'framer-v-my36ij', name: 'Small' },
} as const;
const FILL: CSSProperties = { position: 'absolute', borderRadius: 'inherit', top: 0, right: 0, bottom: 0, left: 0 };

function SocialLink({ social, variant, containerClass }: { social: Social; variant: keyof typeof VARIANT; containerClass: string }) {
  const v = VARIANT[variant];
  return (
    <div className={containerClass}>
      <a
        className={`framer-jmRrq framer-lu7sx7 ${v.cls} framer-1iiopha`}
        data-framer-name={v.name}
        href={social.href}
        target="_blank"
        rel="noreferrer"
        aria-label={social.name}
        style={{ backgroundColor: tokens.grey, height: '100%', width: '100%', borderBottomLeftRadius: '80px', borderBottomRightRadius: '80px', borderTopLeftRadius: '80px', borderTopRightRadius: '80px' }}
      >
        <div className="framer-1dxqay2" data-framer-name="Icon" style={{ filter: 'none', WebkitFilter: 'none' }}>
          <div style={FILL} data-framer-background-image-wrapper="true">
            <img decoding="async" width={24} height={24} src={social.icon} alt="Icon" style={{ display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', objectPosition: 'center', objectFit: 'cover' }} />
          </div>
        </div>
      </a>
    </div>
  );
}

export function SocialLinks({ socials, split = false }: { socials: Social[]; split?: boolean }) {
  return (
    <>
      {socials.map((social, i) => {
        const containerClass = CONTAINERS[i] ?? CONTAINERS[CONTAINERS.length - 1];
        if (!split) return <SocialLink key={social.name} social={social} variant="small" containerClass={containerClass} />;
        return (
          <Fragment key={social.name}>
            <Variant hashes={PAGE_HASHES.contact} on={['desktop', 'phone']}>
              <SocialLink social={social} variant="primary" containerClass={containerClass} />
            </Variant>
            <Variant hashes={PAGE_HASHES.contact} on={['tablet', 'phone']}>
              <SocialLink social={social} variant="small" containerClass={containerClass} />
            </Variant>
          </Fragment>
        );
      })}
    </>
  );
}
