/**
 * The one barrel the rest of the admin app imports shared modules from.
 *
 * These modules were originally imported from the sibling `oxvercity` project
 * via relative paths. They are now copied into this app's own source tree
 * (under `src/lib/core/` and `src/lib/shared-*.ts`) so that the admin app can
 * be built and deployed independently — no sibling directory required.
 *
 * Keep these copies in sync with the originals until a shared `packages/core`
 * workspace is set up.
 */

export {
  encryptField,
  decryptField,
  encryptOptional,
  decryptOptional,
  fieldContext,
  CryptoIntegrityError,
} from './core/crypto.ts';

export {
  emailBlindIndex,
  blindIndexOfNormalised,
  ipBlindIndex,
  uaBlindIndex,
  tokenHash,
  unsubscribeToken,
} from './core/hmac.ts';

export { normaliseEmail } from './core/email.ts';

export { normalisePhone } from './core/phone.ts';

export { newToken, newRecoveryCodes, newAlumniId, isAlumniId } from './core/ids.ts';

export { connect, type Sql } from './shared-db.ts';

export { audit, type AuditEntry, type MetaValue } from './shared-audit.ts';

export {
  send,
  mailConfig,
  MailConfigError,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type Mail,
  type MailConfig,
} from './shared-email.ts';
