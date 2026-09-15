/**
 * Compact location strip — address + "View on Maps" link.
 * Takes minimal vertical space.
 */

export function LocationSection() {
  const mapsUrl = 'https://maps.google.com/?q=St.+Xavier%27s+College+Kolkata+30+Mother+Teresa+Sarani';

  return (
    <section className="ct-loc">
      <div className="ct-loc__inner">
        <div className="ct-loc__pin">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div className="ct-loc__text">
          <p className="ct-loc__name">St. Xavier&rsquo;s College (Autonomous)</p>
          <p className="ct-loc__address">30, Mother Teresa Sarani (Park Street), Kolkata &ndash; 700 016</p>
        </div>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="ct-loc__link">
          View on Maps
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </a>
      </div>
    </section>
  );
}
