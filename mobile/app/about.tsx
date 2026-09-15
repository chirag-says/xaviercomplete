/**
 * /about — mirrors the website's own path, so a deep link maps across
 * with no translation and the app's URL structure is the website's.
 */

import { AboutPage } from '@/components/pages/AboutPage';

export default AboutRoute;

function AboutRoute(): React.ReactElement {
  return <AboutPage />;
}
