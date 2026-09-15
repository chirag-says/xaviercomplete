/**
 * /contact — mirrors the website's own path, so a deep link maps across
 * with no translation and the app's URL structure is the website's.
 */

import { ContactPage } from '@/components/pages/ContactPage';

export default ContactRoute;

function ContactRoute(): React.ReactElement {
  return <ContactPage />;
}
