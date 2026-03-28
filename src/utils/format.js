export const FORMAT_LABELS = {
  dvd: 'DVD',
  bluray: 'BR',
  vhs: 'VHS',
};

export const FORMAT_COLORS = {
  dvd: 'rgba(255,255,255,0.3)',
  bluray: '#22d3ee',
  vhs: '#f5c842',
};

export const TMDB_POSTER_URL = (posterPath, size = 'w342') =>
  posterPath ? `https://image.tmdb.org/t/p/${size}${posterPath}` : null;
