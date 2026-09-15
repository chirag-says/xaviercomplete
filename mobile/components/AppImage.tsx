/**
 * The two image components, and why there are exactly two.
 *
 * The plan's cache policy divides everything the app fetches into what may be
 * written to disk and what may not. For text that boundary is enforced in
 * content.ts, which is the only module importing the filesystem. For *images* it
 * has to be enforced here, because `expo-image` keeps its own disk cache and
 * will happily persist anything it is pointed at — including a photograph of an
 * identifiable alumnus, into a directory that survives the app being closed.
 *
 *   `<Asset>`   static website artwork — logos, hero photographs, event posters
 *               that ship with the site. Public, unchanging, worth caching hard.
 *               `memory-disk`.
 *
 *   `<Private>` anything derived from the alumni database — profile photographs,
 *               event album pictures. `memory` only, and **there is no prop to
 *               change that.** The policy is not configurable, because a policy
 *               with an override is a policy someone overrides at 2am.
 *
 * The test for which to use: did fetching it need a bearer token? If yes, it is
 * `<Private>`. Phase 8 verifies this from the outside by grepping the app
 * sandbox after a profile has been viewed.
 */

import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';
import { type StyleProp } from 'react-native';

import type { SiteImage } from '@/lib/content-types';
import { contentPositionFor, imageUrl } from '@/lib/images';
import { colour } from '@/theme';

/** A soft grey while the bytes arrive, rather than a flash of white. */
const PLACEHOLDER_COLOR = colour.plate;

export interface AssetProps {
  image: SiteImage;
  /** On-screen width in points, used to pick a pre-scaled variant. */
  displayWidth: number;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  /** Overrides the alt text carried on the image. */
  accessibilityLabel?: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Static website artwork.
 *
 * `transition` is a short cross-fade rather than a pop-in. The website's images
 * arrive behind Framer's scroll animations; on mobile there is no scroll
 * choreography to hide the load, so a 200ms fade does the same job of making a
 * late image feel intentional.
 */
export function Asset({
  image,
  displayWidth,
  style,
  contentFit = 'cover',
  accessibilityLabel,
  priority = 'normal',
}: AssetProps): React.ReactElement {
  return (
    <Image
      source={{ uri: imageUrl(image, displayWidth) }}
      style={style}
      contentFit={contentFit}
      // The website frames some images deliberately off-centre; carry that
      // across rather than silently re-cropping them to the middle.
      contentPosition={contentPositionFor(image)}
      transition={200}
      priority={priority}
      cachePolicy="memory-disk"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? image.alt}
      alt={accessibilityLabel ?? image.alt}
    />
  );
}

export interface PrivateProps {
  /** An absolute URL, or a path against the API host. */
  uri: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  accessibilityLabel: string;
  /** Rendered when `uri` is null — an alumnus with no photograph. */
  fallback?: React.ReactElement;
}

/**
 * Anything from the alumni database.
 *
 * Note what is missing: no `cachePolicy` prop. The caller cannot opt into disk
 * caching, which is the entire reason this component exists rather than a
 * convention that everyone remembers to follow.
 */
export function Private({
  uri,
  style,
  contentFit = 'cover',
  accessibilityLabel,
  fallback,
}: PrivateProps): React.ReactElement | null {
  if (!uri) return fallback ?? null;

  return (
    <Image
      source={{ uri }}
      style={[{ backgroundColor: PLACEHOLDER_COLOR }, style]}
      contentFit={contentFit}
      transition={160}
      // Memory only. Not configurable. See this file's header.
      cachePolicy="memory"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      alt={accessibilityLabel}
    />
  );
}
