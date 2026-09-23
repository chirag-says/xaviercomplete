'use client';

/**
 * The directory: search, filters, grid.
 *
 * Records arrive as props from the server page, already projected to
 * `PublicAlumnus`. This component never fetches and never imports the loader —
 * it could not, since the loader reaches the database and the encryption key.
 * Whatever a signed-out visitor can extract from this component's state is
 * exactly what the server decided to send, which is the five public fields.
 *
 * Filtering and search run in the browser over that same public set. For five
 * hundred records that is instant and avoids a round trip per keystroke; more
 * to the point, there is no search endpoint to probe, so nobody can use the
 * search box to ask the server questions about fields it did not send.
 */

import { useMemo, useState } from 'react';

import { AlumniCard } from './AlumniCard';
import { directoryCopy, filterLabels, type FilterKey } from '@/data/alumni';
import type { PublicAlumnus } from '@/lib/visibility';

type SortMode = 'batch' | 'active';

const EMPTY: Record<FilterKey, string> = { batchYear: '', stream: '' };

/*
 * `?? ''` rather than `String(...)` on the year.
 *
 * A null batch year through `String()` becomes the literal text "null", which
 * then flows into `unique()` — where it survives the `filter(Boolean)` because
 * "null" is a non-empty string — and ends up as a selectable option in the
 * batch dropdown. Empty string is the value this file already uses for "no
 * value", and `unique` drops it.
 */
const valueOf = (person: PublicAlumnus, key: FilterKey): string =>
  key === 'batchYear' ? (person.batchYear?.toString() ?? '') : (person.stream ?? '');

const haystack = (person: PublicAlumnus) =>
  [
    person.fullName,
    person.currentOrg,
    person.designation,
    person.stream,
    person.batchYear?.toString() ?? null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

export function AlumniDiscover({
  people,
  isVerified,
  isDemo = false,
}: {
  people: PublicAlumnus[];
  isVerified: boolean;
  isDemo?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const [sort, setSort] = useState<SortMode>('batch');

  // Derived from the records on screen, so a filter never offers a value that
  // would return nothing — and never names a batch or stream that is not in the
  // directory.
  const filterOptions = useMemo(
    () => ({
      batchYear: unique(people.map((person) => person.batchYear?.toString() ?? '')).reverse(),
      stream: unique(people.map((person) => person.stream ?? '')),
    }),
    [people],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = people.filter((person) => {
      if (needle && !haystack(person).includes(needle)) return false;
      return (Object.keys(filters) as FilterKey[]).every(
        (key) => !filters[key] || valueOf(person, key) === filters[key],
      );
    });

    if (sort === 'active') {
      return [...filtered].sort((a, b) => {
        // Alumni with lastActive come first, sorted most recent first.
        // Alumni without lastActive go to the end.
        if (a.lastActive && b.lastActive) return b.lastActive.localeCompare(a.lastActive);
        if (a.lastActive) return -1;
        if (b.lastActive) return 1;
        return 0;
      });
    }

    return filtered;
  }, [people, query, filters, sort]);

  const dirty = query !== '' || Object.values(filters).some(Boolean);
  const reset = () => {
    setQuery('');
    setFilters(EMPTY);
    setSort('batch');
  };

  return (
    <section className="al-discover" id="directory">
      <div className="al-shell">
        <div className="al-discover__head">
          <p className="al-eyebrow">Directory</p>
          <h2 className="al-discover__title">Discover the Xaverian Network</h2>
          <p className="al-discover__subtitle">{directoryCopy.intro}</p>
        </div>

        {/* Search */}
        <div className="al-search">
          <svg className="al-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={directoryCopy.searchPlaceholder}
            aria-label={directoryCopy.searchPlaceholder}
          />
        </div>

        {/* Filters */}
        <div className="al-filters">
          {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
            <select
              key={key}
              value={filters[key]}
              aria-label={filterLabels[key]}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            >
              <option value="">{filterLabels[key]}</option>
              {filterOptions[key].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ))}

          <button
            type="button"
            className={`al-sort-btn${sort === 'active' ? ' al-sort-btn--active' : ''}`}
            onClick={() => setSort(sort === 'active' ? 'batch' : 'active')}
            aria-pressed={sort === 'active'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
            </svg>
            Recently Active
          </button>

          {(dirty || sort !== 'batch') && (
            <button type="button" className="al-reset" onClick={reset}>{directoryCopy.clearLabel}</button>
          )}
        </div>

        <p className="al-count" aria-live="polite">
          {results.length} {results.length === 1 ? 'Xaverian' : 'Xaverians'}
        </p>

        {/* Grid */}
        {results.length > 0 ? (
          <div className="al-grid">
            {results.map((person) => (
              <AlumniCard key={person.id} person={person} isVerified={isVerified} isDemo={isDemo} />
            ))}
          </div>
        ) : (
          <div className="al-empty">
            <h3>{directoryCopy.emptyTitle}</h3>
            <p>{directoryCopy.emptyBody}</p>
          </div>
        )}
      </div>
    </section>
  );
}
