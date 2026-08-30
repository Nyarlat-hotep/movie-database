import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { artworkUrl } from '../../utils/format.js';
import { mediaTypeOf, facetLabel, facetColor } from '../../utils/mediaTypes.js';
import './DetailModal.css';

export default function DetailModal({ item, onClose, onEdit, onDelete }) {
  useEffect(() => {
    if (!item) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [item, onClose]);

  if (!item) return null;

  const type = mediaTypeOf(item);
  const posterUrl = artworkUrl(item.poster_path, 'w500');
  const facets = (item[type.facetField] || []);

  // Per-type secondary line: seasons for shows, label/tracks for music,
  // systems for games.
  const detailLine =
    item._type === 'show'  ? (item.seasons_owned && `Seasons: ${item.seasons_owned}`)
  : item._type === 'music' ? [item.label, item.track_count && `${item.track_count} tracks`].filter(Boolean).join(' · ')
  : item._type === 'game'  ? (item.platforms || []).join(', ')
  : null;

  return (
    <AnimatePresence>
      <motion.div
        className="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="detail-modal"
          initial={{ opacity: 0, scale: 0.93, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 16 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <button className="detail-close" onClick={onClose}>✕</button>

          <div className="detail-poster-col" style={{ '--card-ratio': type.aspectRatio }}>
            {posterUrl
              ? <img className="detail-poster" src={posterUrl} alt={item.title} />
              : <div className="detail-poster-fallback">{item.title}</div>
            }
          </div>

          <div className="detail-content">
            <div>
              <div className="detail-title">{item.title}</div>
              <div className="detail-meta" style={{ marginTop: '0.4rem' }}>
                {item.year && <span className="detail-year">{item.year}</span>}
              </div>
              <div className="detail-badges" style={{ marginTop: '0.5rem' }}>
                {type.typeBadge && <span className="badge badge-type">{type.typeBadge}</span>}
                {facets.filter(f => f !== 'dvd').map(facet => (
                  <span
                    key={facet}
                    className="badge badge-facet"
                    style={{ '--badge-color': facetColor(facet) }}
                  >
                    {facetLabel(facet)}
                  </span>
                ))}
              </div>
              {detailLine && (
                <div className="detail-seasons" style={{ marginTop: '0.5rem' }}>
                  {detailLine}
                </div>
              )}
            </div>

            {item.synopsis && (
              <div>
                <div className="detail-section-label">Synopsis</div>
                <div className="detail-synopsis">{item.synopsis}</div>
              </div>
            )}

            {type.creditFields.map(({ field, label }) => (
              item[field]?.length > 0 && (
                <div key={field}>
                  <div className="detail-section-label">{label}</div>
                  <div className="detail-people">{item[field].join(', ')}</div>
                </div>
              )
            ))}

            <div className="detail-admin-actions">
              <button className="btn-edit" onClick={() => onEdit(item)}>Edit</button>
              <button className="btn-delete" onClick={() => onDelete(item)}>Remove</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
