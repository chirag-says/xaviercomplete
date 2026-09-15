/**
 * The one place the admin app reaches into the public app's source tree.
 *
 * ## Why the dependency points this way
 *
 * The crypto, the blind indexes and the key ring must exist in **exactly one
 * copy**. Two implementations of AES-GCM field encryption that drift apart is a
 * class of bug where the symptom is unreadable contact numbers and the cause is
 * invisible — so duplication was never an option.
 *
 * The plan (§9.1) calls for these to live in `packages/core` with both apps
 * depending on it. That move is deferred, deliberately: an npm workspace
 * symlinks the package into `node_modules`, and Node's type stripping does not
 * apply inside `node_modules`, which would break every plain-Node tool in this
 * project — the ingest tool, the migration runner, the admin CLI below. Making
 * that work needs a build step for the shared package, and adding a build step
 * to the code that holds the encryption keys is not a change to make in passing.
 *
 * So for now the arrow points from admin into the public app, which is the safe
 * direction: everything in `oxvercity/src/lib/core` is already deployed to the
 * public server, so importing it here adds no exposure. **Nothing goes the
 * other way.** No file under `oxvercity/` imports anything from this directory,
 * and that is what keeps admin code off the public server.
 *
 * Every ugly relative path is confined to this file. The rest of the admin app
 * imports from `./shared.ts`.
 */

export {
  encryptField,
  decryptField,
  encryptOptional,
  decryptOptional,
  fieldContext,
  CryptoIntegrityError,
} from '../../../oxvercity/src/lib/core/crypto.ts';

export {
  emailBlindIndex,
  blindIndexOfNormalised,
  ipBlindIndex,
  uaBlindIndex,
  tokenHash,
  unsubscribeToken,
} from '../../../oxvercity/src/lib/core/hmac.ts';

export { normaliseEmail } from '../../../oxvercity/src/lib/core/email.ts';

export { normalisePhone } from '../../../oxvercity/src/lib/core/phone.ts';

export { newToken, newRecoveryCodes, newAlumniId, isAlumniId } from '../../../oxvercity/src/lib/core/ids.ts';

export { connect, type Sql } from '../../../oxvercity/src/lib/db.ts';

export { audit, type AuditEntry, type MetaValue } from '../../../oxvercity/src/lib/audit.ts';

export {
  send,
  mailConfig,
  MailConfigError,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type Mail,
  type MailConfig,
} from '../../../oxvercity/src/lib/email.ts';
