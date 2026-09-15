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

const EMPTY: Record<FilterKey, string> = { batchYear: '', stream: '' };

const valueOf = (person: PublicAlumnus, key: FilterKey): string =>
  key === 'batchYear' ? String(person.batchYear) : (person.stream ?? '');

const haystack = (person: PublicAlumnus) =>
  [person.fullName, person.currentOrg, person.designation, person.stream, String(person.batchYear)]
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

  // Derived from the records on screen, so a filter never offers a value that
  // would return nothing — and never names a batch or stream that is not in the
  // directory.
  const filterOptions = useMemo(
    () => ({
      batchYear: unique(people.map((person) => String(person.batchYear))).reverse(),
      stream: unique(people.map((person) => person.stream ?? '')),
    }),
    [people],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      if (needle && !haystack(person).includes(needle)) return false;
      return (Object.keys(filters) as FilterKey[]).every(
        (key) => !filters[key] || valueOf(person, key) === filters[key],
      );
    });
  }, [people, query, filters]);

  const dirty = query !== '' || Object.values(filters).some(Boolean);
  const reset = () => {
    setQuery('');
    setFilters(EMPTY);
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

          {dirty && (
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
