/**
 * /explore — mirrors the website's own path, so a deep link maps across
 * with no translation and the app's URL structure is the website's.
 */

import { ExplorePage } from '@/components/pages/ExplorePage';

export default ExploreRoute;

function ExploreRoute(): React.ReactElement {
  return <ExplorePage />;
}
