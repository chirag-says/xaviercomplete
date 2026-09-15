/**
 * The content bundle, as React state.
 *
 * One fetch at startup, shared by every screen through context. The alternative
 * — each screen loading what it needs — would mean nine copies of the same
 * stale-while-revalidate logic and nine chances to get the cache tier wrong.
 *
 * The revalidation is deliberately not awaited. `readContent()` resolves from
 * disk on the first frame, so the app draws real copy immediately; the network
 * check lands a moment later and swaps in a newer bundle if the server has one.
 * A user on a slow connection never waits for content they already have.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readConfig, readContent, refreshContent } from './content';
import type { AppConfig, Content } from './content-types';

interface ContentState {
  content: Content | null;
  config: AppConfig | null;
  /** True until the first resolution attempt finishes, from any source. */
  loading: boolean;
  /** Set only when there is no content at all — first launch with no network. */
  error: Error | null;
  reload: () => void;
}

const ContentContext = createContext<ContentState | null>(null);

export function ContentProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [content, setContent] = useState<Content | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const initial = await readContent();
        if (!alive) return;
        setContent(initial);
        setError(null);
      } catch (cause) {
        if (!alive) return;
        // Nothing cached and nothing reachable. This is the only state that
        // warrants an error screen; every other failure leaves content on screen.
        setError(cause instanceof Error ? cause : new Error('Content unavailable.'));
      } finally {
        if (alive) setLoading(false);
      }

      /*
       * Revalidate and read the config after the first paint, both unawaited by
       * the caller. `refreshContent` never throws and `readConfig` returns null
       * on failure, so neither can turn a working launch into an error.
       */
      void refreshContent().then((fresher) => {
        if (alive && fresher) setContent(fresher);
      });

      void readConfig().then((loaded) => {
        if (alive && loaded) setConfig(loaded);
      });
    }

    void load();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const value = useMemo<ContentState>(
    () => ({ content, config, loading, error, reload }),
    [content, config, loading, error, reload],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

/** For the shell: the whole state, including the loading and error cases. */
export function useContentState(): ContentState {
  const state = useContext(ContentContext);
  if (!state) throw new Error('useContentState must be used inside <ContentProvider>.');
  return state;
}

/**
 * For screens: the bundle, non-null.
 *
 * The root layout does not render the navigator until content exists, so by the
 * time any screen mounts this cannot be null. Asserting that here means screens
 * are free of `content?.home?.hero?.display ?? []` chains, which is most of what
 * makes this kind of code unreadable.
 */
export function useContent(): Content {
  const { content } = useContentState();
  if (!content) throw new Error('useContent was called before content resolved.');
  return content;
}

export function useAppConfig(): AppConfig | null {
  return useContentState().config;
}
