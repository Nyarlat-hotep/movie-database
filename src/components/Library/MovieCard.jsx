import { artworkUrl } from '../../utils/format.js';
import { mediaTypeOf, facetLabel, facetColor } from '../../utils/mediaTypes.js';
import './MovieCard.css';

// `uniform` forces every card to 2:3 with letterboxed art — used in search
// results, where mixed aspect ratios would leave the grid ragged.
export default function MovieCard({ item, onClick, uniform = false }) {
  const type = mediaTypeOf(item);
  const posterUrl = artworkUrl(item.poster_path, 'w342');

  // DVD is the default on nearly every film/TV row, so badging it is noise.
  const facets = (item[type.facetField] || []).filter(f => f !== 'dvd').slice(0, 2);

  return (
    <div
      className={`movie-card ${uniform ? 'movie-card--uniform' : ''}`}
      style={{ '--card-ratio': uniform ? '2 / 3' : type.aspectRatio }}
      onClick={() => onClick(item)}
    >
      {posterUrl ? (
        <img
          className="movie-card-poster"
          src={posterUrl}
          alt={item.title}
          loading="lazy"
        />
      ) : (
        <div className="movie-card-fallback">{item.title}</div>
      )}

      <div className="movie-card-overlay">
        <div className="movie-card-title">{item.title}</div>
      </div>

      <div className="movie-card-badges">
        {/* In search results every card is labelled, since types are mixed. */}
        {(uniform ? type.searchBadge : type.typeBadge) && (
          <span className="badge badge-type">
            {uniform ? type.searchBadge : type.typeBadge}
          </span>
        )}
        {facets.map(facet => (
          <span
            key={facet}
            className="badge badge-facet"
            style={{ '--badge-color': facetColor(facet) }}
          >
            {facetLabel(facet)}
          </span>
        ))}
      </div>
    </div>
  );
}
