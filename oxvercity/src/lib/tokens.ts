/**
 * Framer's colour tokens, exactly as the stylesheet declares them on `body`.
 * Components pass these through inline custom properties the way the original
 * markup does, so a token change in `framer.css` flows everywhere.
 */
export const tokens = {
  ink: 'var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))',
  ink70: 'var(--token-22882129-b366-490b-9a5e-fd923b82bd88, rgba(17, 17, 17, 0.7))',
  white: 'var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))',
  white20: 'var(--token-7d75b990-1db7-4479-b923-4e356c6d6b9d, rgba(255, 255, 255, 0.2))',
  white10: 'var(--token-36ef251f-1e06-4c6c-acb0-c1bc97a355e3, rgba(255, 255, 255, 0.1))',
  grey: 'var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))',
  navWhite: 'var(--token-96d44e7f-6c0a-4e64-a864-7b3d0cc62920, rgb(255, 255, 255))',
  transparent: 'rgba(255, 255, 255, 0)',
} as const;

/** Framer's default variant transition on this site: 0.4s ease-in-out. */
export const VARIANT_EASE = 'cubic-bezier(0.44, 0, 0.56, 1)';
export const VARIANT_DURATION = 0.4;
