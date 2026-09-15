/**
 * /chapters — mirrors the website's own path, so a deep link maps across
 * with no translation and the app's URL structure is the website's.
 */

import { ChaptersPage } from '@/components/pages/ChaptersPage';

export default ChaptersRoute;

function ChaptersRoute(): React.ReactElement {
  return <ChaptersPage />;
}
