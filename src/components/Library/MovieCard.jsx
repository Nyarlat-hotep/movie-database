import { TMDB_POSTER_URL } from '../../utils/format.js';
import './MovieCard.css';

export default function MovieCard({ item, onClick }) {
  const posterUrl = TMDB_POSTER_URL(item.poster_path, 'w342');

  return (
    <div className="movie-card" onClick={() => onClick(item)}>
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
        {item._type === 'show' && <span className="badge badge-show">TV</span>}
        {item.formats.includes('bluray') && <span className="badge badge-bluray">BR</span>}
        {item.formats.includes('vhs') && <span className="badge badge-vhs">VHS</span>}
      </div>
    </div>
  );
}
