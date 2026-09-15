/**
 * /events — mirrors the website's own path, so a deep link maps across
 * with no translation and the app's URL structure is the website's.
 */

import { EventsPage } from '@/components/pages/EventsPage';

export default EventsRoute;

function EventsRoute(): React.ReactElement {
  return <EventsPage />;
}
