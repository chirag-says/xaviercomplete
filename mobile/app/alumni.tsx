/**
 * /alumni — mirrors the website's own path, so a deep link maps across
 * with no translation and the app's URL structure is the website's.
 */

import { AlumniPage } from '@/components/pages/AlumniPage';

export default AlumniRoute;

function AlumniRoute(): React.ReactElement {
  return <AlumniPage />;
}
